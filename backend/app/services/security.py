"""Password hashing, JWT session tokens, and OTP generation."""
from typing import Optional
import random
import string
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt

SECRET_KEY = "cookify-dev-secret-change-in-production"
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


def generate_otp() -> str:
    """6-digit email OTP, per the login wireframe."""
    return "".join(random.choices(string.digits, k=6))


def generate_device_token() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=32))
