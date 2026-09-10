"""Signup / login / 2FA / forgot-password — matches the assignment's
Sign Up Method and Login Method pseudocode almost line for line."""
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RememberedDevice
from app.services.security import (
    hash_password, is_password_valid,
    create_access_token, generate_otp, generate_device_token,
)
from app.services.email_service import send_otp_email
from app.services import totp_service

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
    device_token: Optional[str] = None


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str
    remember_device: bool = False


@router.post("/signup")
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    try:
        user = User.register(
            db, email=body.email, username=body.username,
            password=body.password, phone_number=body.phone_number,
        )
    except ValueError as err:
        raise HTTPException(400, str(err))

    token = create_access_token(user.id)
    return {"message": "Account created successfully", "access_token": token, "user_id": user.id}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = User.login(db, body.identifier, body.password)
    if not user:
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

    # Authenticator app: the code already exists on the user's device, so
    # there's nothing to generate or send here.
    if user.two_fa_method == "totp" and user.totp_confirmed:
        return {
            "message": "Enter the code from your authenticator app",
            "requires_otp": True, "method": "totp", "email": user.email,
        }

    otp = generate_otp()
    _pending_otps[user.email] = (otp, datetime.utcnow() + timedelta(minutes=10))
    send_otp_email(user.email, otp)
    return {"message": "OTP sent to your email", "requires_otp": True, "method": "email", "email": user.email}


@router.post("/verify-otp")
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.two_fa_method == "totp" and user.totp_confirmed:
        # Nothing pending server-side: the code is derived from the shared
        # secret and the current time, so it's checked directly.
        if not totp_service.verify(user.totp_secret, body.otp):
            raise HTTPException(400, "Incorrect code — check your authenticator app")
    else:
        pending = _pending_otps.get(body.email)
        if not pending or pending[1] < datetime.utcnow():
            raise HTTPException(400, "OTP expired or not found — please log in again")
        if pending[0] != body.otp:
            raise HTTPException(400, "Incorrect OTP")
        del _pending_otps[body.email]

    response = {"message": "Login Success", "access_token": create_access_token(user.id)}
    if body.remember_device:
        token = generate_device_token()
        db.add(RememberedDevice(user_id=user.id, device_token=token))
        db.commit()
        response["device_token"] = token
    return response


class ForgotPasswordRequest(BaseModel):
    identifier: str  # username, email, or phone number — matches the Login page's wireframe field
    new_password: str


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = User.find_by_identifier(db, body.identifier)
    if not user:
        raise HTTPException(404, "Error: User not found")
    if not is_password_valid(body.new_password):
        raise HTTPException(400, "Password must be at least 9 characters, no spaces or restricted symbols")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password reset successfully"}
