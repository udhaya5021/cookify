"""Recipe upload, search/filter, and view — matches the assignment's
Recipe Upload Method and Recipe Search Method pseudocode."""
import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Recipe, VegRecipe, NonVegRecipe

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
_ALLOWED_MEDIA_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm"}


def _serialize(r: Recipe) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "ingredients": r.ingredients,
        "utensils": r.utensils,
        "steps": r.steps,
        "media_url": r.media_url,
        "cost": r.cost,
        "cooking_time_minutes": r.cooking_time_minutes,
        "calories": r.calories,
        "protein": r.protein,
        "view_count": r.view_count,
        "recipe_type": r.recipe_type,  # "veg" | "nonveg"
        "creator_id": r.creator_id,
        "creator_username": r.creator.username if r.creator else None,
        "average_rating": r.average_rating,
        "rating_count": len(r.ratings),
    }


@router.post("")
async def upload_recipe(
    title: str = Form(...),
    ingredients: str = Form(...),
    utensils: str = Form(""),
    steps: str = Form(...),
    cost: float = Form(0.0),
    cooking_time_minutes: int = Form(0),
    calories: int = Form(0),
    protein: int = Form(0),
    is_veg: bool = Form(...),
    media: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not title.strip() or not ingredients.strip() or not steps.strip():
        raise HTTPException(400, "Error: All fields must be filled")

    media_url = ""
    if media is not None:
        ext = os.path.splitext(media.filename or "")[1].lower()
        if ext not in _ALLOWED_MEDIA_EXT:
            raise HTTPException(400, "Error: Invalid image/video format")
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, filename)
        with open(dest, "wb") as f:
            shutil.copyfileobj(media.file, f)
        media_url = f"/static/uploads/{filename}"

    # Polymorphism in action: the subclass is chosen at creation time, and
    # each instance carries its own matches_filters() override from here on.
    RecipeClass = VegRecipe if is_veg else NonVegRecipe
    recipe = RecipeClass(
        title=title, ingredients=ingredients, utensils=utensils, steps=steps,
        media_url=media_url, cost=cost, cooking_time_minutes=cooking_time_minutes,
        calories=calories, protein=protein, creator_id=user.id,
    )
    db.add(recipe)
    db.commit()
    db.refresh(recipe)

    # Notify subscribers — fire-and-forget style; see social.py for the actual
    # subscription-triggered email, kept there to avoid circular imports.
    from app.routers.social import notify_subscribers_of_new_recipe
    notify_subscribers_of_new_recipe(db, user, recipe)

    return {"message": "Recipe Uploaded Successfully", "recipe": _serialize(recipe)}


@router.get("")
def search_recipes(
    q: str = "",
    ingredient: str = "",
    utensil: str = "",
    max_cost: float | None = None,
    max_time: int | None = None,
    max_calories: int | None = None,
    veg_only: bool = False,
    sort: str = "popularity",  # "popularity" | "newest" | "rating"
    db: Session = Depends(get_db),
):
    query = db.query(Recipe)

    if q:
        query = query.filter(Recipe.title.ilike(f"%{q}%"))
    if ingredient:
        query = query.filter(Recipe.ingredients.ilike(f"%{ingredient}%"))
    if utensil:
        query = query.filter(Recipe.utensils.ilike(f"%{utensil}%"))
    if veg_only:
        query = query.filter(Recipe.recipe_type == "veg")

    results = query.all()

    # Polymorphic filter pass — each recipe (veg or nonveg) applies its own
    # matches_filters() override for the numeric constraints.
    filtered = [
        r for r in results
        if r.matches_filters(max_cost=max_cost, max_time=max_time, max_calories=max_calories, veg_only=veg_only)
    ]

    if sort == "popularity":
        filtered.sort(key=lambda r: r.view_count, reverse=True)
    elif sort == "rating":
        filtered.sort(key=lambda r: r.average_rating, reverse=True)
    else:
        filtered.sort(key=lambda r: r.created_at, reverse=True)

    return {"count": len(filtered), "recipes": [_serialize(r) for r in filtered]}


@router.get("/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    recipe.view_count += 1
    db.commit()
    return _serialize(recipe)
