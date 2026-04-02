from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    ActionCategory,
    ActionSample,
    ActionSampleSet,
    ActionSequence,
    ObjectAnnotation,
    ObjectAnnotationSet,
    ObjectCategory,
    TrainingJob,
)


async def list_object_categories(db: AsyncSession) -> Sequence[ObjectCategory]:
    result = await db.execute(select(ObjectCategory).order_by(ObjectCategory.created_at.desc()))
    return result.scalars().all()


async def create_object_category(db: AsyncSession, **kwargs) -> ObjectCategory:
    item = ObjectCategory(**kwargs)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_object_annotation_sets(db: AsyncSession) -> Sequence[ObjectAnnotationSet]:
    result = await db.execute(select(ObjectAnnotationSet).order_by(ObjectAnnotationSet.created_at.desc()))
    return result.scalars().all()


async def create_object_annotation_set(db: AsyncSession, **kwargs) -> ObjectAnnotationSet:
    item = ObjectAnnotationSet(**kwargs)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_object_annotation_set(db: AsyncSession, set_id: int) -> Optional[ObjectAnnotationSet]:
    result = await db.execute(select(ObjectAnnotationSet).where(ObjectAnnotationSet.id == set_id))
    return result.scalar_one_or_none()


async def create_object_annotation(db: AsyncSession, **kwargs) -> ObjectAnnotation:
    item = ObjectAnnotation(**kwargs)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_object_annotations(db: AsyncSession, annotation_set_id: int) -> Sequence[ObjectAnnotation]:
    result = await db.execute(
        select(ObjectAnnotation)
        .where(ObjectAnnotation.annotation_set_id == annotation_set_id)
        .order_by(ObjectAnnotation.id)
    )
    return result.scalars().all()


async def list_object_categories_by_ids(db: AsyncSession, category_ids: list[int]) -> Sequence[ObjectCategory]:
    if not category_ids:
        return []
    result = await db.execute(
        select(ObjectCategory)
        .where(ObjectCategory.id.in_(category_ids))
        .order_by(ObjectCategory.id)
    )
    return result.scalars().all()


async def list_action_categories(db: AsyncSession) -> Sequence[ActionCategory]:
    result = await db.execute(select(ActionCategory).order_by(ActionCategory.created_at.desc()))
    return result.scalars().all()


async def create_action_category(db: AsyncSession, **kwargs) -> ActionCategory:
    item = ActionCategory(**kwargs)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_action_category(db: AsyncSession, category_id: int) -> Optional[ActionCategory]:
    result = await db.execute(select(ActionCategory).where(ActionCategory.id == category_id))
    return result.scalar_one_or_none()


async def list_action_categories_by_ids(db: AsyncSession, category_ids: list[int]) -> Sequence[ActionCategory]:
    if not category_ids:
        return []
    result = await db.execute(
        select(ActionCategory)
        .where(ActionCategory.id.in_(category_ids))
        .order_by(ActionCategory.id)
    )
    return result.scalars().all()


async def list_action_sample_sets(db: AsyncSession) -> Sequence[ActionSampleSet]:
    result = await db.execute(select(ActionSampleSet).order_by(ActionSampleSet.created_at.desc()))
    return result.scalars().all()


async def create_action_sample_set(db: AsyncSession, **kwargs) -> ActionSampleSet:
    item = ActionSampleSet(**kwargs)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_action_sample_set(db: AsyncSession, set_id: int) -> Optional[ActionSampleSet]:
    result = await db.execute(select(ActionSampleSet).where(ActionSampleSet.id == set_id))
    return result.scalar_one_or_none()


async def batch_create_action_samples(db: AsyncSession, sample_items: list[dict]) -> int:
    created = 0
    for item in sample_items:
        db.add(ActionSample(**item))
        created += 1
    await db.commit()
    return created


async def list_action_samples(db: AsyncSession, sample_set_id: int) -> Sequence[ActionSample]:
    result = await db.execute(
        select(ActionSample)
        .where(ActionSample.sample_set_id == sample_set_id)
        .order_by(ActionSample.id)
    )
    return result.scalars().all()


async def list_session_actions(db: AsyncSession, session_id: int) -> Sequence[ActionSequence]:
    result = await db.execute(
        select(ActionSequence)
        .where(ActionSequence.session_id == session_id)
        .order_by(ActionSequence.step_order)
    )
    return result.scalars().all()


async def list_training_jobs(db: AsyncSession) -> Sequence[TrainingJob]:
    result = await db.execute(select(TrainingJob).order_by(TrainingJob.created_at.desc()))
    return result.scalars().all()


async def create_training_job(db: AsyncSession, **kwargs) -> TrainingJob:
    item = TrainingJob(**kwargs)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_training_job(db: AsyncSession, job_id: int) -> Optional[TrainingJob]:
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    return result.scalar_one_or_none()


async def update_training_job(db: AsyncSession, job_id: int, **kwargs) -> Optional[TrainingJob]:
    item = await get_training_job(db, job_id)
    if not item:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item
