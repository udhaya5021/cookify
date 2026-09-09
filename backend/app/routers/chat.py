"""Basic chat between users — matches the assignment's "Built-in chat system
for user communication" requirement.

Implemented as simple REST (send + poll) rather than WebSockets — honest
tradeoff to mention in the interview: WebSockets would give real-time push
instead of polling, but REST is simpler to reason about and test, and is a
reasonable v1 for a system that also needs email notifications anyway."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.deps import get_current_user
from app.models import User, ChatMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])


class SendMessageRequest(BaseModel):
    recipient_id: int
    text: str


@router.post("/send")
def send_message(body: SendMessageRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not body.text.strip():
        raise HTTPException(400, "Message cannot be empty")
    recipient = db.query(User).get(body.recipient_id)
    if not recipient:
        raise HTTPException(404, "Recipient not found")

    msg = ChatMessage(sender_id=user.id, recipient_id=body.recipient_id, text=body.text)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "created_at": msg.created_at.isoformat()}


@router.get("/with/{other_user_id}")
def get_conversation(other_user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = (
        db.query(ChatMessage)
        .filter(
            or_(
                and_(ChatMessage.sender_id == user.id, ChatMessage.recipient_id == other_user_id),
                and_(ChatMessage.sender_id == other_user_id, ChatMessage.recipient_id == user.id),
            )
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {"id": m.id, "sender_id": m.sender_id, "text": m.text, "created_at": m.created_at.isoformat()}
        for m in messages
    ]
