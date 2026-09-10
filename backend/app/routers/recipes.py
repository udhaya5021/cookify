"""Recipe upload, search/filter, and view — matches the assignment's
Recipe Upload Method and Recipe Search Method pseudocode."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.deps import get_current_user, get_current_user_optional
from app.models import User, Recipe, SavedRecipe, Subscription
from app.models.recipe import DIETARY_TAGS
from app.services.media import read_validated_media

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _serialize(r: Recipe, *, is_saved: bool = False, is_subscribed_to_creator: bool = False) -> dict:
    return {
        "is_saved": is_saved,
        "is_subscribed_to_creator": is_subscribed_to_creator,
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
        "creator_profile_picture_url": r.creator.profile_picture_url if r.creator else None,
        "creator_bio": r.creator.bio if r.creator else None,
        "average_rating": r.average_rating,
        "rating_count": len(r.ratings),
    }


@router.post("")
async def upload_recipe(
    title: str = Form(...),
    ingredients: str = Form(...),
    utensils: str = Form(""),
    steps: str = Form(...),
    # Bounds enforced server-side, not just by the StarPicker/number-input
    # UI — a direct API call (or /docs) bypasses client-side clamping entirely.
    cost: float = Form(0.0, ge=0),
    cooking_time_minutes: int = Form(0, ge=0),
    calories: int = Form(0, ge=0),
    protein: int = Form(0, ge=0),
    speed: float = Form(3.0, ge=0.5, le=5),
    difficulty: float = Form(3.0, ge=0.5, le=5),
    dietary_tag: str = Form("vegetarian"),
    food_type: str = Form(""),
    region: str = Form(""),
    media: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not title.strip() or not ingredients.strip() or not steps.strip():
        raise HTTPException(400, "Error: All fields must be filled")
    if dietary_tag not in DIETARY_TAGS:
        raise HTTPException(400, f"Error: dietary_tag must be one of {DIETARY_TAGS}")

    media_bytes, media_content_type = (None, "")
    if media is not None:
        media_bytes, media_content_type = await read_validated_media(media)

    # UML: User.uploadRecipe() — the model picks the Veg/NonVeg subclass, so
    # polymorphism is decided in the domain layer rather than in the route.
    recipe = user.uploadRecipe(
        db,
        title=title, ingredients=ingredients, utensils=utensils, steps=steps,
        media_url="", cost=cost, cooking_time_minutes=cooking_time_minutes,
        calories=calories, protein=protein, speed=speed, difficulty=difficulty,
        dietary_tag=dietary_tag, food_type=food_type, region=region,
    )

    # media_url points at this recipe's own /media endpoint — it can only be
    # built once the recipe has an id, so this happens after the insert above.
    if media_bytes:
        recipe.media_data = media_bytes
        recipe.media_content_type = media_content_type
        recipe.media_url = f"/api/recipes/{recipe.id}/media"
        db.commit()
        db.refresh(recipe)

    # Notify subscribers — fire-and-forget style; see social.py for the actual
    # subscription-triggered email, kept there to avoid circular imports.
    from app.routers.social import notify_subscribers_of_new_recipe
    notify_subscribers_of_new_recipe(db, user, recipe)

    return {"message": "Recipe Uploaded Successfully", "recipe": _serialize(recipe)}


@router.get("/{recipe_id}/media")
def get_recipe_media(recipe_id: int, db: Session = Depends(get_db)):
    """Serves the recipe's photo/video straight out of Postgres — no local
    disk involved, so this works identically from any device, network, or
    number of backend instances, and survives redeploys."""
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe or not recipe.media_data:
        raise HTTPException(404, "No media for this recipe")
    return Response(content=recipe.media_data, media_type=recipe.media_content_type or "application/octet-stream")


@router.get("")
def search_recipes(
    q: str = "",
    ingredient: str = "",
    utensil: str = "",
    max_cost: Optional[float] = None,
    max_time: Optional[int] = None,
    max_calories: Optional[int] = None,
    min_speed: Optional[float] = None,
    min_difficulty: Optional[float] = None,
    min_rating: Optional[float] = None,  # Recipe Search Method pseudocode: "Filter by Rating or Tags"
    dietary_tag: str = "",
    food_type: str = "",
    region: str = "",
    veg_only: bool = False,
    following_only: bool = False,  # test case 13: surface recipes from creators this viewer subscribes to
    sort: str = "popularity",  # "popularity" | "newest" | "rating"
    db: Session = Depends(get_db),
    viewer: Optional[User] = Depends(get_current_user_optional),
):
    subscribed_creator_ids = None
    if following_only:
        subscribed_creator_ids = [
            s.creator_id for s in (
                db.query(Subscription).filter(Subscription.subscriber_id == viewer.id).all()
                if viewer else []
            )
        ]

    # UML: Recipe.searchRecipe() — the query, the polymorphic filter pass and
    # the ordering all live on the class.
    filtered = Recipe.searchRecipe(
        db, q=q, ingredient=ingredient, utensil=utensil, veg_only=veg_only,
        max_cost=max_cost, max_time=max_time, max_calories=max_calories,
        min_speed=min_speed, min_difficulty=min_difficulty, min_rating=min_rating,
        dietary_tag=dietary_tag, food_type=food_type, region=region, sort=sort,
        subscribed_creator_ids=subscribed_creator_ids,
    )
    return {"count": len(filtered), "recipes": [_serialize(r) for r in filtered]}


@router.get("/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db), viewer: Optional[User] = Depends(get_current_user_optional)):
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    is_saved = bool(
        viewer and db.query(SavedRecipe).filter(
            SavedRecipe.user_id == viewer.id, SavedRecipe.recipe_id == recipe_id
        ).first()
    )
    is_subscribed = bool(
        viewer and viewer.id != recipe.creator_id and db.query(Subscription).filter(
            Subscription.subscriber_id == viewer.id, Subscription.creator_id == recipe.creator_id
        ).first()
    )
    # UML: Recipe.showRecipe() — registers the view, then returns it.
    return _serialize(recipe.showRecipe(db), is_saved=is_saved, is_subscribed_to_creator=is_subscribed)


@router.put("/{recipe_id}")
async def edit_recipe(
    recipe_id: int,
    title: str = Form(...),
    ingredients: str = Form(...),
    utensils: str = Form(""),
    steps: str = Form(...),
    cost: float = Form(0.0, ge=0),
    cooking_time_minutes: int = Form(0, ge=0),
    calories: int = Form(0, ge=0),
    protein: int = Form(0, ge=0),
    speed: float = Form(3.0, ge=0.5, le=5),
    difficulty: float = Form(3.0, ge=0.5, le=5),
    dietary_tag: str = Form("vegetarian"),
    food_type: str = Form(""),
    region: str = Form(""),
    media: Optional[UploadFile] = File(None),
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
        media_bytes, media_content_type = await read_validated_media(media)
        recipe.media_data = media_bytes
        recipe.media_content_type = media_content_type
        recipe.media_url = f"/api/recipes/{recipe.id}/media"

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


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Structure Diagram: Display Recipe -> Edit recipe covers editing; this
    is its natural counterpart, gated the same way — creator only."""
    recipe = db.query(Recipe).get(recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    if recipe.creator_id != user.id:
        raise HTTPException(403, "Only the recipe's creator can delete it")

    # Ratings/comments cascade via the Recipe.ratings/.comments relationships
    # (cascade="all, delete-orphan"), but nothing declares that for saved-recipe
    # bookmarks, so those need clearing first or the FK constraint blocks the delete.
    db.query(SavedRecipe).filter(SavedRecipe.recipe_id == recipe_id).delete()
    db.delete(recipe)
    db.commit()
    return {"message": "Recipe deleted successfully"}
