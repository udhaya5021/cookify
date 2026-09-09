"""User model — matches the assignment's User + User_Preference entities."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


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
    profile_picture_url = Column(String, default="")

    # 2FA — email OTP, per the assignment's login wireframe
    two_fa_enabled = Column(Boolean, default=True)

    # Ban system — "banned after 3 warnings" (test case 11)
    warning_count = Column(Integer, default=0)
    is_banned = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    preference = relationship("UserPreference", back_populates="user", uselist=False)
    recipes = relationship("Recipe", back_populates="creator")

    def has_reached_ban_threshold(self) -> bool:
        """OOP note: behavior lives on the model, not scattered in route handlers."""
        return self.warning_count >= 3


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
