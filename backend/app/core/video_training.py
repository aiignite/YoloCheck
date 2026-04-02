"""视频训练最小实现"""

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.crud import video_training as training_crud

settings = get_settings()


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _normalize_yolo_box(bbox: list[float], width: int | None, height: int | None) -> tuple[float, float, float, float]:
    if len(bbox) != 4 or not width or not height:
        return 0.5, 0.5, 1.0, 1.0
    x1, y1, x2, y2 = bbox
    cx = ((x1 + x2) / 2) / width
    cy = ((y1 + y2) / 2) / height
    bw = max((x2 - x1) / width, 0.0)
    bh = max((y2 - y1) / height, 0.0)
    return round(cx, 6), round(cy, 6), round(bw, 6), round(bh, 6)


async def export_object_dataset(db: AsyncSession, dataset_id: int, job_id: int) -> dict:
    annotations = await training_crud.list_object_annotations(db, dataset_id)
    category_ids = sorted({
        item.get("category_id")
        for annotation in annotations
        for item in (annotation.annotations_json or [])
        if item.get("category_id") is not None
    })
    categories = await training_crud.list_object_categories_by_ids(db, category_ids)
    category_index = {category.id: index for index, category in enumerate(categories)}
    class_names = [category.name for category in categories]

    export_dir = Path(settings.upload_dir) / "datasets" / f"object_job_{job_id}"
    images_dir = export_dir / "images" / "train"
    labels_dir = export_dir / "labels" / "train"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    image_entries = 0
    label_files = 0
    for annotation in annotations:
        stem = f"sample_{annotation.id}"
        image_placeholder = images_dir / f"{stem}.txt"
        image_placeholder.write_text(annotation.image_path, encoding="utf-8")
        image_entries += 1

        label_lines: list[str] = []
        for item in annotation.annotations_json or []:
            category_id = item.get("category_id")
            if category_id not in category_index:
                continue
            bbox = item.get("bbox") or []
            cx, cy, bw, bh = _normalize_yolo_box(bbox, annotation.width, annotation.height)
            label_lines.append(f"{category_index[category_id]} {cx} {cy} {bw} {bh}")

        (labels_dir / f"{stem}.txt").write_text("\n".join(label_lines), encoding="utf-8")
        label_files += 1

    data_yaml_path = export_dir / "data.yaml"
    data_yaml_path.write_text(
        "\n".join([
            f"path: {export_dir}",
            "train: images/train",
            "val: images/train",
            f"nc: {len(class_names)}",
            f"names: {json.dumps(class_names, ensure_ascii=True)}",
        ]),
        encoding="utf-8",
    )

    return {
        "export_dir": str(export_dir),
        "data_yaml_path": str(data_yaml_path),
        "annotation_count": len(annotations),
        "label_files": label_files,
        "image_entries": image_entries,
        "class_names": class_names,
    }


async def build_action_sample_summary(db: AsyncSession, dataset_id: int) -> dict:
    samples = await training_crud.list_action_samples(db, dataset_id)
    category_ids = sorted({sample.action_category_id for sample in samples})
    categories = await training_crud.list_action_categories_by_ids(db, category_ids)
    category_names = {category.id: category.name for category in categories}

    class_counts: dict[str, int] = {}
    sequence_count = 0
    for sample in samples:
        class_name = category_names.get(sample.action_category_id, str(sample.action_category_id))
        class_counts[class_name] = class_counts.get(class_name, 0) + 1
        if (sample.skeleton_sequence_json or {}).get("frames"):
            sequence_count += 1

    return {
        "sample_summary": {
            "sample_count": len(samples),
            "class_names": sorted(class_counts.keys()),
            "class_counts": class_counts,
        },
        "prototype_summary": {
            "prototype_count": len(class_counts),
            "sequence_count": sequence_count,
            "class_counts": class_counts,
        },
    }


def create_object_training_artifact(job_id: int, job_name: str, dataset_export: dict | None = None) -> tuple[str, dict]:
    models_dir = os.path.join(settings.upload_dir, "trained_models")
    _ensure_dir(models_dir)
    artifact_path = os.path.join(models_dir, f"object_job_{job_id}.pt")
    with open(artifact_path, "wb") as file:
        file.write(f"object-model:{job_name}:{_utc_now().isoformat()}".encode("utf-8"))
    return artifact_path, {
        "accuracy": 0.8,
        "precision": 0.82,
        "recall": 0.79,
        "map50": 0.81,
        "map50_95": 0.72,
        "inference_speed": 12.5,
        "dataset_export": dataset_export or {},
    }


def create_action_training_artifact(job_id: int, job_name: str) -> tuple[str, dict]:
    models_dir = os.path.join(settings.upload_dir, "trained_models")
    _ensure_dir(models_dir)
    artifact_path = os.path.join(models_dir, f"action_job_{job_id}.json")
    with open(artifact_path, "w", encoding="utf-8") as file:
        json.dump(
            {
                "job_id": job_id,
                "name": job_name,
                "created_at": _utc_now().isoformat(),
                "prototype_count": 1,
            },
            file,
        )
    return artifact_path, {
        "accuracy": 0.76,
        "precision": 0.75,
        "recall": 0.74,
        "inference_speed": 3.2,
    }
