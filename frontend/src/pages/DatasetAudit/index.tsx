import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  InputNumber,
  List,
  Row,
  Slider,
  Space,
  Statistic,
  Tabs,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScissorOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

/** 类别渲染色板（框颜色按 classId 取色） */
const CLASS_COLORS = ['#f5222d', '#fa8c16', '#faad14', '#a0d911', '#13c2c2', '#1890ff', '#722ed1', '#eb2f96', '#8c8c8c', '#2f54eb'];

interface AuditLine {
  lineNumber: number;
  rawText: string;
  classId: number | null;
  className: string | null;
  cx: number | null;
  cy: number | null;
  w: number | null;
  h: number | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface AuditSummary {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  blocked: boolean;
}

interface AuditResult {
  items: AuditLine[];
  summary: AuditSummary;
}

interface LabelBox {
  lineIndex: number; // labelText 中的行号（0 基）
  classId: number;
  confidence: number; // 可选第 6 字段，缺省 1
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const f4 = (v: number) => v.toFixed(4);

/** 解析 YOLO 标注文本为框列表（支持可选第 6 列置信度） */
const parseLabelBoxes = (text: string): LabelBox[] => {
  const boxes: LabelBox[] = [];
  text.split('\n').forEach((rawLine, lineIndex) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const commentIdx = trimmed.indexOf('#');
    const dataPart = commentIdx !== -1 ? trimmed.slice(0, commentIdx).trim() : trimmed;
    const parts = dataPart.split(/\s+/);
    if (parts.length < 5) return;
    const classId = parseInt(parts[0], 10);
    const cx = parseFloat(parts[1]);
    const cy = parseFloat(parts[2]);
    const w = parseFloat(parts[3]);
    const h = parseFloat(parts[4]);
    if ([classId, cx, cy, w, h].some((v) => Number.isNaN(v))) return;
    const confidence = parts.length >= 6 ? parseFloat(parts[5]) : 1;
    boxes.push({
      lineIndex,
      classId,
      confidence: Number.isNaN(confidence) ? 1 : confidence,
      cx, cy, w, h,
    });
  });
  return boxes;
};

const downloadTextFile = (content: string, filename: string, mime = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const DatasetAudit: React.FC = () => {
  const { t } = useTranslation();

  const [labelText, setLabelText] = useState(
    '0 0.5425 0.4817 1.0850 0.5833\n1 0.5125 -0.6200 0.2850 0.5183\n99 0.7200 0.3817 -0.1150 0.2833\n2 0.4500 0.5500 0.0000 0.1200\n\n# 在此粘贴或编辑 YOLO 标注 (class_id cx cy w h)\n3 0.6100 0.4200 0.1850 0.2210\n'
  );
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [numClasses, setNumClasses] = useState(10);
  const [classNamesInput, setClassNamesInput] = useState('');
  const [fixing, setFixing] = useState(false);

  // 画布状态
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [confThreshold, setConfThreshold] = useState(0.1);
  const [hiddenClasses, setHiddenClasses] = useState<number[]>([]);
  const [zoom, setZoom] = useState(1);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [activeClassId, setActiveClassId] = useState(0);
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // 防抖调用后端体检引擎
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!labelText.trim()) {
        setAudit(null);
        return;
      }
      setAuditing(true);
      try {
        const res = await api.post('/dataset-audit/audit', { text: labelText, num_classes: numClasses });
        setAudit(res.data);
      } catch {
        /* 忽略瞬时错误，保留上一次结果 */
      } finally {
        setAuditing(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [labelText, numClasses]);

  const boxes = useMemo(() => parseLabelBoxes(labelText), [labelText]);
  const presentClassIds = useMemo(
    () => Array.from(new Set(boxes.map((b) => b.classId))).sort((a, b) => a - b),
    [boxes]
  );
  const visibleBoxes = useMemo(
    () =>
      boxes.filter(
        (b) =>
          !hiddenClasses.includes(b.classId) &&
          b.confidence >= confThreshold
      ),
    [boxes, hiddenClasses, confThreshold]
  );

  const uploadProps = {
    beforeUpload(file: File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) setLabelText(e.target.result as string);
      };
      reader.readAsText(file);
      return false;
    },
    showUploadList: false,
  };

