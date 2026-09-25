"""数据集体检引擎与API测试"""

import pytest
from httpx import AsyncClient

from app.core.dataset_audit import audit_yolo_text, auto_fix_yolo_text, generate_data_yaml


SAMPLE_BAD = (
    "0 0.5425 0.4817 1.0850 0.5833\n"      # w>1 警告 + 边缘出界警告
    "1 0.5125 -0.6200 0.2850 0.5183\n"     # cy 越界错误
    "99 0.7200 0.3817 -0.1150 0.2833\n"    # classId 范围 + 负宽度错误
    "2 0.4500 0.5500 0.0000 0.1200\n"      # 零宽度错误
    "\n"                                     # 空行保留
    "# comment line\n"                       # 注释保留
    "3 abc 0.5 0.2 0.3"                      # 非法浮点错误
)


def test_audit_detects_errors_and_warnings():
    items, summary = audit_yolo_text(SAMPLE_BAD, num_classes=10)
    # 5 条数据行（空行/注释不参与）
    assert summary.total == 5
    assert summary.errors == 4
    assert summary.warnings == 1
    assert summary.blocked is True

    by_line = {i.lineNumber: i for i in items}
    assert "包围盒宽度超过整幅画面" in by_line[1].warnings[0]
    assert any("越界" in e for e in by_line[2].errors)
    assert any("超出当前数据字典范围" in e for e in by_line[3].errors)
    assert any("宽度非法" in e for e in by_line[3].errors)
    assert any("宽度非法" in e for e in by_line[4].errors)
    assert any("非法非浮点" in e for e in by_line[7].errors)
    # 空行与注释行不产出诊断
    assert 5 not in by_line and 6 not in by_line


def test_audit_valid_text():
    text = "0 0.5000 0.5000 0.2000 0.3000\n1 0.1000 0.9000 0.1000 0.1000\n"
    items, summary = audit_yolo_text(text, num_classes=10)
    assert summary.total == 2
    assert summary.errors == 0
    assert summary.warnings == 0
    assert summary.blocked is False
    assert all(i.isValid for i in items)


def test_class_names_mapping():
    items, _ = audit_yolo_text("1 0.5 0.5 0.2 0.2\n", class_names={1: "虚焊"})
    assert items[0].className == "虚焊"


def test_auto_fix_clamps_into_range():
    fixed = auto_fix_yolo_text(SAMPLE_BAD, num_classes=10)
    items, summary = audit_yolo_text(fixed, num_classes=10)
    assert summary.errors == 0
    assert summary.blocked is False
    for i in items:
        assert 0 <= i.cx <= 1 and 0 <= i.cy <= 1
        assert i.w > 0 and i.h <= 1
    # 注释与空行保留
    lines = fixed.split("\n")
    assert lines[4] == ""
    assert lines[5] == "# comment line"


def test_auto_fix_nan_fallbacks():
    fixed = auto_fix_yolo_text("0 abc abc abc abc\n", num_classes=10)
    # 末尾换行保留
    assert fixed == "0 0.5000 0.5000 0.1000 0.1000\n"


def test_generate_data_yaml():
    yaml_text = generate_data_yaml({0: "missing_component", 1: "solder_bridge"})
    assert "names:" in yaml_text
    assert "  0: missing_component" in yaml_text
    assert "train: images/train" in yaml_text


@pytest.mark.asyncio
async def test_audit_api(client: AsyncClient, admin_token: str):
    resp = await client.post(
        "/api/dataset-audit/audit",
        json={"text": SAMPLE_BAD, "num_classes": 10},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total"] == 5
    assert data["summary"]["errors"] == 4
    assert data["items"][0]["lineNumber"] == 1


@pytest.mark.asyncio
async def test_fix_api(client: AsyncClient, admin_token: str):
    resp = await client.post(
        "/api/dataset-audit/fix",
        json={"text": SAMPLE_BAD, "num_classes": 10},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["audit_before"]["errors"] == 4
    assert data["audit_after"]["errors"] == 0
    assert data["fixed_line_count"] == 6


@pytest.mark.asyncio
async def test_data_yaml_api(client: AsyncClient, admin_token: str):
    resp = await client.post(
        "/api/dataset-audit/data-yaml",
        json={"class_names": {"0": "missing_component"}},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert "missing_component" in resp.json()["yaml"]


@pytest.mark.asyncio
async def test_audit_file_api(client: AsyncClient, admin_token: str):
    resp = await client.post(
        "/api/dataset-audit/audit-file?num_classes=10",
        files={"file": ("labels.txt", SAMPLE_BAD.encode(), "text/plain")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["summary"]["errors"] == 4
