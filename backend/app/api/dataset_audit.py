"""数据集体检API - YOLO标注文本校验/自动修复/data.yaml生成"""

from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File
from pydantic import BaseModel, Field

from app.core.auth import require_auth
from app.core.dataset_audit import audit_yolo_text, auto_fix_yolo_text, generate_data_yaml
from app.models.models import User

router = APIRouter()


class AuditRequest(BaseModel):
    text: str = Field(..., min_length=1)
    num_classes: int = Field(10, ge=0, description="类别字典大小，0 表示不校验范围")
    class_names: Optional[dict[int, str]] = None


class AuditLineResponse(BaseModel):
    lineNumber: int
    rawText: str
    classId: Optional[int]
    className: Optional[str]
    cx: Optional[float]
    cy: Optional[float]
    w: Optional[float]
    h: Optional[float]
    isValid: bool
    errors: list[str]
    warnings: list[str]

    model_config = {"from_attributes": True}


class AuditSummaryResponse(BaseModel):
    total: int
    valid: int
    errors: int
    warnings: int
    blocked: bool


class AuditResponse(BaseModel):
    items: list[AuditLineResponse]
    summary: AuditSummaryResponse


class FixRequest(AuditRequest):
    pass


class FixResponse(BaseModel):
    fixed_text: str
    fixed_line_count: int
    audit_before: AuditSummaryResponse
    audit_after: AuditSummaryResponse


class DataYamlRequest(BaseModel):
    class_names: dict[int, str]
    dataset_path: str = "./datasets/inspection"


def _to_line_response(items, summary) -> AuditResponse:
    return AuditResponse(
        items=[AuditLineResponse(**i.__dict__) for i in items],
        summary=AuditSummaryResponse(**summary.__dict__),
    )


@router.post("/audit", response_model=AuditResponse)
async def audit_dataset(payload: AuditRequest, _user: User = Depends(require_auth)):
    """对 YOLO 标注文本逐行体检"""
    items, summary = audit_yolo_text(payload.text, payload.num_classes, payload.class_names)
    return _to_line_response(items, summary)


@router.post("/audit-file", response_model=AuditResponse)
async def audit_dataset_file(
    file: UploadFile = File(...),
    num_classes: int = 10,
    _user: User = Depends(require_auth),
):
    """上传 .txt 标注文件进行体检"""
    content = (await file.read()).decode("utf-8", errors="replace")
    items, summary = audit_yolo_text(content, num_classes)
    return _to_line_response(items, summary)


@router.post("/fix", response_model=FixResponse)
async def fix_dataset(payload: FixRequest, _user: User = Depends(require_auth)):
    """一键 Auto-Fix 钳位修复，返回修复后文本与前后体检对比"""
    _, before = audit_yolo_text(payload.text, payload.num_classes, payload.class_names)
    fixed = auto_fix_yolo_text(payload.text, payload.num_classes)
    _, after = audit_yolo_text(fixed, payload.num_classes, payload.class_names)
    return FixResponse(
        fixed_text=fixed,
        fixed_line_count=sum(1 for line in fixed.split("\n") if line.strip()),
        audit_before=AuditSummaryResponse(**before.__dict__),
        audit_after=AuditSummaryResponse(**after.__dict__),
    )


@router.post("/data-yaml")
async def build_data_yaml(payload: DataYamlRequest, _user: User = Depends(require_auth)):
    """由类别字典程序化生成 Ultralytics data.yaml"""
    if not payload.class_names:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="class_names 不能为空")
    return {"yaml": generate_data_yaml(payload.class_names, payload.dataset_path)}
