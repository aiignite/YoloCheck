from fastapi import HTTPException, UploadFile

from app.config import get_settings

settings = get_settings()
MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".flv", ".wmv"}
MODEL_EXTENSIONS = {".pt", ".onnx", ".engine"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

VIDEO_MIMES = {
    "video/mp4", "video/avi", "video/x-msvideo", "video/quicktime",
    "video/x-matroska", "video/x-flv", "video/x-ms-wmv",
}
MODEL_MIMES = {
    "application/octet-stream", "application/x-onnx",
    "application/zip", "application/x-tar",
}


async def validate_upload(
    file: UploadFile,
    allowed_ext: set[str],
    allowed_mime: set[str] | None = None,
) -> None:
    if not file.filename:
        raise HTTPException(400, "缺少文件名")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if f".{ext}" not in allowed_ext:
        raise HTTPException(400, f"不支持的文件格式: .{ext}")

    if allowed_mime and file.content_type and file.content_type not in allowed_mime:
        raise HTTPException(400, f"不支持的文件类型: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            400,
            f"文件大小超出限制（最大 {settings.max_upload_size_mb}MB）",
        )
    await file.seek(0)
