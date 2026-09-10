"""Shared auth dependency — extracts the current user from a Bearer token."""

from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session, defer

from app.database import get_db
from app.models import User
from app.services.security import decode_access_token


def get_current_user(
    authorization: str = Header(default=""), db: Session = Depends(get_db)
) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    user_id = decode_access_token(authorization.removeprefix("Bearer "))
    if user_id is None:
        raise HTTPException(401, "Invalid or expired token")
    # This dependency runs on every authenticated request across the whole
    # app; profile_picture_data can be a multi-MB blob that almost none of
    # those requests actually need, so it's deferred here rather than in
    # each individual endpoint.
    user = db.query(User).options(defer(User.profile_picture_data)).get(user_id)
    if not user:
        raise HTTPException(401, "User not found")
    if user.is_banned:
        raise HTTPException(403, "This account has been banned")
    return user


def get_current_user_optional(
    authorization: str = Header(default=""), db: Session = Depends(get_db)
) -> Optional[User]:
    """Same as get_current_user but returns None instead of 401 — for
    endpoints that are public but behave differently when logged in (e.g. a
    recipe's detail view showing whether *this* viewer already saved it)."""
    if not authorization.startswith("Bearer "):
        return None
    user_id = decode_access_token(authorization.removeprefix("Bearer "))
    if user_id is None:
        return None
    # This dependency runs on every authenticated request across the whole
    # app; profile_picture_data can be a multi-MB blob that almost none of
    # those requests actually need, so it's deferred here rather than in
    # each individual endpoint.
    user = db.query(User).options(defer(User.profile_picture_data)).get(user_id)
    if not user or user.is_banned:
        return None
    return user
