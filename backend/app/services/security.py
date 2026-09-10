"""Password hashing, JWT session tokens, and OTP generation."""

import os
import random
import secrets as secrets_module
import string
from datetime import datetime, timedelta
from typing import Optional

from jose import jwt
from passlib.context import CryptContext

# A hardcoded value here would be sitting in plain sight in the source (and
# this repo is public) — anyone reading it could forge a valid session for
# any account. Real deployments set SECRET_KEY in .env (gitignored); the
# fallback only kicks in if it's missing, and is regenerated per process
# start rather than a fixed committed string — safer, at the cost of
# invalidating sessions on restart until a real one is configured.
SECRET_KEY = os.getenv("SECRET_KEY") or secrets_module.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def is_password_valid(password: str) -> bool:
    """Matches the assignment's pseudocode: at least 9 chars, no spaces or
    restricted symbols."""
    if len(password) < 9 or " " in password:
        return False
    restricted = set("<>{}[]\\`")
    return not any(c in restricted for c in password)


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except Exception:
        return None


def generate_device_token() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=32))
