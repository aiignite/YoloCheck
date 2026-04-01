import hashlib
from typing import Optional, Sequence

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _is_bcrypt_hash(hashed: str) -> bool:
    return hashed.startswith("$2b$") or hashed.startswith("$2a$") or hashed.startswith("$2y$")


def _hash_password_sha256(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    if _is_bcrypt_hash(hashed):
        return bcrypt.checkpw(password.encode(), hashed.encode())
    legacy_hash = _hash_password_sha256(password)
    return legacy_hash == hashed


def needs_rehash(hashed: str) -> bool:
    return not _is_bcrypt_hash(hashed)


async def create_user(db: AsyncSession, username: str, password: str, **kwargs) -> User:
    user = User(username=username, hashed_password=_hash_password(password), **kwargs)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def list_users(db: AsyncSession, skip: int = 0, limit: int = 100) -> Sequence[User]:
    result = await db.execute(select(User).order_by(User.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


async def update_user(db: AsyncSession, user_id: int, **kwargs) -> Optional[User]:
    user = await get_user(db, user_id)
    if not user:
        return None
    for k, v in kwargs.items():
        if v is not None:
            setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, user_id: int, old_password: str, new_password: str) -> bool:
    user = await get_user(db, user_id)
    if not user:
        return False
    if not verify_password(old_password, user.hashed_password):
        return False
    user.hashed_password = _hash_password(new_password)
    await db.commit()
    return True


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    user = await get_user(db, user_id)
    if not user:
        return False
    await db.delete(user)
    await db.commit()
    return True
