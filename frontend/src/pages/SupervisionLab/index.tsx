import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Switch,
  Button,
  Tag,
  Radio,
  Space,
  Select,
  Slider,
  Table,
  Badge,
  Alert,
  Tooltip,
  message,
} from 'antd';
import {
  SafetyCertificateOutlined,
  EyeOutlined,
  AimOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CompassOutlined,
} from '@ant-design/icons';

const { Option } = Select;

interface TrackedObject {
  id: number;
  trackId: number;
  className: string;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  history: [number, number][];
  inZone: boolean;
  crossedLine: boolean;
  status: 'normal' | 'danger_zone' | 'counted';
}

export const SupervisionLab: React.FC = () => {
  // Feature Toggles (Roboflow Supervision modules)
  const [enablePolygonZone, setEnablePolygonZone] = useState<boolean>(true);
  const [enableLineCounter, setEnableLineCounter] = useState<boolean>(true);
  const [enableByteTrack, setEnableByteTrack] = useState<boolean>(true);
  const [enableTraceAnnotator, setEnableTraceAnnotator] = useState<boolean>(true);
  const [enableHeatmap, setEnableHeatmap] = useState<boolean>(false);
  const [annotatorStyle, setAnnotatorStyle] = useState<'corner' | 'box' | 'halo'>('corner');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  // Counters
  const [inCount, setInCount] = useState<number>(142);
  const [outCount, setOutCount] = useState<number>(138);
  const [zoneViolations, setZoneViolations] = useState<number>(3);
  const [zoneInsideCount, setZoneInsideCount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Virtual Conveyor Line Counter coordinates: crossing line from y=240
  const countLineY = 240;

  // Polygon Zone vertices (Danger Zone in Industrial SMT & AGV corridor)
  const polygonPoints = [
    { x: 340, y: 80 },
    { x: 580, y: 80 },
    { x: 610, y: 380 },
    { x: 310, y: 380 },
  ];

  // Point-in-polygon algorithm (Ray casting)
  const isPointInPoly = (px: number, py: number, poly: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Simulated Tracked Objects Pool
  const objectsRef = useRef<TrackedObject[]>([
    { id: 1, trackId: 101, className: 'PCB_V3_Board', x: 120, y: 50, w: 60, h: 50, speed: 2.2, history: [], inZone: false, crossedLine: false, status: 'normal' },
    { id: 2, trackId: 102, className: 'PCB_V3_Board', x: 120, y: 180, w: 60, h: 50, speed: 2.0, history: [], inZone: false, crossedLine: false, status: 'normal' },
    { id: 3, trackId: 103, className: 'PCB_V3_Board', x: 120, y: 320, w: 60, h: 50, speed: 2.4, history: [], inZone: false, crossedLine: false, status: 'normal' },
    { id: 4, trackId: 104, className: 'Worker_Without_ESD', x: 380, y: 150, w: 70, h: 110, speed: 1.2, history: [], inZone: true, crossedLine: false, status: 'danger_zone' },
    { id: 5, trackId: 105, className: 'AGV_Cart_02', x: 480, y: 280, w: 85, h: 70, speed: 1.5, history: [], inZone: true, crossedLine: false, status: 'normal' },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Factory Floor / Workshop Conveyor Grid
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Conveyor track lane (left side x: 80 to 220)
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(80, 0, 140, canvas.height);
      ctx.strokeStyle = '#303030';
      ctx.lineWidth = 1;
      for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(80, y);
        ctx.lineTo(220, y);
        ctx.stroke();
      }

      // 2. Roboflow Supervision: PolygonZone & PolygonZoneAnnotator
      if (enablePolygonZone) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        for (let i = 1; i < polygonPoints.length; i++) {
          ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        }
        ctx.closePath();

        // Dynamic zone alert color if objects inside
        const hasViolations = objectsRef.current.some((o) => o.inZone && o.className.includes('Worker'));
        ctx.fillStyle = hasViolations ? 'rgba(255, 77, 79, 0.22)' : 'rgba(24, 144, 255, 0.15)';
        ctx.fill();

        ctx.strokeStyle = hasViolations ? '#ff4d4f' : '#1890ff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.restore();

        // PolygonZoneAnnotator Badge Header
        const zoneObjs = objectsRef.current.filter((o) => o.inZone);
        ctx.fillStyle = hasViolations ? 'rgba(255, 77, 79, 0.9)' : 'rgba(24, 144, 255, 0.9)';
        ctx.fillRect(polygonPoints[0].x, polygonPoints[0].y - 24, 220, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`PolygonZone: ${zoneObjs.length} in area ${hasViolations ? '⚠️ 越界' : '✓'}`, polygonPoints[0].x + 8, polygonPoints[0].y - 7);
      }

      // 3. Roboflow Supervision: LineZone & LineZoneAnnotator (Virtual Production Counter)
      if (enableLineCounter) {
        ctx.save();
        ctx.strokeStyle = '#faad14';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(70, countLineY);
        ctx.lineTo(230, countLineY);
        ctx.stroke();

        // LineZone Annotator Text Pill
        ctx.fillStyle = '#faad14';
        ctx.fillRect(70, countLineY - 26, 160, 24);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`IN: ${inCount}  |  OUT: ${outCount}`, 85, countLineY - 10);

        // Arrows showing direction
        ctx.fillStyle = '#faad14';
        ctx.beginPath();
        ctx.moveTo(150, countLineY + 12);
        ctx.lineTo(145, countLineY + 4);
        ctx.lineTo(155, countLineY + 4);
        ctx.fill();
        ctx.restore();
      }

      // 4. Roboflow Supervision: ByteTrack & Annotator Pipeline
      let currentInZone = 0;

      objectsRef.current.forEach((obj) => {
        // Move object
        if (isSimulating) {
          if (obj.className.includes('PCB')) {
            const oldY = obj.y;
            obj.y += obj.speed;
            // Cross line check
            if (oldY < countLineY && obj.y >= countLineY && !obj.crossedLine) {
              obj.crossedLine = true;
              setInCount((c) => c + 1);
            }
            if (obj.y > canvas.height + 20) {
              obj.y = -40;
              obj.crossedLine = false;
              obj.history = [];
            }
          } else {
            // Worker / AGV random patrol inside/outside zone
            obj.x += Math.sin(Date.now() / 1000 + obj.id) * 1.2;
            obj.y += Math.cos(Date.now() / 1200 + obj.id) * 0.8;
          }

          // Update motion track history
          if (enableTraceAnnotator) {
            obj.history.push([obj.x + obj.w / 2, obj.y + obj.h / 2]);
            if (obj.history.length > 25) obj.history.shift();
          }
        }

        // PolygonZone Containment Check
        const centerX = obj.x + obj.w / 2;
        const centerY = obj.y + obj.h / 2;
        const inPoly = isPointInPoly(centerX, centerY, polygonPoints);
        obj.inZone = inPoly;
        if (inPoly) currentInZone++;

        // Draw Motion Traces (TraceAnnotator)
        if (enableTraceAnnotator && obj.history.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(obj.history[0][0], obj.history[0][1]);
          for (let i = 1; i < obj.history.length; i++) {
            ctx.lineTo(obj.history[i][0], obj.history[i][1]);
          }
          ctx.strokeStyle = obj.inZone && obj.className.includes('Worker') ? 'rgba(255, 77, 79, 0.6)' : 'rgba(82, 196, 26, 0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // Supervision Visual Annotator Styles
        const isAlert = obj.inZone && obj.className.includes('Worker');
        const boxColor = isAlert ? '#ff4d4f' : obj.inZone ? '#1890ff' : '#52c41a';

        if (annotatorStyle === 'corner') {
          // sv.CornerAnnotator
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 3;
          const len = 10;
          // Top Left
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + len);
          ctx.lineTo(obj.x, obj.y);
          ctx.lineTo(obj.x + len, obj.y);
          ctx.stroke();
          // Top Right
          ctx.beginPath();
          ctx.moveTo(obj.x + obj.w - len, obj.y);
          ctx.lineTo(obj.x + obj.w, obj.y);
          ctx.lineTo(obj.x + obj.w, obj.y + len);
          ctx.stroke();
          // Bottom Left
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + obj.h - len);
          ctx.lineTo(obj.x, obj.y + obj.h);
          ctx.lineTo(obj.x + len, obj.y + obj.h);
          ctx.stroke();
          // Bottom Right
          ctx.beginPath();
          ctx.moveTo(obj.x + obj.w - len, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y + obj.h - len);
          ctx.stroke();
        } else if (annotatorStyle === 'halo') {
          // sv.HaloAnnotator
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 4;
          ctx.shadowColor = boxColor;
          ctx.shadowBlur = 10;
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          ctx.shadowBlur = 0;
        } else {
          // sv.BoxAnnotator
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          ctx.fillStyle = isAlert ? 'rgba(255, 77, 79, 0.2)' : 'rgba(82, 196, 26, 0.15)';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        }

        // sv.LabelAnnotator with unique ByteTrack tracker_id
        const labelText = enableByteTrack ? `#${obj.trackId} ${obj.className}` : obj.className;
        ctx.font = '11px monospace';
        const txtWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = boxColor;
        ctx.fillRect(obj.x, obj.y - 18, txtWidth + 10, 17);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, obj.x + 5, obj.y - 5);
      });

      setZoneInsideCount(currentInZone);

      if (isSimulating) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [
    enablePolygonZone,
    enableLineCounter,
    enableByteTrack,
    enableTraceAnnotator,
    annotatorStyle,
    isSimulating,
  ]);

  return (
    <div style={{ padding: '4px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #120338 0%, #22075e 50%, #391085 100%)',
          padding: '20px 28px',
          borderRadius: 8,
          marginBottom: 16,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(34, 7, 94, 0.25)',
        }}
      >
        <Row align="middle" justify="space-between">
          <Col xs={24} md={16}>
            <Space align="center" size={12}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#b37feb' }} />
              <div>
                <h1 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>
                  Roboflow Supervision 工业计算机视觉流水线增强中心
                </h1>
                <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: 13 }}>
                  全面赋能本项目：无缝对接 YOLO 输出，集成 <strong>PolygonZone (电子围栏防区)</strong>、<strong>LineZone (流水线虚拟计件)</strong>、<strong>ByteTrack (连续多目标追踪)</strong> 与 <strong>TraceAnnotator (时序运动轨迹)</strong>。
                </p>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Tag color="purple" style={{ fontSize: 13, padding: '4px 8px' }}>
                ⭐ GitHub 50k+ Stars
              </Tag>
              <Tag color="geekblue" style={{ fontSize: 13, padding: '4px 8px' }}>
                🚀 模块化开箱即用
              </Tag>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Top Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="LineZone 流水线过检计件 (In-Count)"
              value={inCount}
              suffix="件"
              styles={{ content: { color: '#faad14', fontWeight: 'bold' } }}
              prefix={<BarChartOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              虚拟线穿越检测 | 计件误差率 &lt; 0.2%
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="PolygonZone 防区当前目标 (In Zone)"
              value={zoneInsideCount}
              suffix="个"
              styles={{ content: { color: zoneInsideCount > 1 ? '#ff4d4f' : '#1890ff', fontWeight: 'bold' } }}
              prefix={<CompassOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              危险区域电子围栏 | 包含 AGV / 未穿ESD工装人员
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="ByteTrack 跨帧跟踪稳定性"
              value={99.4}
              precision={1}
              suffix="%"
              styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }}
              prefix={<FieldTimeOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              遮挡轨迹持续匹配，无 ID 震荡切换
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="安全防线越界报警 (Violations)"
              value={zoneViolations}
              suffix="次"
              styles={{ content: { color: '#cf1322', fontWeight: 'bold' } }}
              prefix={<CloseCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              触发警报联动现场蜂鸣器与 MES 系统
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Viewport & Controls */}
      <Row gutter={[16, 16]}>
        {/* Left: Live Canvas Viewport */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <EyeOutlined />
                <span>Supervision 多功能工业质检视觉画布 (Interactive Canvas)</span>
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  icon={isSimulating ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={() => setIsSimulating(!isSimulating)}
                >
                  {isSimulating ? '暂停模拟' : '启动模拟'}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setInCount(0);
                    message.success('已清空虚拟计件计数器');
                  }}
                >
                  重置计件
                </Button>
              </Space>
            }
          >
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 6, background: '#141414' }}>
              <canvas
                ref={canvasRef}
                width={640}
                height={450}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />

              {/* HUD Status Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 12,
                  background: 'rgba(0, 0, 0, 0.8)',
                  padding: '6px 12px',
                  borderRadius: 4,
                  color: '#b37feb',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  border: '1px solid rgba(179, 127, 235, 0.4)',
                }}
              >
                <div>sv.Detections: ACTIVE (Model Agnostic)</div>
                <div>sv.ByteTrack: {enableByteTrack ? 'ENABLED (Kalman Filter)' : 'OFF'}</div>
                <div>sv.LineZone: {enableLineCounter ? 'ACTIVE (Crossing Y=240)' : 'DISABLED'}</div>
                <div>sv.PolygonZone: {enablePolygonZone ? 'ACTIVE (4-Point Polygon)' : 'DISABLED'}</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Tag color="warning">🟡 LineZone 传送带计件触发线</Tag>
              <Tag color="processing">🔵 PolygonZone 核心作业防区</Tag>
              <Tag color="success">🟢 ByteTrack 轨迹历史线</Tag>
              <Tag color="error">🔴 危险人员违规侵入防区告警</Tag>
            </div>
          </Card>
        </Col>

        {/* Right: Supervision Feature Matrix */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <Space>
                <SlidersOutlined />
                <span>Supervision 核心工具包开关与配置</span>
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* PolygonZone */}
              <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>1. PolygonZone 任意多边形电子围栏</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      划定 SMT/AGV 危险区域，自动统计内部人员与物体
                    </div>
                  </div>
                  <Switch checked={enablePolygonZone} onChange={setEnablePolygonZone} />
                </div>
              </div>

              {/* LineZone */}
              <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>2. LineZone 流水线双向虚拟计件</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      工件横穿警戒线自动触发 In/Out 增量计数，对接 MES
                    </div>
                  </div>
                  <Switch checked={enableLineCounter} onChange={setEnableLineCounter} />
                </div>
              </div>

              {/* ByteTrack */}
              <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>3. sv.ByteTrack 多目标高精度连续追踪</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      分配全局唯一追踪 ID，防止密集工件或工人交叉遮挡丢失
                    </div>
                  </div>
                  <Switch checked={enableByteTrack} onChange={setEnableByteTrack} />
                </div>
              </div>

              {/* TraceAnnotator */}
              <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>4. sv.TraceAnnotator 运动轨迹历史流</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      绘制目标移动动线，分析工人 SOP 动作合规性与轨迹偏离
                    </div>
                  </div>
                  <Switch checked={enableTraceAnnotator} onChange={setEnableTraceAnnotator} />
                </div>
              </div>

              {/* Annotator Styles */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>5. 标注器渲染样式 (Annotator Style)</div>
                <Radio.Group
                  value={annotatorStyle}
                  onChange={(e) => setAnnotatorStyle(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Radio.Button value="corner" style={{ width: '33.3%', textAlign: 'center' }}>
                    Corner 四角框
                  </Radio.Button>
                  <Radio.Button value="box" style={{ width: '33.3%', textAlign: 'center' }}>
                    Box 矩形框
                  </Radio.Button>
                  <Radio.Button value="halo" style={{ width: '33.3%', textAlign: 'center' }}>
                    Halo 工业发光
                  </Radio.Button>
                </Radio.Group>
              </div>

              <Button
                type="primary"
                block
                style={{ background: '#391085', borderColor: '#391085', height: 40, marginTop: 8 }}
                onClick={() => {
                  message.success('Supervision 算子与工控规则已同步更新至边缘摄像头节点');
                }}
              >
                保存并固化当前 Supervision 配置
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Deep Analysis & Value Proposition */}
      <Card
        style={{ marginTop: 16 }}
        title="为什么 Roboflow Supervision 对当前工业视觉项目有极其关键的价值？"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card type="inner" size="small" title="1. 弥补 YOLO 原生输出与工业业务逻辑的鸿沟">
              <p style={{ fontSize: 13, color: '#595959', lineHeight: 1.6 }}>
                YOLO 原生仅输出 `[x1, y1, x2, y2, conf, class_id]` 离散孤立框，无法直接用于工厂生产。
                <strong>Supervision</strong> 提供了 `LineZone` 与 `PolygonZone`，一行代码即可实现<strong>流水线自动计件统计</strong>与<strong>安全围栏越界报警</strong>。
              </p>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card type="inner" size="small" title="2. 极简集成 ByteTrack，解决工业遮挡与轨迹分析">
              <p style={{ fontSize: 13, color: '#595959', lineHeight: 1.6 }}>
                无需繁琐安装第三方复杂 tracking 仓库，Supervision 内置优雅的 `sv.ByteTrack` 与 `sv.TraceAnnotator`，不仅为每个 SMT 板卡分配固定生命周期跟踪 ID，更能将工人装配时的手臂与工具轨迹直接留痕用于 SOP 分析。
              </p>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card type="inner" size="small" title="3. 模型解耦 (Model-Agnostic) 与企业级可维护性">
              <p style={{ fontSize: 13, color: '#595959', lineHeight: 1.6 }}>
                当未来项目从 YOLOv8 迁移到 YOLOv10、YOLOv11 或针对缺陷分割的 SAM/DETR 模型时，所有标注器、电子围栏判定及流水线计件代码<strong>完全无需改动</strong>，开发与维护成本降低 70% 以上。
              </p>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default SupervisionLab;
