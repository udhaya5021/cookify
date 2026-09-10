"""Basic chat between users — matches the assignment's "Built-in chat system
for user communication" requirement.

Implemented as simple REST (send + poll) rather than WebSockets — honest
tradeoff to mention in the interview: WebSockets would give real-time push
instead of polling, but REST is simpler to reason about and test, and is a
reasonable v1 for a system that also needs email notifications anyway."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.deps import get_current_user
from app.models import User, ChatMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])


# Who is currently typing to whom: {(sender_id, recipient_id): last ping}.
# Deliberately in-memory rather than a table — this is throwaway state that
# expires in seconds, and writing a DB row per keystroke would be absurd.
# Same caveat as the OTP store: Redis with a TTL in a real multi-process deploy.
_typing: dict[tuple[int, int], datetime] = {}
_TYPING_TTL = timedelta(seconds=6)  # must exceed the client's 4s poll, or it flickers


class SendMessageRequest(BaseModel):
    recipient_id: int
    text: str


class TypingRequest(BaseModel):
    recipient_id: int


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


@router.post("/typing")
def signal_typing(body: TypingRequest, user: User = Depends(get_current_user)):
    """Called (throttled) while the user is composing. Cheap by design: no DB
    write, just a timestamp the recipient's next poll can read."""
    now = datetime.utcnow()
    _typing[(user.id, body.recipient_id)] = now
    # Opportunistic prune so the dict can't grow without bound.
    for key, ts in list(_typing.items()):
        if now - ts > _TYPING_TTL:
            del _typing[key]
    return {"ok": True}


@router.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Powers the Navbar badge — polled independently of any open chat, so
    it stays current even if you never open Messages."""
    count = db.query(ChatMessage).filter(
        ChatMessage.recipient_id == user.id, ChatMessage.is_read.is_(False)
    ).count()
    return {"count": count}


@router.get("/conversations")
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Everyone this user has exchanged messages with, most recent first.

    Without this there's no inbox: a message could only be found by guessing
    your way to the sender's profile and opening the chat manually.
    """
    messages = (
        db.query(ChatMessage)
        .filter(or_(ChatMessage.sender_id == user.id, ChatMessage.recipient_id == user.id))
        .order_by(ChatMessage.created_at.desc())
        .all()
    )

    # Messages arrive newest-first, so the first time a partner appears is
    # their latest message — dict insertion order keeps the list sorted.
    latest: dict[int, ChatMessage] = {}
    unread_by_partner: dict[int, int] = {}
    for m in messages:
        other_id = m.recipient_id if m.sender_id == user.id else m.sender_id
        latest.setdefault(other_id, m)
        if m.recipient_id == user.id and not m.is_read:
            unread_by_partner[other_id] = unread_by_partner.get(other_id, 0) + 1

    if not latest:
        return []

    partners = {u.id: u for u in db.query(User).filter(User.id.in_(latest.keys())).all()}
    return [
        {
            "user_id": other_id,
            "username": partners[other_id].username if other_id in partners else f"User #{other_id}",
            "profile_picture_url": partners[other_id].profile_picture_url if other_id in partners else "",
            "last_message": m.text,
            "last_at": m.created_at.isoformat(),
            "from_me": m.sender_id == user.id,
            "unread_count": unread_by_partner.get(other_id, 0),
        }
        for other_id, m in latest.items()
    ]


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

    # Opening (or polling) this conversation is what "reading" it means here —
    # mark anything the other side sent us as read so the unread badge/inbox
    # highlight clears. Safe to re-run on every 4s poll; it's a no-op once
    # everything's already marked.
    db.query(ChatMessage).filter(
        ChatMessage.sender_id == other_user_id, ChatMessage.recipient_id == user.id,
        ChatMessage.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()

    # Piggy-backed on the existing poll rather than a second endpoint — with a
    # 4s interval, doubling the request count for a typing dot isn't worth it.
    last_typed = _typing.get((other_user_id, user.id))
    partner_typing = bool(last_typed and datetime.utcnow() - last_typed < _TYPING_TTL)

    return {
        "partner_typing": partner_typing,
        "messages": [
            {"id": m.id, "sender_id": m.sender_id, "text": m.text, "created_at": m.created_at.isoformat()}
            for m in messages
        ],
    }
