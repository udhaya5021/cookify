"""Signup / login / 2FA / forgot-password — matches the assignment's
Sign Up Method and Login Method pseudocode almost line for line."""
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RememberedDevice
from app.services.security import (
    hash_password, is_password_valid,
    create_access_token, generate_device_token,
)
from app.services import totp_service
from app.services.email_service import send_password_reset_email

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
_RESET_TOKEN_TTL = timedelta(minutes=30)

router = APIRouter(prefix="/api/auth", tags=["auth"])

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

    # Issue the authenticator secret straight away so the signup page can show
    # the QR as its second step. It isn't trusted until the user submits a
    # working code (POST /api/users/me/2fa/totp/confirm); if they abandon the
    # QR screen, their next login re-offers enrolment rather than refusing.
    secret = totp_service.new_secret()
    user.totp_secret = secret
    user.totp_confirmed = False
    db.commit()

    uri = totp_service.provisioning_uri(secret, user.username)
    token = create_access_token(user.id)
    return {
        "message": "Account created successfully",
        "access_token": token,
        "user_id": user.id,
        "totp": {"secret": secret, "otpauth_uri": uri, "qr_svg": totp_service.qr_svg(uri)},
    }


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

    # One path only: every account authenticates with an authenticator app.
    # The code already exists on the user's device, so there is nothing to
    # generate or send here.
    if user.totp_confirmed:
        return {
            "message": "Enter the code from your authenticator app",
            "requires_otp": True, "method": "totp", "email": user.email,
        }

    # No app enrolled yet — most likely signup was abandoned at the QR step.
    # Re-issue the secret and finish enrolment now rather than refusing the
    # login, which would strand the account with no way back in.
    #
    # The session token below is handed out before a second factor exists.
    # That is the honest position: this account currently has one factor, the
    # password, which has just been verified. Enrolment is what upgrades it.
    secret = user.totp_secret or totp_service.new_secret()
    user.totp_secret = secret
    db.commit()

    uri = totp_service.provisioning_uri(secret, user.username)
    return {
        "message": "Finish setting up your authenticator app",
        "requires_enrolment": True,
        "email": user.email,
        "access_token": create_access_token(user.id),
        "totp": {"secret": secret, "otpauth_uri": uri, "qr_svg": totp_service.qr_svg(uri)},
    }


@router.post("/verify-otp")
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, "User not found")

    if not user.totp_confirmed:
        raise HTTPException(400, "Set up your authenticator app first — log in again to finish")

    # Nothing pending server-side: the code is derived from the shared secret
    # and the current time, so it's checked directly.
    if not totp_service.verify(user.totp_secret, body.otp):
        raise HTTPException(400, "Incorrect code — check your authenticator app")

    response = {"message": "Login Success", "access_token": create_access_token(user.id)}
    if body.remember_device:
        token = generate_device_token()
        db.add(RememberedDevice(user_id=user.id, device_token=token))
        db.commit()
        response["device_token"] = token
    return response


class ForgotPasswordRequest(BaseModel):
    identifier: str  # username, email, or phone number — matches the Login page's wireframe field


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Login Method pseudocode: "SEND password reset mail to registered Email
    ID ... DISPLAY Reset Email Sent" — a link with a single-use, time-limited
    token, not a same-request password change. Anything else would let
    whoever merely knows a username take over the account outright."""
    user = User.find_by_identifier(db, body.identifier)
    if not user:
        raise HTTPException(404, "Error: User not found")

    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.utcnow() + _RESET_TOKEN_TTL
    db.commit()

    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    send_password_reset_email(user.email, reset_link)
    return {"message": "Reset Email Sent"}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == body.token).first() if body.token else None
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(400, "This reset link is invalid or has expired — request a new one")
    if not is_password_valid(body.new_password):
        raise HTTPException(400, "Password must be at least 9 characters, no spaces or restricted symbols")

    user.password_hash = hash_password(body.new_password)
    user.reset_token = ""
    user.reset_token_expires = None
    db.commit()
    return {"message": "Password reset successfully"}
