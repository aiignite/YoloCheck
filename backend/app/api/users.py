"""用户管理API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.user import UserCreate, UserUpdate, UserResponse, ChangePasswordRequest
from app.crud import user as crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(data: UserCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    existing = await crud.get_user_by_username(db, data.username)
    if existing:
        raise HTTPException(409, "用户名已存在")
    return await crud.create_user(
        db,
        username=data.username,
        password=data.password,
        display_name=data.display_name,
        email=data.email,
        role=data.role,
    )


@router.get("/", response_model=list[UserResponse])
async def list_users(skip: int = 0, limit: int = 100, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_users(db, skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    u = await crud.get_user(db, user_id)
    if not u:
        raise HTTPException(404, "用户不存在")
    return u


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, data: UserUpdate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    u = await crud.update_user(db, user_id, **data.model_dump(exclude_unset=True))
    if not u:
        raise HTTPException(404, "用户不存在")
    return u


@router.put("/{user_id}/password")
async def change_password(user_id: int, data: ChangePasswordRequest, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    success = await crud.change_password(db, user_id, data.old_password, data.new_password)
    if not success:
        raise HTTPException(400, "原密码错误或用户不存在")
    return {"message": "密码修改成功"}


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    if not await crud.delete_user(db, user_id):
        raise HTTPException(404, "用户不存在")
