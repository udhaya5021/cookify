"""Recipe model — implements the UML diagram's inheritance requirement:
class Recipe -> subclass VegRecipe, subclass NonVegRecipe.

Uses SQLAlchemy single-table inheritance (a `recipe_type` discriminator column)
so this is real, queryable polymorphism, not just decorative subclassing.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    ingredients = Column(Text, nullable=False)       # comma-separated or freeform
    utensils = Column(Text, default="")               # required equipment — searchable
    steps = Column(Text, nullable=False)
    media_url = Column(String, default="")            # photo/video attachment

    cost = Column(Float, default=0.0)                 # budget filter
    cooking_time_minutes = Column(Integer, default=0) # prep/cook time filter
    calories = Column(Integer, default=0)              # nutrition filter
    protein = Column(Integer, default=0)

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

    def matches_filters(self, *, max_cost=None, max_time=None, max_calories=None) -> bool:
        """Polymorphism point: subclasses can override this to add their own
        filter rules (e.g. VegRecipe could reject a `veg_only=False` search)."""
        if max_cost is not None and self.cost > max_cost:
            return False
        if max_time is not None and self.cooking_time_minutes > max_time:
            return False
        if max_calories is not None and self.calories > max_calories:
            return False
        return True


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
