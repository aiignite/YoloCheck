"""测试配置 - 使用SQLite内存数据库"""

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.database import Base, get_db
from app.main import app
from app.crud.user import create_user as crud_create_user


TEST_DATABASE_URL = "sqlite+aiosqlite:///test.db"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_session() as session:
        yield session


async def _create_user_and_get_token(client: AsyncClient, db: AsyncSession,
                                      username: str, role: str) -> str:
    await crud_create_user(db, username=username, password="testpass123", role=role)
    resp = await client.post("/api/auth/login", json={"username": username, "password": "testpass123"})
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient, db_session: AsyncSession) -> str:
    return await _create_user_and_get_token(client, db_session, "test_admin", "admin")


@pytest_asyncio.fixture
async def manager_token(client: AsyncClient, db_session: AsyncSession) -> str:
    return await _create_user_and_get_token(client, db_session, "test_manager", "manager")


@pytest_asyncio.fixture
async def operator_token(client: AsyncClient, db_session: AsyncSession) -> str:
    return await _create_user_and_get_token(client, db_session, "test_operator", "operator")
