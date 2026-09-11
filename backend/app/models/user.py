"""User model — matches the assignment's User + User_Preference entities."""

import re
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, func
from sqlalchemy.orm import relationship

from app.database import Base
from app.services.security import hash_password, is_password_valid, verify_password


def _valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(
        String, default=""
    )  # Sign Up Method pseudocode: INPUT UserID, Email, PhoneNumber
    password_hash = Column(String, nullable=False)
    first_name = Column(String, default="")
    last_name = Column(String, default="")
    age = Column(Integer, nullable=True)
    gender = Column(String, default="")
    profile_picture_url = Column(String, default="")  # points at GET /api/users/{id}/avatar
    profile_picture_data = Column(LargeBinary, nullable=True)  # actual bytes, stored in Postgres
    profile_picture_content_type = Column(String, default="")

    # Login Method pseudocode: "User is emailed a 6 digit code" — generated
    # fresh at each login (see routers/auth.py), single-use, short-lived.
    # Forgot-password reuses this same pair rather than a second set of
    # columns; pending_password_hash holds the new password until that code
    # is confirmed, proving inbox ownership before it's actually applied.
    otp_code = Column(String, default="")
    otp_expires = Column(DateTime, nullable=True)
    pending_password_hash = Column(String, default="")

    # Ban system — "banned after 3 warnings" (test case 11)
    warning_count = Column(Integer, default=0)
    is_banned = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    recipes = relationship("Recipe", back_populates="creator")

    def has_reached_ban_threshold(self) -> bool:
        """OOP note: behavior lives on the model, not scattered in route handlers."""
        return self.warning_count >= 3

    # ── UML class diagram: User.register() / login() / uploadRecipe() /
    # rateRecipe(). These raise ValueError with the pseudocode's own wording;
    # the routers translate that into HTTP status codes.

    @classmethod
    def validate_signup_fields(cls, db, *, email, username, password):
        """Sign Up Method pseudocode's checks, without creating anything —
        shared by direct registration and the emailed-OTP staging flow.
        Returns the normalized (username, email). Raises ValueError."""
        username = (username or "").strip()
        email = (email or "").strip()

        # A signup form field with `required` still lets " " (all-spaces)
        # through — strip() reduces that to "", and without this check it'd
        # sail past the uniqueness query below (nothing else is named ""
        # yet) and create an account with a blank, unloggable-into username.
        if not (3 <= len(username) <= 30):
            raise ValueError("Username must be between 3 and 30 characters")

        # Uniqueness has to be case-insensitive to match how login looks
        # accounts up — otherwise "Udhay" and "udhay" could both exist and
        # a login for either would be ambiguous.
        if db.query(cls).filter(func.lower(cls.username) == username.lower()).first():
            raise ValueError("This username is taken, try again")
        if db.query(cls).filter(func.lower(cls.email) == email.lower()).first():
            raise ValueError("An account with this email already exists")
        if not _valid_email(email):
            raise ValueError("Invalid email format")
        if not is_password_valid(password):
            raise ValueError(
                "Password must be at least 9 characters, no spaces or restricted symbols"
            )
        return username, email

    @classmethod
    def register(cls, db, *, email, username, password, phone_number=""):
        """Sign Up Method pseudocode, start to finish."""
        username, email = cls.validate_signup_fields(
            db, email=email, username=username, password=password
        )
        user = cls(
            email=email,
            username=username,
            phone_number=(phone_number or "").strip(),
            password_hash=hash_password(password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def find_by_identifier(cls, db, identifier: str):
        """Login wireframe: "Username / Email / Phone Number" are all valid
        identifiers.

        Username and email match case-insensitively and ignore surrounding
        whitespace — an email is the same address however it's capitalised,
        nobody remembers how they cased their username, and a trailing space
        from copy-paste shouldn't read as "wrong password".
        """
        ident = (identifier or "").strip()
        if not ident:
            return None
        lowered = ident.lower()
        return (
            db.query(cls)
            .filter(
                (func.lower(cls.username) == lowered)
                | (func.lower(cls.email) == lowered)
                | (cls.phone_number == ident)
            )
            .first()
        )

    @classmethod
    def login(cls, db, identifier: str, password: str):
        """Returns the user, or None when credentials don't match."""
        user = cls.find_by_identifier(db, identifier)
        if not user or not verify_password(password, user.password_hash):
            return None
        return user

    def uploadRecipe(self, db, **fields):
        """Recipe Upload Method pseudocode. The dietary tag decides which
        polymorphic subclass is instantiated."""
        from app.models.recipe import Recipe  # local: avoids a model import cycle

        RecipeClass = Recipe.subclass_for(fields.get("dietary_tag", "vegetarian"))
        recipe = RecipeClass(creator_id=self.id, **fields)
        db.add(recipe)
        db.commit()
        db.refresh(recipe)
        return recipe

    def rateRecipe(self, db, recipe, score: int) -> float:
        """Rating Method pseudocode — one rating per user per recipe, and
        re-rating updates the existing score. Returns the new average."""
        from app.models.social import Rating  # local: avoids a model import cycle

        existing = (
            db.query(Rating)
            .filter(Rating.recipe_id == recipe.id, Rating.user_id == self.id)
            .first()
        )
        if existing:
            existing.score = score
        else:
            db.add(Rating(recipe_id=recipe.id, user_id=self.id, score=score))
        db.commit()
        db.refresh(recipe)
        return recipe.average_rating


class RememberedDevice(Base):
    """Lets login skip 2FA on a device the user previously verified —
    matches "remember login details on devices" in the spec."""

    __tablename__ = "remembered_devices"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PendingSignup(Base):
    """A signup that has passed validation but not yet proven its emailed
    OTP. Kept separate from `users` so an abandoned signup never leaves a
    half-created account sitting in the real table — the row here is
    deleted once verified (and the real User is created) or just
    overwritten by a retry."""

    __tablename__ = "pending_signups"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    phone_number = Column(String, default="")
    password_hash = Column(String, nullable=False)
    otp_code = Column(String, nullable=False)
    otp_expires = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
