"""Profile view/edit — matches the assignment's Profile Page wireframe
(profile picture, username, bio, uploaded recipes)."""
from typing import Optional
import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Recipe, Subscription, SavedRecipe
from app.routers.recipes import _serialize, UPLOAD_DIR, _ALLOWED_MEDIA_EXT

router = APIRouter(prefix="/api/users", tags=["users"])


def _profile(db: Session, user: User) -> dict:
    recipes = db.query(Recipe).filter(Recipe.creator_id == user.id).all()
    follower_count = db.query(Subscription).filter(Subscription.creator_id == user.id).count()
    following_count = db.query(Subscription).filter(Subscription.subscriber_id == user.id).count()

    # Profile Page wireframe: a second grid, "Saved Recipes", distinct from
    # what this user has uploaded.
    saved_ids = [s.recipe_id for s in db.query(SavedRecipe).filter(SavedRecipe.user_id == user.id).all()]
    saved_recipes = db.query(Recipe).filter(Recipe.id.in_(saved_ids)).all() if saved_ids else []

    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "bio": user.bio,
        "age": user.age,
        "profile_picture_url": user.profile_picture_url,
        "followers": follower_count,
        "following": following_count,
        "uploaded_recipes": [_serialize(r) for r in recipes],
        "saved_recipes": [_serialize(r) for r in saved_recipes],
    }


def _summaries(db: Session, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    return [
        {
            "id": u.id, "username": u.username,
            "first_name": u.first_name, "last_name": u.last_name,
            "profile_picture_url": u.profile_picture_url,
        }
        for u in db.query(User).filter(User.id.in_(ids)).all()
    ]


@router.get("/{user_id}/followers")
def list_followers(user_id: int, db: Session = Depends(get_db)):
    """Who subscribes to this user — the profile showed a count with no way
    to see the names behind it."""
    subs = db.query(Subscription).filter(Subscription.creator_id == user_id).all()
    return _summaries(db, [s.subscriber_id for s in subs])


@router.get("/{user_id}/following")
def list_following(user_id: int, db: Session = Depends(get_db)):
    """Who this user subscribes to."""
    subs = db.query(Subscription).filter(Subscription.subscriber_id == user_id).all()
    return _summaries(db, [s.creator_id for s in subs])


@router.get("/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return _profile(db, user)


@router.get("/me/settings")
def my_settings(user: User = Depends(get_current_user)):
    """Account settings only the owner should see — whether 2FA is on is not
    something to advertise on a public profile."""
    return {"two_fa_enabled": user.two_fa_enabled}


@router.put("/me")
async def update_profile(
    bio: str = Form(""),
    first_name: str = Form(""),
    last_name: str = Form(""),
    age: Optional[int] = Form(None),
    two_fa_enabled: Optional[bool] = Form(None),
    profile_picture: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.bio = bio
    user.first_name = first_name
    user.last_name = last_name
    user.age = age
    # Only applied when the caller actually sends it, so a form that doesn't
    # include the field can't silently switch someone's 2FA off.
    if two_fa_enabled is not None:
        user.two_fa_enabled = two_fa_enabled

    if profile_picture is not None:
        ext = os.path.splitext(profile_picture.filename or "")[1].lower()
        if ext not in _ALLOWED_MEDIA_EXT:
            raise HTTPException(400, "Error: Invalid image format")
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, filename)
        with open(dest, "wb") as f:
            shutil.copyfileobj(profile_picture.file, f)
        user.profile_picture_url = f"/static/uploads/{filename}"

    db.commit()
    return _profile(db, user)
