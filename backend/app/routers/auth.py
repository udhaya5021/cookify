"""Signup / login / 2FA / forgot-password — matches the assignment's
Sign Up Method and Login Method pseudocode almost line for line."""
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserPreference, RememberedDevice
from app.services.security import (
    hash_password, verify_password, is_password_valid,
    create_access_token, generate_otp, generate_device_token,
)
from app.services.email_service import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory pending-2FA store: {email: (otp, expires_at)}.
# Note for the interview: a real production system would use Redis with a
# TTL instead of an in-process dict, so this survives restarts and scales
# across multiple server instances.
_pending_otps: dict[str, tuple[str, datetime]] = {}


class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    phone_number: str = ""


class LoginRequest(BaseModel):
    identifier: str  # username or email
    password: str
    device_token: str | None = None


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str
    remember_device: bool = False


def _valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


@router.post("/signup")
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, "This username is taken, try again")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "An account with this email already exists")
    if not _valid_email(body.email):
        raise HTTPException(400, "Invalid email format")
    if not is_password_valid(body.password):
        raise HTTPException(400, "Password must be at least 9 characters, no spaces or restricted symbols")

    user = User(
        email=body.email, username=body.username, phone_number=body.phone_number,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()
    db.add(UserPreference(user_id=user.id))
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {"message": "Account created successfully", "access_token": token, "user_id": user.id}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter((User.username == body.identifier) | (User.email == body.identifier))
        .first()
    )
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Error: Incorrect username or password")

    if user.is_banned:
        raise HTTPException(403, "This account has been banned")

    # Remembered device skips 2FA — matches "remember login details on devices"
    if body.device_token:
        known = db.query(RememberedDevice).filter(
            RememberedDevice.user_id == user.id,
            RememberedDevice.device_token == body.device_token,
        ).first()
        if known:
            return {"message": "Login Success", "access_token": create_access_token(user.id)}

    if not user.two_fa_enabled:
        return {"message": "Login Success", "access_token": create_access_token(user.id)}

    otp = generate_otp()
    _pending_otps[user.email] = (otp, datetime.utcnow() + timedelta(minutes=10))
    send_otp_email(user.email, otp)
    return {"message": "OTP sent to your email", "requires_otp": True, "email": user.email}


@router.post("/verify-otp")
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    pending = _pending_otps.get(body.email)
    if not pending or pending[1] < datetime.utcnow():
        raise HTTPException(400, "OTP expired or not found — please log in again")
    if pending[0] != body.otp:
        raise HTTPException(400, "Incorrect OTP")

    del _pending_otps[body.email]
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, "User not found")

    response = {"message": "Login Success", "access_token": create_access_token(user.id)}
    if body.remember_device:
        token = generate_device_token()
        db.add(RememberedDevice(user_id=user.id, device_token=token))
        db.commit()
        response["device_token"] = token
    return response


class ForgotPasswordRequest(BaseModel):
    email: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, "Error: User not found")
    if not is_password_valid(body.new_password):
        raise HTTPException(400, "Password must be at least 9 characters, no spaces or restricted symbols")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password reset successfully"}
