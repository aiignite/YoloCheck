#!/usr/bin/env python3
import asyncio
import hashlib
import sys
sys.path.insert(0, '/Users/wyh/Documents/MyOpenCode/YoloCheck/backend')

from app.database import async_session
from app.models.models import User

async def main():
    async with async_session() as s:
        s.add(User(
            username='admin',
            display_name='系统管理员',
            email='admin@yolocheck.com',
            role='admin',
            hashed_password=hashlib.sha256(b'admin123').hexdigest(),
            is_active=True,
        ))
        await s.commit()
        print('ADMIN_CREATED_OK')

asyncio.run(main())
