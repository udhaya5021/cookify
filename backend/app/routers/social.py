"""Comments (with NSFW filtering + warnings), ratings, and subscriptions —
matches the assignment's Commenting Method, Rating Method, and
Subscription Method pseudocode, plus the ban-after-3-warnings test case."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Recipe, Comment, Rating, Subscription, Warning
from app.services.content_filter import validate_comment
from app.services.email_service import send_new_recipe_notification, send_warning_email

router = APIRouter(prefix="/api", tags=["social"])


def _issue_warning(db: Session, user: User, reason: str) -> None:
    """Shared by any moderation trigger (currently: posting a blocked comment).
    Bans the account once warning_count reaches 3 — test case 11."""
    db.add(Warning(user_id=user.id, reason=reason))
    user.warning_count += 1
    send_warning_email(user.email, reason, user.warning_count)

    if user.has_reached_ban_threshold():
        user.is_banned = True
        # Test case 11 explicitly requires wiping the user's content on ban.
        db.query(Comment).filter(Comment.user_id == user.id).delete()
        db.query(Rating).filter(Rating.user_id == user.id).delete()
        db.query(Recipe).filter(Recipe.creator_id == user.id).delete()
    db.commit()


# ── Comments ─────────────────────────────────────────────────────────────

class CommentRequest(BaseModel):
    text: str


@router.post("/recipes/{recipe_id}/comments")
def post_comment(
    recipe_id: int, body: CommentRequest,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")

    is_safe, reason = validate_comment(body.text)
    if not is_safe:
        _issue_warning(db, user, f"Posted a blocked comment: {reason}")
        raise HTTPException(400, f"Invalid Comment: {reason}")

    comment = Comment(recipe_id=recipe_id, user_id=user.id, text=body.text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {"message": "Comment posted", "comment_id": comment.id}


@router.get("/recipes/{recipe_id}/comments")
def list_comments(recipe_id: int, db: Session = Depends(get_db)):
    comments = db.query(Comment).filter(Comment.recipe_id == recipe_id).order_by(Comment.created_at.desc()).all()
    return [{"id": c.id, "user_id": c.user_id, "text": c.text, "created_at": c.created_at.isoformat()} for c in comments]


# ── Ratings ──────────────────────────────────────────────────────────────

class RatingRequest(BaseModel):
    score: int  # 1-5


@router.post("/recipes/{recipe_id}/ratings")
def rate_recipe(
    recipe_id: int, body: RatingRequest,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    if not (1 <= body.score <= 5):
        raise HTTPException(400, "Rating must be between 1 and 5")
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")

    existing = db.query(Rating).filter(Rating.recipe_id == recipe_id, Rating.user_id == user.id).first()
    if existing:
        existing.score = body.score  # one rating per user per recipe, updateable
    else:
        db.add(Rating(recipe_id=recipe_id, user_id=user.id, score=body.score))
    db.commit()
    db.refresh(recipe)
    return {"message": "Rating submitted", "average_rating": recipe.average_rating}


# ── Subscriptions ────────────────────────────────────────────────────────

@router.post("/users/{creator_id}/subscribe")
def subscribe(creator_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if creator_id == user.id:
        raise HTTPException(400, "Cannot subscribe to yourself")
    creator = db.query(User).get(creator_id)
    if not creator:
        raise HTTPException(404, "User not found")

    existing = db.query(Subscription).filter(
        Subscription.subscriber_id == user.id, Subscription.creator_id == creator_id
    ).first()
    if existing:
        return {"message": "Already subscribed"}

    db.add(Subscription(subscriber_id=user.id, creator_id=creator_id))
    db.commit()
    return {"message": f"Subscribed to {creator.username}"}


def notify_subscribers_of_new_recipe(db: Session, creator: User, recipe: Recipe) -> None:
    """Called from recipes.py right after a successful upload."""
    subs = db.query(Subscription).filter(Subscription.creator_id == creator.id).all()
    for sub in subs:
        subscriber = db.query(User).get(sub.subscriber_id)
        if subscriber:
            send_new_recipe_notification(subscriber.email, creator.username, recipe.title)
