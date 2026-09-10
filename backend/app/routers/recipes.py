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
from app.models import User, Recipe
from app.models.recipe import DIETARY_TAGS

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
        "speed": r.speed,
        "difficulty": r.difficulty,
        "dietary_tag": r.dietary_tag,
        "food_type": r.food_type,
        "region": r.region,
        "created_at": r.created_at.isoformat() if r.created_at else None,
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
    speed: float = Form(3.0),
    difficulty: float = Form(3.0),
    dietary_tag: str = Form("vegetarian"),
    food_type: str = Form(""),
    region: str = Form(""),
    media: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not title.strip() or not ingredients.strip() or not steps.strip():
        raise HTTPException(400, "Error: All fields must be filled")
    if dietary_tag not in DIETARY_TAGS:
        raise HTTPException(400, f"Error: dietary_tag must be one of {DIETARY_TAGS}")

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

    # UML: User.uploadRecipe() — the model picks the Veg/NonVeg subclass, so
    # polymorphism is decided in the domain layer rather than in the route.
    recipe = user.uploadRecipe(
        db,
        title=title, ingredients=ingredients, utensils=utensils, steps=steps,
        media_url=media_url, cost=cost, cooking_time_minutes=cooking_time_minutes,
        calories=calories, protein=protein, speed=speed, difficulty=difficulty,
        dietary_tag=dietary_tag, food_type=food_type, region=region,
    )

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
    min_speed: float | None = None,
    min_difficulty: float | None = None,
    min_rating: float | None = None,  # Recipe Search Method pseudocode: "Filter by Rating or Tags"
    dietary_tag: str = "",
    food_type: str = "",
    region: str = "",
    veg_only: bool = False,
    sort: str = "popularity",  # "popularity" | "newest" | "rating"
    db: Session = Depends(get_db),
):
    # UML: Recipe.searchRecipe() — the query, the polymorphic filter pass and
    # the ordering all live on the class.
    filtered = Recipe.searchRecipe(
        db, q=q, ingredient=ingredient, utensil=utensil, veg_only=veg_only,
        max_cost=max_cost, max_time=max_time, max_calories=max_calories,
        min_speed=min_speed, min_difficulty=min_difficulty, min_rating=min_rating,
        dietary_tag=dietary_tag, food_type=food_type, region=region, sort=sort,
    )
    return {"count": len(filtered), "recipes": [_serialize(r) for r in filtered]}


@router.get("/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    # UML: Recipe.showRecipe() — registers the view, then returns it.
    return _serialize(recipe.showRecipe(db))


@router.put("/{recipe_id}")
async def edit_recipe(
    recipe_id: int,
    title: str = Form(...),
    ingredients: str = Form(...),
    utensils: str = Form(""),
    steps: str = Form(...),
    cost: float = Form(0.0),
    cooking_time_minutes: int = Form(0),
    calories: int = Form(0),
    protein: int = Form(0),
    speed: float = Form(3.0),
    difficulty: float = Form(3.0),
    dietary_tag: str = Form("vegetarian"),
    food_type: str = Form(""),
    region: str = Form(""),
    media: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Structure Diagram: Display Recipe -> Edit recipe. Same reused form as
    upload (per the wireframe's "Recipe Upload / Edit" page label), gated to
    the recipe's own creator."""
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    if recipe.creator_id != user.id:
        raise HTTPException(403, "Only the recipe's creator can edit it")
    if not title.strip() or not ingredients.strip() or not steps.strip():
        raise HTTPException(400, "Error: All fields must be filled")
    if dietary_tag not in DIETARY_TAGS:
        raise HTTPException(400, f"Error: dietary_tag must be one of {DIETARY_TAGS}")

    if media is not None:
        ext = os.path.splitext(media.filename or "")[1].lower()
        if ext not in _ALLOWED_MEDIA_EXT:
            raise HTTPException(400, "Error: Invalid image/video format")
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, filename)
        with open(dest, "wb") as f:
            shutil.copyfileobj(media.file, f)
        recipe.media_url = f"/static/uploads/{filename}"

    recipe.title = title
    recipe.ingredients = ingredients
    recipe.utensils = utensils
    recipe.steps = steps
    recipe.cost = cost
    recipe.cooking_time_minutes = cooking_time_minutes
    recipe.calories = calories
    recipe.protein = protein
    recipe.speed = speed
    recipe.difficulty = difficulty
    recipe.dietary_tag = dietary_tag
    recipe.food_type = food_type
    recipe.region = region

    # The dietary tag decides the polymorphic subclass, so switching e.g.
    # vegetarian -> non_vegetarian has to move the discriminator too, or the
    # recipe keeps its old Veg badge and still matches veg-only searches.
    new_type = Recipe.subclass_for(dietary_tag).__mapper_args__["polymorphic_identity"]
    type_changed = recipe.recipe_type != new_type
    recipe.recipe_type = new_type

    db.commit()
    if type_changed:
        # The loaded object is still an instance of the old subclass, which
        # SQLAlchemy can't refresh against the new discriminator — drop it and
        # re-read so it comes back as the right class.
        db.expunge(recipe)
        recipe = db.query(Recipe).get(recipe_id)
    else:
        db.refresh(recipe)
    return {"message": "Recipe updated successfully", "recipe": _serialize(recipe)}
