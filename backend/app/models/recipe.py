"""Recipe model — implements the UML diagram's inheritance requirement:
class Recipe -> subclass VegRecipe, subclass NonVegRecipe.

Uses SQLAlchemy single-table inheritance (a `recipe_type` discriminator column)
so this is real, queryable polymorphism, not just decorative subclassing.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import relationship
from app.database import Base

# Test case 5 asks for a dropdown beyond a plain veg/non-veg boolean, and the
# tag is also what decides which polymorphic subclass gets built — so the list
# and the veg mapping live next to the classes they select, not in a router.
DIETARY_TAGS = ["vegetarian", "eggetarian", "pescetarian", "jain", "non_vegetarian"]
_VEG_TAGS = {"vegetarian", "eggetarian", "jain"}


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    ingredients = Column(Text, nullable=False)       # comma-separated or freeform
    utensils = Column(Text, default="")               # required equipment — searchable
    steps = Column(Text, nullable=False)
    media_url = Column(String, default="")            # photo/video attachment (points at GET /api/recipes/{id}/media)
    media_data = Column(LargeBinary, nullable=True)    # the actual bytes — stored in Postgres, not local disk
    media_content_type = Column(String, default="")

    cost = Column(Float, default=0.0)                 # budget filter
    cooking_time_minutes = Column(Integer, default=0) # prep/cook time filter
    calories = Column(Integer, default=0)              # nutrition filter
    protein = Column(Integer, default=0)

    # Test case 4 explicitly lists these as required search filters; test
    # case 5 asks for a dietary dropdown beyond a plain veg/non-veg flag.
    speed = Column(Float, default=3.0)                 # 0.5-5 star rating
    difficulty = Column(Float, default=3.0)            # 0.5-5 star rating
    dietary_tag = Column(String, default="vegetarian") # vegetarian/eggetarian/pescetarian/jain/non_vegetarian
    food_type = Column(String, default="")             # appetizer/bread/dessert/main course/etc.
    region = Column(String, default="")                # cuisine — "pan-Asian", "English", etc.

    view_count = Column(Integer, default=0)            # drives "popularity" sort
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Discriminator column — this is what makes VegRecipe/NonVegRecipe real
    # SQLAlchemy polymorphic subclasses rather than a plain boolean flag.
    recipe_type = Column(String, default="recipe")

    __mapper_args__ = {
        "polymorphic_identity": "recipe",
        "polymorphic_on": recipe_type,
    }

    creator = relationship("User", back_populates="recipes")
    ratings = relationship("Rating", back_populates="recipe", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="recipe", cascade="all, delete-orphan")

    @property
    def average_rating(self) -> float:
        if not self.ratings:
            return 0.0
        return round(sum(r.score for r in self.ratings) / len(self.ratings), 1)

    def matches_filters(
        self, *, max_cost=None, max_time=None, max_calories=None,
        min_speed=None, min_difficulty=None, dietary_tag=None,
        food_type=None, region=None,
    ) -> bool:
        """Polymorphism point: subclasses can override this to add their own
        filter rules (e.g. VegRecipe could reject a `veg_only=False` search)."""
        if max_cost is not None and self.cost > max_cost:
            return False
        if max_time is not None and self.cooking_time_minutes > max_time:
            return False
        if max_calories is not None and self.calories > max_calories:
            return False
        if min_speed is not None and self.speed < min_speed:
            return False
        if min_difficulty is not None and self.difficulty < min_difficulty:
            return False
        if dietary_tag and self.dietary_tag != dietary_tag:
            return False
        # Substring, not exact match — consistent with how ingredient/utensil
        # search behaves. Exact match meant typing "dess" instead of the full
        # "dessert", or "south" instead of "south indian", returned nothing
        # even though a matching recipe existed.
        if food_type and food_type.lower() not in (self.food_type or "").lower():
            return False
        if region and region.lower() not in (self.region or "").lower():
            return False
        return True

    # ── UML class diagram: Recipe.searchRecipe() / Recipe.showRecipe() ──
    # The diagram puts both on the Recipe class rather than in a controller,
    # so they live here and the router just calls them.

    @classmethod
    def subclass_for(cls, dietary_tag: str):
        """Which polymorphic subclass a dietary tag maps to."""
        return VegRecipe if dietary_tag in _VEG_TAGS else NonVegRecipe

    @classmethod
    def searchRecipe(
        cls, db, *, q="", ingredient="", utensil="", veg_only=False,
        max_cost=None, max_time=None, max_calories=None,
        min_speed=None, min_difficulty=None, min_rating=None,
        dietary_tag="", food_type="", region="", sort="popularity",
        subscribed_creator_ids=None,
    ) -> list["Recipe"]:
        """Recipe Search Method pseudocode: query, then apply filters and
        preferences, then order the matches."""
        query = db.query(cls)
        if q:
            query = query.filter(cls.title.ilike(f"%{q}%"))
        if ingredient:
            query = query.filter(cls.ingredients.ilike(f"%{ingredient}%"))
        if utensil:
            query = query.filter(cls.utensils.ilike(f"%{utensil}%"))
        if veg_only:
            query = query.filter(cls.recipe_type == "veg")
        # Test case 13: "the subscriber account is recommended more of
        # their posts" — a "Following" filter surfacing only recipes from
        # creators this viewer subscribes to.
        if subscribed_creator_ids is not None:
            query = query.filter(cls.creator_id.in_(subscribed_creator_ids))

        # Polymorphic pass — each instance applies its own matches_filters().
        matches = [
            r for r in query.all()
            if r.matches_filters(
                max_cost=max_cost, max_time=max_time, max_calories=max_calories,
                min_speed=min_speed, min_difficulty=min_difficulty,
                dietary_tag=dietary_tag, food_type=food_type, region=region,
                veg_only=veg_only,
            )
        ]

        # average_rating is computed from the ratings relationship, not a
        # column, so it can't be filtered inside matches_filters().
        if min_rating is not None:
            matches = [r for r in matches if r.average_rating >= min_rating]

        if sort == "popularity":
            # Test case 6: "based on views and date of upload".
            matches.sort(key=lambda r: (r.view_count, r.created_at), reverse=True)
        elif sort == "rating":
            matches.sort(key=lambda r: r.average_rating, reverse=True)
        else:
            matches.sort(key=lambda r: r.created_at, reverse=True)
        return matches

    def showRecipe(self, db) -> "Recipe":
        """Registers the view (this is what drives popularity) and returns
        the recipe for display."""
        self.view_count += 1
        db.commit()
        return self


class VegRecipe(Recipe):
    __mapper_args__ = {"polymorphic_identity": "veg"}

    def matches_filters(self, *, veg_only=None, **kwargs) -> bool:
        # Vegetarian recipes always satisfy a veg_only search — real polymorphic
        # override, not just an if/else on a shared flag.
        return super().matches_filters(**kwargs)


class NonVegRecipe(Recipe):
    __mapper_args__ = {"polymorphic_identity": "nonveg"}

    def matches_filters(self, *, veg_only=None, **kwargs) -> bool:
        if veg_only:
            return False
        return super().matches_filters(**kwargs)
