"""模型版本管理 API"""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.schemas.model import ModelCreate, ModelUpdate, ModelResponse, ModelCompare
from app.crud import model as crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()
settings = get_settings()

MODELS_DIR = os.path.join(settings.upload_dir, "models")
os.makedirs(MODELS_DIR, exist_ok=True)


@router.get("", response_model=list[ModelResponse])
async def list_models(
    model_type: str = None,
    status: str = None,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_models(db, model_type=model_type, status=status)


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(model_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    m = await crud.get_model(db, model_id)
    if not m:
        raise HTTPException(404, "模型不存在")
    return m


@router.post("", response_model=ModelResponse, status_code=201)
async def create_model(data: ModelCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    return await crud.create_model(db, **data.model_dump())


@router.post("/upload", response_model=ModelResponse, status_code=201)
async def upload_model(
    file: UploadFile = File(...),
    name: str = Form(...),
    version: str = Form(...),
    kind: str = Form(..., alias="model_type"),
    description: str = Form(""),
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    """上传模型文件"""
    if not file.filename.endswith((".pt", ".onnx", ".engine")):
        raise HTTPException(400, "仅支持 .pt / .onnx / .engine 模型文件")

    safe_filename = f"{name}_{version}{os.path.splitext(file.filename)[1]}"
    save_path = os.path.join(MODELS_DIR, safe_filename)

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return await crud.create_model(
        db,
        name=name,
        version=version,
        model_type=kind,
        description=description,
        model_path=save_path,
        file_size=len(content),
        status="uploaded",
    )


@router.put("/{model_id}", response_model=ModelResponse)
async def update_model(model_id: int, data: ModelUpdate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    m = await crud.update_model(db, model_id, **data.model_dump(exclude_unset=True))
    if not m:
        raise HTTPException(404, "模型不存在")
    return m


@router.delete("/{model_id}", status_code=204)
async def delete_model(model_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    m = await crud.get_model(db, model_id)
    if not m:
        raise HTTPException(404, "模型不存在")
    # 不能删除正在部署的模型
    if m.is_active:
        raise HTTPException(400, "不能删除正在部署的模型，请先回滚")
    # 清理文件
    if m.model_path and os.path.exists(m.model_path):
        os.remove(m.model_path)
    await crud.delete_model(db, model_id)


@router.post("/{model_id}/deploy", response_model=ModelResponse)
async def deploy_model(model_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    """部署模型（自动取消同类型下的其他活跃模型）"""
    m = await crud.deploy_model(db, model_id)
    if not m:
        raise HTTPException(404, "模型不存在")
    return m


@router.post("/{model_id}/rollback", response_model=ModelResponse)
async def rollback_model(model_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    """回滚（取消部署）"""
    m = await crud.rollback_model(db, model_id)
    if not m:
        raise HTTPException(404, "模型不存在")
    return m


@router.get("/active/{model_type}", response_model=ModelResponse)
async def get_active(model_type: str, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """获取某类型当前激活的模型"""
    m = await crud.get_active_model(db, model_type)
    if not m:
        raise HTTPException(404, f"没有激活的 {model_type} 类型模型")
    return m


@router.get("/compare/{id_a}/{id_b}", response_model=ModelCompare)
async def compare_models(id_a: int, id_b: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """对比两个模型的性能指标"""
    a = await crud.get_model(db, id_a)
    b = await crud.get_model(db, id_b)
    if not a or not b:
        raise HTTPException(404, "模型不存在")

    def diff(va, vb):
        if va is None or vb is None:
            return None
        return round(va - vb, 4)

    return ModelCompare(
        model_a=ModelResponse.model_validate(a),
        model_b=ModelResponse.model_validate(b),
        metrics_diff={
            "accuracy": diff(a.accuracy, b.accuracy),
            "precision": diff(a.precision, b.precision),
            "recall": diff(a.recall, b.recall),
            "map50": diff(a.map50, b.map50),
            "map50_95": diff(a.map50_95, b.map50_95),
            "inference_speed": diff(a.inference_speed, b.inference_speed),
        },
    )
