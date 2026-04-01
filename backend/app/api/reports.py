"""报表导出API"""
from datetime import date, timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.database import get_db
from app.models.models import ProductionStats, DetectionEvent, Alert
from app.core.auth import require_auth
from app.models.models import User

router = APIRouter()


async def _query_production_data(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    station_id: str | None = None,
):
    """查询生产数据"""
    query = select(ProductionStats).where(
        ProductionStats.date >= start_date,
        ProductionStats.date <= end_date,
    )
    if station_id:
        query = query.where(ProductionStats.station_id == station_id)
    query = query.order_by(ProductionStats.date, ProductionStats.hour)
    result = await db.execute(query)
    return result.scalars().all()


async def _query_comparison_data(db: AsyncSession, days: int = 7):
    """查询环比对比数据"""
    today = date.today()
    current_start = today - timedelta(days=days - 1)
    prev_start = current_start - timedelta(days=days)
    prev_end = current_start - timedelta(days=1)

    async def _period_summary(start: date, end: date):
        result = await db.execute(
            select(
                func.sum(ProductionStats.total_count).label("total"),
                func.sum(ProductionStats.defect_count).label("defects"),
                func.avg(ProductionStats.avg_cycle_time).label("avg_cycle"),
            ).where(ProductionStats.date >= start, ProductionStats.date <= end)
        )
        row = result.one()
        total = row.total or 0
        defects = row.defects or 0
        yield_rate = ((total - defects) / total * 100) if total > 0 else 100.0
        return {
            "total_production": total,
            "total_defects": defects,
            "yield_rate": round(yield_rate, 2),
            "avg_cycle_time": round(float(row.avg_cycle or 0), 2),
        }

    current = await _period_summary(current_start, today)
    previous = await _period_summary(prev_start, prev_end)

    comparison = {}
    for key in current:
        cur_val = current[key]
        prev_val = previous[key]
        if prev_val and prev_val != 0:
            change = round((cur_val - prev_val) / prev_val * 100, 2)
        else:
            change = 0.0
        comparison[key] = {
            "current": cur_val,
            "previous": prev_val,
            "change_percent": change,
        }

    return {
        "period": {"current": f"{current_start} ~ {today}", "previous": f"{prev_start} ~ {prev_end}"},
        "comparison": comparison,
    }


@router.get("/comparison")
async def get_comparison(
    days: int = Query(7, ge=1, le=90, description="对比天数"),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """获取环比对比数据"""
    return await _query_comparison_data(db, days)


@router.get("/export/excel")
async def export_production_excel(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=6)),
    end_date: date = Query(default_factory=date.today),
    station_id: str | None = Query(None),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """导出生产数据Excel报表"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

    records = await _query_production_data(db, start_date, end_date, station_id)

    wb = Workbook()

    # Sheet 1: 明细数据
    ws = wb.active
    ws.title = "生产明细"

    # 标题行样式
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    headers = ["日期", "时段", "工位", "总产量", "缺陷数", "良率(%)", "平均节拍(s)"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    for row_idx, r in enumerate(records, 2):
        yield_rate = ((r.total_count - r.defect_count) / r.total_count * 100) if r.total_count > 0 else 100.0
        values = [
            str(r.date), f"{r.hour}:00", r.station_id,
            r.total_count, r.defect_count,
            round(yield_rate, 2), r.avg_cycle_time,
        ]
        for col, v in enumerate(values, 1):
            cell = ws.cell(row=row_idx, column=col, value=v)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center")

    # 列宽自适应
    for col in range(1, len(headers) + 1):
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = 15

    # Sheet 2: 日汇总
    ws2 = wb.create_sheet("日汇总")
    summary_headers = ["日期", "总产量", "总缺陷", "良率(%)", "平均节拍(s)"]
    for col, h in enumerate(summary_headers, 1):
        cell = ws2.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    # 按日期汇总
    daily = {}
    for r in records:
        d = str(r.date)
        if d not in daily:
            daily[d] = {"total": 0, "defects": 0, "cycle_times": []}
        daily[d]["total"] += r.total_count
        daily[d]["defects"] += r.defect_count
        daily[d]["cycle_times"].append(r.avg_cycle_time)

    for row_idx, (d, v) in enumerate(sorted(daily.items()), 2):
        yr = ((v["total"] - v["defects"]) / v["total"] * 100) if v["total"] > 0 else 100.0
        avg_ct = sum(v["cycle_times"]) / len(v["cycle_times"]) if v["cycle_times"] else 0
        for col, val in enumerate([d, v["total"], v["defects"], round(yr, 2), round(avg_ct, 2)], 1):
            cell = ws2.cell(row=row_idx, column=col, value=val)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center")

    for col in range(1, len(summary_headers) + 1):
        ws2.column_dimensions[ws2.cell(row=1, column=col).column_letter].width = 15

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"production_report_{start_date}_{end_date}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/csv")
async def export_production_csv(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=6)),
    end_date: date = Query(default_factory=date.today),
    station_id: str | None = Query(None),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """导出生产数据CSV"""
    import csv
    from io import StringIO

    records = await _query_production_data(db, start_date, end_date, station_id)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["日期", "时段", "工位", "总产量", "缺陷数", "良率(%)", "平均节拍(s)"])

    for r in records:
        yr = ((r.total_count - r.defect_count) / r.total_count * 100) if r.total_count > 0 else 100.0
        writer.writerow([
            str(r.date), f"{r.hour}:00", r.station_id,
            r.total_count, r.defect_count,
            round(yr, 2), r.avg_cycle_time,
        ])

    content = output.getvalue().encode("utf-8-sig")  # BOM for Excel compatibility
    filename = f"production_report_{start_date}_{end_date}.csv"
    return StreamingResponse(
        BytesIO(content),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
