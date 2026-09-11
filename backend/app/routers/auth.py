"""Signup / login / 2FA / forgot-password — matches the assignment's
Sign Up Method and Login Method pseudocode almost line for line."""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PendingSignup, RememberedDevice, User
from app.services.email_service import send_login_otp_email, send_password_reset_otp_email
from app.services.security import (
    create_access_token,
    generate_device_token,
    hash_password,
    is_password_valid,
)

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


class VerifySignupOtpRequest(BaseModel):
    email: str
    otp: str


@router.post("/signup")
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    """Sign Up wireframe's "already in use" state also shows a 2FA OTP
    field, so a fresh signup goes through the same emailed-code check as
    login before the account actually exists — the account is only
    created once /verify-signup-otp confirms it (see PendingSignup)."""
    try:
        username, email = User.validate_signup_fields(
            db, email=body.email, username=body.username, password=body.password
        )
    except ValueError as err:
        raise HTTPException(400, str(err))

    code = f"{secrets.randbelow(1_000_000):06d}"
    pending = db.query(PendingSignup).filter(PendingSignup.email == email).first()
    if not pending:
        pending = PendingSignup(email=email)
        db.add(pending)
    pending.username = username
    pending.phone_number = (body.phone_number or "").strip()
    pending.password_hash = hash_password(body.password)
    pending.otp_code = code
    pending.otp_expires = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    send_login_otp_email(email, code)

    return {
        "message": "We've emailed a 6-digit code to your registered email",
        "requires_otp": True,
        "email": email,
    }


@router.post("/verify-signup-otp")
def verify_signup_otp(body: VerifySignupOtpRequest, db: Session = Depends(get_db)):
    pending = db.query(PendingSignup).filter(PendingSignup.email == body.email).first()
    if not pending:
        raise HTTPException(404, "No signup in progress for this email — start again")

    if not pending.otp_expires or pending.otp_expires < datetime.utcnow():
        raise HTTPException(400, "Code expired — start sign up again")
    if pending.otp_code != body.otp.strip():
        raise HTTPException(400, "Incorrect code — check your email")

    # Re-check uniqueness — someone else could have taken the name/email in
    # the window between staging and verifying.
    if db.query(User).filter(func.lower(User.username) == pending.username.lower()).first():
        db.delete(pending)
        db.commit()
        raise HTTPException(400, "This username is taken, try again")
    if db.query(User).filter(func.lower(User.email) == pending.email.lower()).first():
        db.delete(pending)
        db.commit()
        raise HTTPException(400, "An account with this email already exists")

    user = User(
        email=pending.email,
        username=pending.username,
        phone_number=pending.phone_number,
        password_hash=pending.password_hash,
    )
    db.add(user)
    db.delete(pending)
    db.commit()
    db.refresh(user)

    return {
        "message": "Account created successfully",
        "access_token": create_access_token(user.id),
        "user_id": user.id,
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
        known = (
            db.query(RememberedDevice)
            .filter(
                RememberedDevice.user_id == user.id,
                RememberedDevice.device_token == body.device_token,
            )
            .first()
        )
        if known:
            return {"message": "Login Success", "access_token": create_access_token(user.id)}

    # Login Method pseudocode: "GENERATE 6-digit OTP ... SEND to registered
    # Email". Short-lived and single-use — cleared the moment it's verified
    # (or replaced by a fresh one on the next login attempt).
    code = f"{secrets.randbelow(1_000_000):06d}"
    user.otp_code = code
    user.otp_expires = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    send_login_otp_email(user.email, code)

    return {
        "message": "We've emailed a 6-digit code to your registered email",
        "requires_otp": True,
        "email": user.email,
    }


@router.post("/verify-otp")
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, "User not found")

    if not user.otp_code or not user.otp_expires or user.otp_expires < datetime.utcnow():
        raise HTTPException(400, "Code expired — log in again to get a new one")
    if user.otp_code != body.otp.strip():
        raise HTTPException(400, "Incorrect code — check your email")

    user.otp_code = ""
    user.otp_expires = None
    db.commit()

    response = {"message": "Login Success", "access_token": create_access_token(user.id)}
    if body.remember_device:
        token = generate_device_token()
        db.add(RememberedDevice(user_id=user.id, device_token=token))
        db.commit()
        response["device_token"] = token
    return response


class ForgotPasswordRequest(BaseModel):
    identifier: str  # username, email, or phone number — matches the wireframe's field
    new_password: str


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Wireframe: identifier + new password on one page. The password isn't
    applied yet, though — it's staged (pending_password_hash) behind the
    same emailed 6-digit code Login and Signup use, so submitting this form
    alone can't take over an account just by knowing its username."""
    user = User.find_by_identifier(db, body.identifier)
    if not user:
        raise HTTPException(404, "Error: User not found")
    if not is_password_valid(body.new_password):
        raise HTTPException(
            400, "Password must be at least 9 characters, no spaces or restricted symbols"
        )

    code = f"{secrets.randbelow(1_000_000):06d}"
    user.otp_code = code
    user.otp_expires = datetime.utcnow() + timedelta(minutes=10)
    user.pending_password_hash = hash_password(body.new_password)
    db.commit()
    send_password_reset_otp_email(user.email, code)

    return {
        "message": "We've emailed a 6-digit code to your registered email",
        "requires_otp": True,
        "email": user.email,
    }


class VerifyResetOtpRequest(BaseModel):
    email: str
    otp: str


@router.post("/verify-reset-otp")
def verify_reset_otp(body: VerifyResetOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, "User not found")

    if not user.otp_code or not user.otp_expires or user.otp_expires < datetime.utcnow():
        raise HTTPException(400, "Code expired — start again")
    if user.otp_code != body.otp.strip():
        raise HTTPException(400, "Incorrect code — check your email")
    if not user.pending_password_hash:
        raise HTTPException(400, "No password reset in progress — start again")

    user.password_hash = user.pending_password_hash
    user.pending_password_hash = ""
    user.otp_code = ""
    user.otp_expires = None
    db.commit()
    return {"message": "Password reset successfully"}
