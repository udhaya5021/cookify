"""Profile view/edit — matches the assignment's Profile Page wireframe
(profile picture, username, bio, uploaded recipes)."""
import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Recipe, Subscription
from app.routers.recipes import _serialize, UPLOAD_DIR, _ALLOWED_MEDIA_EXT

router = APIRouter(prefix="/api/users", tags=["users"])


def _profile(db: Session, user: User) -> dict:
    recipes = db.query(Recipe).filter(Recipe.creator_id == user.id).all()
    follower_count = db.query(Subscription).filter(Subscription.creator_id == user.id).count()
    following_count = db.query(Subscription).filter(Subscription.subscriber_id == user.id).count()
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
    }


@router.get("/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return _profile(db, user)


@router.put("/me")
async def update_profile(
    bio: str = Form(""),
    first_name: str = Form(""),
    last_name: str = Form(""),
    age: int | None = Form(None),
    profile_picture: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.bio = bio
    user.first_name = first_name
    user.last_name = last_name
    user.age = age

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
