"""User model — matches the assignment's User + User_Preference entities."""
import re
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func, LargeBinary
from sqlalchemy.orm import relationship
from app.database import Base
from app.services.security import hash_password, verify_password, is_password_valid


def _valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, default="")  # Sign Up Method pseudocode: INPUT UserID, Email, PhoneNumber
    password_hash = Column(String, nullable=False)
    first_name = Column(String, default="")
    last_name = Column(String, default="")
    age = Column(Integer, nullable=True)
    gender = Column(String, default="")
    bio = Column(String, default="")
    profile_picture_url = Column(String, default="")   # points at GET /api/users/{id}/avatar
    profile_picture_data = Column(LargeBinary, nullable=True)  # actual bytes, stored in Postgres
    profile_picture_content_type = Column(String, default="")

    # 2FA is an authenticator app (TOTP) for every account — there is no
    # second method and no opt-out, so there is no flag encoding a choice.
    # The secret is issued at signup but only trusted once the user proves
    # they can generate a code from it, which is what totp_confirmed records.
    totp_secret = Column(String, default="")
    totp_confirmed = Column(Boolean, default=False)

    # Ban system — "banned after 3 warnings" (test case 11)
    warning_count = Column(Integer, default=0)
    is_banned = Column(Boolean, default=False)

    # Forgot-password: a random, single-use, time-limited token — proves the
    # requester controls the account's inbox before any password changes,
    # rather than trusting "I know the username" alone.
    reset_token = Column(String, default="")
    reset_token_expires = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    preference = relationship("UserPreference", back_populates="user", uselist=False)
    recipes = relationship("Recipe", back_populates="creator")

    def has_reached_ban_threshold(self) -> bool:
        """OOP note: behavior lives on the model, not scattered in route handlers."""
        return self.warning_count >= 3

    # ── UML class diagram: User.register() / login() / uploadRecipe() /
    # rateRecipe(). These raise ValueError with the pseudocode's own wording;
    # the routers translate that into HTTP status codes.

    @classmethod
    def register(cls, db, *, email, username, password, phone_number=""):
        """Sign Up Method pseudocode, start to finish."""
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
            raise ValueError("Password must be at least 9 characters, no spaces or restricted symbols")

        user = cls(
            email=email, username=username, phone_number=(phone_number or "").strip(),
            password_hash=hash_password(password),
        )
        db.add(user)
        db.flush()
        db.add(UserPreference(user_id=user.id))
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

        existing = db.query(Rating).filter(
            Rating.recipe_id == recipe.id, Rating.user_id == self.id
        ).first()
        if existing:
            existing.score = score
        else:
            db.add(Rating(recipe_id=recipe.id, user_id=self.id, score=score))
        db.commit()
        db.refresh(recipe)
        return recipe.average_rating


class UserPreference(Base):
    """Matches the assignment's User_Preference entity — dietary defaults used to
    personalize search results (e.g. default veg-only filter)."""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    veg_only = Column(Boolean, default=False)
    target_calories = Column(Integer, nullable=True)
    target_protein = Column(Integer, nullable=True)

    user = relationship("User", back_populates="preference")


class RememberedDevice(Base):
    """Lets login skip 2FA on a device the user previously verified —
    matches "remember login details on devices" in the spec."""
    __tablename__ = "remembered_devices"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
