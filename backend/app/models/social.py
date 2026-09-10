"""Comments, ratings, subscriptions, chat, and warnings —
matches the assignment's Recipe_Rating entity plus the written spec's
comment/subscribe/chat/ban requirements not shown in the ER diagram."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)  # 1-5, matches "Rate a recipe post out of 5 stars"
    created_at = Column(DateTime, default=datetime.utcnow)

    recipe = relationship("Recipe", back_populates="ratings")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    was_flagged = Column(Boolean, default=False)  # test case 8: NSFW comments blocked + logged
    created_at = Column(DateTime, default=datetime.utcnow)

    recipe = relationship("Recipe", back_populates="comments")


class Subscription(Base):
    """Follow relationship — subscriber gets emailed when creator uploads."""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    subscriber_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Flips to True once the recipient opens the conversation — backs the
    # unread badge/highlight so "you got a message" is visible without
    # emailing on every single message in a live back-and-forth.
    is_read = Column(Boolean, default=False)


class SavedRecipe(Base):
    """Profile Page wireframe shows both "Uploaded Recipes" and "Saved
    Recipes" as two distinct grids — this backs the latter (bookmarking)."""
    __tablename__ = "saved_recipes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Warning(Base):
    """Audit trail for the ban system — 3 warnings triggers a ban (test case 11)."""
    __tablename__ = "warnings"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
