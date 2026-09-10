"""Profile view/edit — matches the assignment's Profile Page wireframe
(profile picture, username, bio, uploaded recipes)."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_user_optional
from app.models import User, Recipe, Subscription, SavedRecipe
from app.routers.recipes import _serialize
from app.services import totp_service
from app.services.media import read_validated_media

router = APIRouter(prefix="/api/users", tags=["users"])


def _profile(db: Session, user: User, viewer: Optional[User] = None) -> dict:
    recipes = db.query(Recipe).filter(Recipe.creator_id == user.id).all()
    follower_count = db.query(Subscription).filter(Subscription.creator_id == user.id).count()
    following_count = db.query(Subscription).filter(Subscription.subscriber_id == user.id).count()

    # Profile Page wireframe: a second grid, "Saved Recipes", distinct from
    # what this user has uploaded.
    saved_ids = [s.recipe_id for s in db.query(SavedRecipe).filter(SavedRecipe.user_id == user.id).all()]
    saved_recipes = db.query(Recipe).filter(Recipe.id.in_(saved_ids)).all() if saved_ids else []

    is_subscribed = bool(
        viewer and viewer.id != user.id and db.query(Subscription).filter(
            Subscription.subscriber_id == viewer.id, Subscription.creator_id == user.id
        ).first()
    )

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
        "is_subscribed": is_subscribed,
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
def get_profile(user_id: int, db: Session = Depends(get_db), viewer: Optional[User] = Depends(get_current_user_optional)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return _profile(db, user, viewer)


@router.get("/me/settings")
def my_settings(user: User = Depends(get_current_user)):
    """Account settings only the owner should see — whether 2FA is on is not
    something to advertise on a public profile."""
    return {"totp_confirmed": bool(user.totp_confirmed)}


@router.post("/me/2fa/totp/setup")
def totp_setup(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Issue a fresh secret and the QR to enrol it.

    Deliberately does NOT switch the account over to TOTP — the user has to
    prove they can generate a valid code first (see /confirm). Flipping the
    method here would lock out anyone who closed the page before scanning.
    """
    secret = totp_service.new_secret()
    user.totp_secret = secret
    user.totp_confirmed = False
    db.commit()

    uri = totp_service.provisioning_uri(secret, user.username)
    return {
        "secret": secret,          # shown for manual entry when a camera isn't available
        "otpauth_uri": uri,
        "qr_svg": totp_service.qr_svg(uri),
    }


class TotpCodeRequest(BaseModel):
    code: str


@router.post("/me/2fa/totp/confirm")
def totp_confirm(body: TotpCodeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Activate TOTP, but only once a code from the app checks out."""
    if not user.totp_secret:
        raise HTTPException(400, "Start setup first")
    if not totp_service.verify(user.totp_secret, body.code):
        raise HTTPException(400, "That code didn't match — check the app and try again")

    user.totp_confirmed = True
    db.commit()
    return {"message": "Authenticator app enabled"}


@router.post("/me/2fa/totp/reset")
def totp_reset(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Start over on a new device.

    There's no way to turn the authenticator off — it's the only way in — so
    the case this exists for is a lost or replaced phone. Clearing the secret
    means the next login serves a fresh QR, and the old enrolment sitting in
    the previous device's app stops working.
    """
    user.totp_secret = ""
    user.totp_confirmed = False
    db.commit()
    return {"message": "Authenticator reset — you'll set it up again at your next login"}


@router.put("/me")
async def update_profile(
    bio: str = Form(""),
    first_name: str = Form(""),
    last_name: str = Form(""),
    age: Optional[int] = Form(None, ge=0, le=120),
    profile_picture: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.bio = bio
    user.first_name = first_name
    user.last_name = last_name
    user.age = age

    if profile_picture is not None:
        data, content_type = await read_validated_media(profile_picture)
        user.profile_picture_data = data
        user.profile_picture_content_type = content_type
        user.profile_picture_url = f"/api/users/{user.id}/avatar"

    db.commit()
    return _profile(db, user)


@router.get("/{user_id}/avatar")
def get_avatar(user_id: int, db: Session = Depends(get_db)):
    """Serves the profile picture straight out of Postgres, same reasoning
    as recipe media: works from any device/network and survives redeploys."""
    user = db.query(User).get(user_id)
    if not user or not user.profile_picture_data:
        raise HTTPException(404, "No avatar for this user")
    return Response(content=user.profile_picture_data, media_type=user.profile_picture_content_type or "application/octet-stream")