  const handleAutoFix = async () => {
    setFixing(true);
    try {
      const res = await api.post('/dataset-audit/fix', { text: labelText, num_classes: numClasses });
      const { fixed_text, audit_before, audit_after } = res.data;
      setLabelText(fixed_text);
      message.success(
        t('pages.datasetAudit.fixDone', {
          before: `${audit_before.errors}/${audit_before.warnings}`,
          after: `${audit_after.errors}/${audit_after.warnings}`,
        })
      );
    } catch {
      message.error(t('pages.datasetAudit.fixFailed'));
    } finally {
      setFixing(false);
    }
  };

  const handleExportClean = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(labelText, `dataset_clean_${date}.txt`);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(labelText);
      message.success(t('pages.datasetAudit.copied'));
    } catch {
      message.error(t('pages.datasetAudit.copyFailed'));
    }
  };

  const handleGenerateYaml = async () => {
    const names: Record<number, string> = {};
    const source = presentClassIds.length > 0 ? presentClassIds : [0];
    const inputNames = classNamesInput.split(',').map((s) => s.trim()).filter(Boolean);
    source.forEach((cid, idx) => {
      names[cid] = inputNames[idx] || `class_${cid}`;
    });
    try {
      const res = await api.post('/dataset-audit/data-yaml', { class_names: names });
      downloadTextFile(res.data.yaml, 'data.yaml', 'text/yaml;charset=utf-8');
      message.success(t('pages.datasetAudit.yamlDone'));
    } catch {
      message.error(t('pages.datasetAudit.yamlFailed'));
    }
  };

  const handleExportLabels = () => {
    // 只导出当前过滤后可见的框（与原型行为一致）
    const lines = visibleBoxes.map(
      (b) => `${b.classId} ${f4(b.cx)} ${f4(b.cy)} ${f4(b.w)} ${f4(b.h)}${b.confidence < 1 ? ` ${b.confidence.toFixed(4)}` : ''}`
    );
    downloadTextFile(lines.join('\n') + (lines.length ? '\n' : ''), 'labels.txt');
    message.success(t('pages.datasetAudit.labelsExported', { count: lines.length }));
  };

  // ============ 画布交互（移植原型 Phase3 拖拽几何） ============

  const pointFromEvent = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pt = pointFromEvent(e);
    if (!pt) return;
    draggingRef.current = true;
    setSelectedLine(null);
    setDraft({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current || !draft) return;
    const pt = pointFromEvent(e);
    if (!pt) return;
    setDraft({ ...draft, x2: pt.x, y2: pt.y });
  };

  const handleCanvasMouseUp = () => {
    if (!draggingRef.current || !draft) return;
    draggingRef.current = false;
    const bx = Math.min(draft.x1, draft.x2);
    const by = Math.min(draft.y1, draft.y2);
    const bw = Math.abs(draft.x2 - draft.x1);
    const bh = Math.abs(draft.y2 - draft.y1);
    setDraft(null);
    // 小于 0.02 的框视为误触丢弃（与原型一致）
    if (bw <= 0.02 || bh <= 0.02) return;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const newLine = `${activeClassId} ${f4(cx)} ${f4(cy)} ${f4(bw)} ${f4(bh)}`;
    setLabelText((prev) => (prev.endsWith('\n') || prev === '' ? prev + newLine + '\n' : prev + '\n' + newLine + '\n'));
    message.success(t('pages.datasetAudit.boxAdded'));
  };

  const deleteBox = (lineIndex: number) => {
    setLabelText((prev) => prev.split('\n').filter((_, i) => i !== lineIndex).join('\n'));
    setSelectedLine(null);
  };

  const summary = audit?.summary;
  const classColor = (cid: number) => CLASS_COLORS[cid % CLASS_COLORS.length];

  const renderTextAudit = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('pages.datasetAudit.totalLines')} value={summary?.total ?? 0} prefix={<FileTextOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('pages.datasetAudit.validLines')} value={summary?.valid ?? 0} styles={{ content: { color: '#3f8600' } }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('pages.datasetAudit.errorLines')} value={summary?.errors ?? 0} styles={{ content: { color: '#cf1322' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('pages.datasetAudit.warningLines')} value={summary?.warnings ?? 0} styles={{ content: { color: '#faad14' } }} /></Card></Col>
      </Row>

      {summary?.blocked && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('pages.datasetAudit.blockedTitle')}
          description={t('pages.datasetAudit.blockedDesc')}
        />
      )}
      {!summary?.blocked && summary && summary.total > 0 && (
        <Alert type="success" showIcon style={{ marginBottom: 16 }} message={t('pages.datasetAudit.allGood')} />
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Card
            size="small"
            title={t('pages.datasetAudit.editorTitle')}
            extra={
              <Space size="small" wrap>
                <Upload {...uploadProps}>
                  <Button size="small" icon={<DownloadOutlined />}>{t('pages.datasetAudit.uploadTxt')}</Button>
                </Upload>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => setLabelText('')}></Button>
              </Space>
            }
          >
            <Input.TextArea
              rows={18}
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder={t('pages.datasetAudit.inputPlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={t('pages.datasetAudit.reportTitle')} loading={auditing && !audit}>
            <List
              size="small"
              dataSource={audit?.items || []}
              style={{ maxHeight: 420, overflow: 'auto' }}
              renderItem={(item) => (
                <List.Item
                  style={{
                    display: 'block',
                    padding: '6px 8px',
                    marginBottom: 6,
                    borderRadius: 6,
                    background: item.errors.length ? '#fff1f0' : item.warnings.length ? '#fffbe6' : '#f6ffed',
                    border: `1px solid ${item.errors.length ? '#ffa39e' : item.warnings.length ? '#ffe58f' : '#b7eb8f'}`,
                  }}
                >
                  <Space size={6} wrap>
                    <Tag>{t('pages.datasetAudit.line')} {item.lineNumber}</Tag>
                    {item.classId !== null && (
                      <Tag color={classColor(item.classId)}>
                        {t('pages.datasetAudit.class')} {item.classId}{item.className ? ` · ${item.className}` : ''}
                      </Tag>
                    )}
                    {item.isValid && !item.warnings.length && <Tag color="green">{t('pages.datasetAudit.pass')}</Tag>}
                    {item.errors.map((err, i) => <Tag key={`e${i}`} color="red">{err}</Tag>)}
                    {item.warnings.map((w, i) => <Tag key={`w${i}`} color="orange">{w}</Tag>)}
                  </Space>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#888', marginTop: 2 }}>{item.rawText}</div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderCanvas = () => (
    <Row gutter={16}>
      <Col span={16}>
        <Card
          size="small"
          title={t('pages.datasetAudit.canvasTitle')}
          extra={
            <Space size="small">
              <Tooltip title={t('pages.datasetAudit.zoomOut')}>
                <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))} />
              </Tooltip>
              <span style={{ fontSize: 12 }}>{Math.round(zoom * 100)}%</span>
              <Tooltip title={t('pages.datasetAudit.zoomIn')}>
                <Button size="small" icon={<ZoomInOutlined />} onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))} />
              </Tooltip>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  setImageUrl(URL.createObjectURL(file));
                  return false;
                }}
              >
                <Button size="small" icon={<PictureOutlined />}>{t('pages.datasetAudit.uploadImage')}</Button>
              </Upload>
            </Space>
          }
        >
          <div style={{ overflow: 'auto', maxHeight: 520, background: '#111', borderRadius: 6 }}>
            <div
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4 / 3',
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                cursor: 'crosshair',
                background: imageUrl ? `url(${imageUrl}) center/contain no-repeat` : '#222',
              }}
            >
              {visibleBoxes.map((b) => {
                const selected = selectedLine === b.lineIndex;
                return (
                  <div
                    key={b.lineIndex}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedLine(b.lineIndex);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${(b.cx - b.w / 2) * 100}%`,
                      top: `${(b.cy - b.h / 2) * 100}%`,
                      width: `${b.w * 100}%`,
                      height: `${b.h * 100}%`,
                      border: `2px solid ${classColor(b.classId)}`,
                      boxShadow: selected ? '0 0 0 2px #fff' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute', top: -18, left: -2, fontSize: 10, color: '#fff',
                        background: classColor(b.classId), padding: '0 4px', borderRadius: 2, whiteSpace: 'nowrap',
                      }}
                    >
                      {b.classId} {(b.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
              {draft && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min(draft.x1, draft.x2) * 100}%`,
                    top: `${Math.min(draft.y1, draft.y2) * 100}%`,
                    width: `${Math.abs(draft.x2 - draft.x1) * 100}%`,
                    height: `${Math.abs(draft.y2 - draft.y1) * 100}%`,
                    border: '2px dashed #fff',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {!imageUrl && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#888', fontSize: 13, pointerEvents: 'none',
                }}>
                  {t('pages.datasetAudit.canvasHint')}
                </div>
              )}
            </div>
          </div>
        </Card>
      </Col>
      <Col span={8}>
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" title={t('pages.datasetAudit.filtersTitle')}>
            <Space orientation="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  {t('pages.datasetAudit.confLabel')}: {(confThreshold * 100).toFixed(0)}%
                </div>
                <Slider min={10} max={95} value={Math.round(confThreshold * 100)} onChange={(v) => setConfThreshold(v / 100)} />
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{t('pages.datasetAudit.classFilter')}</div>
                {presentClassIds.length === 0 && <span style={{ color: '#999', fontSize: 12 }}>{t('pages.datasetAudit.noClasses')}</span>}
                <Checkbox.Group
                  value={presentClassIds.filter((cid) => !hiddenClasses.includes(cid))}
                  onChange={(checked) => setHiddenClasses(presentClassIds.filter((cid) => !checked.includes(cid)))}
                  options={presentClassIds.map((cid) => ({
                    value: cid,
                    label: <span style={{ color: classColor(cid) }}>{t('pages.datasetAudit.class')} {cid}</span>,
                  }))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12 }}>{t('pages.datasetAudit.newBoxClass')}</span>
                <InputNumber min={0} max={numClasses - 1} value={activeClassId} onChange={(v) => setActiveClassId(v ?? 0)} size="small" />
                <Tag color={classColor(activeClassId)}>{activeClassId}</Tag>
              </div>
              <Button type="primary" ghost icon={<PlusOutlined />} onClick={handleExportLabels}>
                {t('pages.datasetAudit.exportLabels', { count: visibleBoxes.length })}
              </Button>
              <div style={{ fontSize: 12, color: '#999' }}>{t('pages.datasetAudit.canvasUsage')}</div>
            </Space>
          </Card>
          {selectedLine !== null && (() => {
            const b = boxes.find((x) => x.lineIndex === selectedLine);
            if (!b) return null;
            return (
              <Card
                size="small"
                title={t('pages.datasetAudit.selectedBox')}
                extra={<Button size="small" danger onClick={() => deleteBox(b.lineIndex)}>{t('pages.datasetAudit.deleteBox')}</Button>}
              >
                <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                  <Tag color={classColor(b.classId)}>{t('pages.datasetAudit.class')} {b.classId}</Tag>
                  <span style={{ fontSize: 12 }}>conf: {(b.confidence * 100).toFixed(1)}%</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    center: ({f4(b.cx)}, {f4(b.cy)}) · size: ({f4(b.w)}, {f4(b.h)})
                  </span>
                </Space>
              </Card>
            );
          })()}
        </Space>
      </Col>
    </Row>
  );

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space wrap>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{t('pages.datasetAudit.title')}</span>
              <span style={{ color: '#999', fontSize: 12 }}>{t('pages.datasetAudit.subtitle')}</span>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <span style={{ fontSize: 12 }}>{t('pages.datasetAudit.numClasses')}</span>
              <InputNumber min={0} max={500} value={numClasses} onChange={(v) => setNumClasses(v ?? 10)} size="small" />
              <Tooltip title={t('pages.datasetAudit.classNamesHint')}>
                <Input
                  size="small"
                  style={{ width: 220 }}
                  value={classNamesInput}
                  onChange={(e) => setClassNamesInput(e.target.value)}
                  placeholder={t('pages.datasetAudit.classNamesPlaceholder')}
                />
              </Tooltip>
              <Button type="primary" icon={<ScissorOutlined />} loading={fixing} onClick={handleAutoFix} disabled={!labelText.trim()}>
                {t('pages.datasetAudit.autoFix')}
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportClean} disabled={!labelText.trim()}>
                {t('pages.datasetAudit.exportClean')}
              </Button>
              <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!labelText.trim()}>
                {t('pages.datasetAudit.copy')}
              </Button>
              <Button icon={<FileTextOutlined />} onClick={handleGenerateYaml} disabled={!labelText.trim()}>
                {t('pages.datasetAudit.generateYaml')}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Tabs
        defaultActiveKey="text"
        items={[
          { key: 'text', label: t('pages.datasetAudit.tabText'), children: renderTextAudit() },
          { key: 'canvas', label: t('pages.datasetAudit.tabCanvas'), children: renderCanvas() },
        ]}
      />
    </div>
  );
};

export default DatasetAudit;
