import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Button,
  Tag,
  Slider,
  Switch,
  Table,
  Badge,
  Alert,
  Tooltip,
  Progress,
  Space,
  Radio,
  message,
} from 'antd';
import {
  ThunderboltOutlined,
  EyeOutlined,
  AimOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SlidersOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  ScanOutlined,
  FieldTimeOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../../utils/api';

const { Option } = Select;

// THT (Through-Hole Technology) Wave Soldering Joint Defect Interface
interface THTJointDefect {
  id: string;
  name: string;
  category: 'critical' | 'major' | 'minor';
  ipcStandard: string; // IPC-A-610G Chapter 8 (Through-Hole Solder Joints)
  pinDesignation: string; // e.g., J1 Power Pin 2, Transformer T1 Leg 4
  x: number;
  y: number;
  r: number; // circular through-hole solder fillet radius
  holeFillPct: number; // PTH vertical barrel hole fill % (IPC Class 3 requires >= 75%)
  leadProtrusionMm: number; // Pin protrusion length (ideal 0.5mm - 2.5mm)
  circumferentialWettingDeg: number; // 360 degree wetting (IPC Class 3 requires >= 330°)
  solderIcicleLengthMm?: number; // 拉尖/锡尖长度
  confidence: number;
  algorithmDetectedBy: 'TPVG-YOLO (Pin Focus)' | 'β-VAE (Anomaly)' | 'YOLO11-THT';
  status: 'rejected' | 'accepted' | 'rework_needed';
}

const WAVE_SOLDER_BOARDS = [
  {
    id: 'tht_power_board',
    name: '工业电源大功率插件板 (Wave Solder Unit 01)',
    conveyorSpeed: '1.2 m/min',
    solderPotTemp: '258 °C',
    fluxType: '免清洗松香水 (No-Clean)',
    joints: [
      {
        id: 'tht-01',
        name: '通孔透锡量不足 (Insufficient Hole Fill 45%)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.1',
        pinDesignation: 'Transformer T1 - Pin 3',
        x: 180,
        y: 160,
        r: 22,
        holeFillPct: 45,
        leadProtrusionMm: 1.8,
        circumferentialWettingDeg: 190,
        confidence: 0.962,
        algorithmDetectedBy: 'TPVG-YOLO (Pin Focus)',
        status: 'rejected',
      },
      {
        id: 'tht-02',
        name: '波峰拉尖/锡柱冰锥 (Solder Icicles / Flags)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.5',
        pinDesignation: 'Filter Choke L2 - Pin 1',
        x: 320,
        y: 190,
        r: 20,
        holeFillPct: 85,
        leadProtrusionMm: 2.1,
        circumferentialWettingDeg: 340,
        solderIcicleLengthMm: 3.4, // Over IPC 1.5mm max limit
        confidence: 0.978,
        algorithmDetectedBy: 'β-VAE (Anomaly)',
        status: 'rework_needed',
      },
      {
        id: 'tht-03',
        name: '相邻引脚锡桥短路 (THT Lead Bridging)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 8.3.5.7',
        pinDesignation: 'Connector J1 (Pins 4-5)',
        x: 450,
        y: 220,
        r: 24,
        holeFillPct: 100,
        leadProtrusionMm: 1.5,
        circumferentialWettingDeg: 360,
        confidence: 0.985,
        algorithmDetectedBy: 'YOLO11-THT',
        status: 'rejected',
      },
      {
        id: 'tht-04',
        name: '引脚出锡过长 (Lead Protrusion Over-Limit)',
        category: 'minor',
        ipcStandard: 'IPC-A-610G 8.3.2.1',
        pinDesignation: 'Relay K1 - Coil 2',
        x: 230,
        y: 310,
        r: 18,
        holeFillPct: 90,
        leadProtrusionMm: 3.8, // Over IPC 2.5mm max limit
        circumferentialWettingDeg: 350,
        confidence: 0.912,
        algorithmDetectedBy: 'TPVG-YOLO (Pin Focus)',
        status: 'rework_needed',
      },
      {
        id: 'tht-05',
        name: '润湿圆周不全与吹孔 (Blowholes & Pinholes)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 8.3.5.4',
        pinDesignation: 'Electrolytic Cap C1 - Neg Pin',
        x: 380,
        y: 330,
        r: 20,
        holeFillPct: 65,
        leadProtrusionMm: 1.4,
        circumferentialWettingDeg: 240,
        confidence: 0.934,
        algorithmDetectedBy: 'β-VAE (Anomaly)',
        status: 'rework_needed',
      },
    ] as THTJointDefect[],
  },
];

export const WaveSolderInspectionLab: React.FC = () => {
  const [selectedBoardId, setSelectedBoardId] = useState<string>('tht_power_board');
  const [algorithmMode, setAlgorithmMode] = useState<'yolo_tpvg' | 'bvae_anomaly' | 'hybrid'>('hybrid');
  const [minHoleFillThreshold, setMinHoleFillThreshold] = useState<number>(75); // IPC Class 3 requires 75%
  const [enable3DHeightReconstruction, setEnable3DHeightReconstruction] = useState<boolean>(true);
  const [enableCircumferentialArcScan, setEnableCircumferentialArcScan] = useState<boolean>(true);
  const [enableIcicleDetection, setEnableIcicleDetection] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentBoard = WAVE_SOLDER_BOARDS[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. PCB Backside Wave Soldering Mask Layer (Substrate & Traces)
    const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGrad.addColorStop(0, '#001d3d');
    bgGrad.addColorStop(1, '#000814');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid representing wave flow tracks (Z-Axis travel from left to right)
    ctx.strokeStyle = 'rgba(0, 119, 182, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // 2. Normal Qualified THT Solder Fillets (Class 3 Conical Fillets with 360° Wetting)
    const normalGrid = [
      { x: 100, y: 100 }, { x: 100, y: 180 }, { x: 100, y: 260 }, { x: 100, y: 340 },
      { x: 260, y: 100 }, { x: 260, y: 230 }, { x: 380, y: 100 }, { x: 450, y: 100 },
      { x: 520, y: 180 }, { x: 520, y: 280 }, { x: 520, y: 360 }, { x: 300, y: 380 },
    ];

    normalGrid.forEach((p) => {
      // Draw outer copper annular ring
      ctx.fillStyle = '#b08968';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fill();

      // Draw metallic wave solder joint (bright shiny fillet with concave slope)
      const filletGrad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 20);
      filletGrad.addColorStop(0, '#ffffff');
      filletGrad.addColorStop(0.3, '#ced4da');
      filletGrad.addColorStop(0.8, '#6c757d');
      filletGrad.addColorStop(1, '#343a40');

      ctx.fillStyle = filletGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fill();

      // Center through-hole lead pin
      ctx.fillStyle = '#212529';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#52c41a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 3. Render THT Wave Soldering Defects
    currentBoard.joints.forEach((d) => {
      const isCritical = d.category === 'critical';
      const color = isCritical ? '#ff4d4f' : d.category === 'major' ? '#faad14' : '#1890ff';

      // Outer target reticle
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Pad anomaly representation
      if (d.name.includes('拉尖') && enableIcicleDetection) {
        // Draw solder icicle protruding downwards
        ctx.fillStyle = '#ced4da';
        ctx.beginPath();
        ctx.moveTo(d.x - 6, d.y);
        ctx.lineTo(d.x + 6, d.y);
        ctx.lineTo(d.x, d.y + 36); // Icicle tip
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Length indicator
        ctx.fillStyle = '#ff7875';
        ctx.font = '10px monospace';
        ctx.fillText(`拉尖: ${d.solderIcicleLengthMm}mm (>1.5mm超标)`, d.x + 12, d.y + 25);
      } else if (d.name.includes('短路')) {
        // Draw bridging bar between pins
        ctx.fillStyle = '#ff4d4f';
        ctx.fillRect(d.x - 10, d.y - 8, 55, 16);
      } else if (d.name.includes('不足')) {
        // Hollow incomplete fillet
        ctx.strokeStyle = '#faad14';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI);
        ctx.stroke();
      }

      // 3D Height / Fill Arc Scanning Layer
      if (enableCircumferentialArcScan) {
        ctx.save();
        ctx.strokeStyle = d.circumferentialWettingDeg < 330 ? '#ff4d4f' : '#52c41a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const endRad = (d.circumferentialWettingDeg / 360) * Math.PI * 2;
        ctx.arc(d.x, d.y, d.r + 14, 0, endRad);
        ctx.stroke();
        ctx.restore();
      }

      // Title & Annotation HUD Tag
      const label = `${d.pinDesignation} · ${d.name}`;
      ctx.font = 'bold 11px sans-serif';
      const w = ctx.measureText(label).width;

      ctx.fillStyle = color;
      ctx.fillRect(d.x - 10, d.y - d.r - 28, w + 16, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, d.x - 4, d.y - d.r - 14);

      // Algorithm Badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(d.x - 10, d.y + d.r + 14, 155, 18);
      ctx.fillStyle = '#69c0ff';
      ctx.font = '10px monospace';
      ctx.fillText(`透锡: ${d.holeFillPct}% | ${d.algorithmDetectedBy}`, d.x - 6, d.y + d.r + 27);
    });
  }, [
    selectedBoardId,
    algorithmMode,
    minHoleFillThreshold,
    enable3DHeightReconstruction,
    enableCircumferentialArcScan,
    enableIcicleDetection,
  ]);

  // IPC-A-610G Chapter 8 Hole Fill Distribution Chart
  const holeFillChartOption = {
    title: {
      text: '波峰焊通孔透锡量 (PTH Hole Fill %) 遵从性分布',
      left: 'center',
      textStyle: { fontSize: 13 },
    },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['100% 满透 (完美)', '85-99% (Class 3 标准)', '75-84% (Class 2 标准)', '<75% (不合格拒收)'],
    },
    yAxis: { type: 'value', name: '引脚数 (Pins)' },
    series: [
      {
        data: [
          { value: 68, itemStyle: { color: '#52c41a' } },
          { value: 24, itemStyle: { color: '#73d13d' } },
          { value: 8, itemStyle: { color: '#faad14' } },
          { value: currentBoard.joints.filter((j) => j.holeFillPct < 75).length, itemStyle: { color: '#ff4d4f' } },
        ],
        type: 'bar',
        barWidth: '40%',
      },
    ],
  };

  const columns = [
    {
      title: '引脚位号与名称',
      dataIndex: 'pinDesignation',
      key: 'pinDesignation',
      render: (t: string, r: THTJointDefect) => (
        <Space orientation="vertical" size={2}>
          <span style={{ fontWeight: 600 }}>{t}</span>
          <span style={{ fontSize: 12, color: '#cf1322' }}>{r.name}</span>
        </Space>
      ),
    },
    {
      title: '透锡率 (PTH Fill)',
      dataIndex: 'holeFillPct',
      key: 'holeFillPct',
      render: (v: number) => (
        <Space orientation="vertical" size={2} style={{ width: 100 }}>
          <Progress
            percent={v}
            size="small"
            status={v < 75 ? 'exception' : 'success'}
            strokeColor={v < 75 ? '#ff4d4f' : '#52c41a'}
          />
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>标准 ≥75%</span>
        </Space>
      ),
    },
    {
      title: '圆周润湿角',
      dataIndex: 'circumferentialWettingDeg',
      key: 'circumferentialWettingDeg',
      render: (deg: number) => (
        <Tag color={deg >= 330 ? 'green' : 'red'}>
          {deg}° / 360° {deg >= 330 ? '合格' : '不全'}
        </Tag>
      ),
    },
    {
      title: '引脚伸出长度',
      dataIndex: 'leadProtrusionMm',
      key: 'leadProtrusionMm',
      render: (l: number, r: THTJointDefect) => (
        <span>
          {l} mm {r.solderIcicleLengthMm ? <Tag color="error">拉尖+{r.solderIcicleLengthMm}mm</Tag> : null}
        </span>
      ),
    },
    {
      title: '识别算法来源',
      dataIndex: 'algorithmDetectedBy',
      key: 'algorithmDetectedBy',
      render: (algo: string) => <Tag color="geekblue">{algo}</Tag>,
    },
    {
      title: '处置状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        if (s === 'rejected') return <Tag color="error">报废下线</Tag>;
        if (s === 'rework_needed') return <Tag color="warning">波峰焊补锡</Tag>;
        return <Tag color="success">放行</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: '4px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #001529 0%, #003a8c 50%, #061178 100%)',
          padding: '20px 28px',
          borderRadius: 8,
          marginBottom: 16,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0, 21, 41, 0.3)',
        }}
      >
        <Row align="middle" justify="space-between">
          <Col xs={24} md={16}>
            <Space align="center" size={12}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#40a9ff' }} />
              <div>
                <h1 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>
                  波峰焊接质量智能评价与质检中心 (Wave Soldering AOI Evaluation)
                </h1>
                <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: 13 }}>
                  针对通孔插装 (THT) 波峰焊工艺：汲取 GitHub 顶会与开源项目 <strong>TPVG-YOLO (通孔焊点双层视锥)</strong> 与 <strong>$\beta$-VAE 无监督焊点自编码异常检测</strong>，彻底攻克<strong>透锡量不足 (&lt;75%)、波峰拉尖/锡柱、引脚锡桥短路及吹孔气泡</strong>。
                </p>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Tag color="cyan" style={{ fontSize: 13, padding: '4px 8px' }}>
                🌊 锡槽温度: {currentBoard.solderPotTemp}
              </Tag>
              <Tag color="blue" style={{ fontSize: 13, padding: '4px 8px' }}>
                🚀 链速: {currentBoard.conveyorSpeed}
              </Tag>
            </Space>
          </Col>
        </Row>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="波峰焊通过率 (Wave FPY)"
              value={96.4}
              precision={1}
              suffix="%"
              styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              IPC Class 3 严格标准 (透锡量≥75%)
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="透锡不良检出 (Low Fill Holes)"
              value={currentBoard.joints.filter((j) => j.holeFillPct < 75).length}
              suffix="孔"
              styles={{ content: { color: '#ff4d4f', fontWeight: 'bold' } }}
              prefix={<CloseCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              通孔毛细爬锡高度未达 75% 门槛
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="拉尖与锡柱异常 (Icicles)"
              value={currentBoard.joints.filter((j) => j.solderIcicleLengthMm).length}
              suffix="处"
              styles={{ content: { color: '#fa8c16', fontWeight: 'bold' } }}
              prefix={<WarningOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              脱锡剥离不良导致机械干涉隐患
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="TPVG-YOLO 插件引脚定点识别耗时"
              value={16.2}
              precision={1}
              suffix="ms"
              styles={{ content: { color: '#1890ff', fontWeight: 'bold' } }}
              prefix={<ThunderboltOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              双层视锥约束后处理加速 4.2x
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Viewport & Controls */}
      <Row gutter={[16, 16]}>
        {/* Left: THT Wave Solder Viewport */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <EyeOutlined />
                <span>波峰焊背板微观光学质检视口 (THT Bottom Wave Viewport)</span>
                <Tag color="cyan">IPC-A-610G Chapter 8</Tag>
              </Space>
            }
            extra={
              <Space>
                <Radio.Group
                  size="small"
                  value={algorithmMode}
                  onChange={(e) => setAlgorithmMode(e.target.value)}
                >
                  <Radio.Button value="hybrid">混合智能体</Radio.Button>
                  <Radio.Button value="yolo_tpvg">TPVG-YOLO</Radio.Button>
                  <Radio.Button value="bvae_anomaly">$\beta$-VAE 异常自检</Radio.Button>
                </Radio.Group>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => message.success('已刷新波峰焊AOI相机图像')}
                >
                  采样刷新
                </Button>
              </Space>
            }
          >
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 6, background: '#000814' }}>
              <canvas
                ref={canvasRef}
                width={640}
                height={430}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />

              {/* Viewport Info Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 12,
                  background: 'rgba(0, 8, 20, 0.85)',
                  padding: '6px 12px',
                  borderRadius: 4,
                  color: '#40a9ff',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  border: '1px solid rgba(64, 169, 255, 0.4)',
                }}
              >
                <div>WAVE SOLDER INSPECTION ENGINE: {algorithmMode.toUpperCase()}</div>
                <div>PTH FILL MIN: {minHoleFillThreshold}% (IPC-A-610G Class 3)</div>
                <div>ICICLE FILTER: {enableIcicleDetection ? 'ACTIVE (Threshold 1.5mm)' : 'OFF'}</div>
                <div>ARC WETTING SCAN: {enableCircumferentialArcScan ? '360° RING' : 'OFF'}</div>
              </div>
            </div>

            {/* Distribution Chart */}
            <div style={{ marginTop: 14 }}>
              <ReactECharts option={holeFillChartOption} style={{ height: 180 }} />
            </div>
          </Card>
        </Col>

        {/* Right: Wave Soldering Algorithm Controls */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <Space>
                <SlidersOutlined />
                <span>波峰焊接质检专用算法与判据配置</span>
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Hole Fill Threshold */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>1. 通孔毛细透锡量最低阈值 (PTH Hole Fill %):</span>
                  <span style={{ fontWeight: 'bold', color: minHoleFillThreshold >= 75 ? '#52c41a' : '#faad14' }}>
                    {minHoleFillThreshold}%
                  </span>
                </div>
                <Slider
                  min={50}
                  max={90}
                  step={5}
                  value={minHoleFillThreshold}
                  onChange={setMinHoleFillThreshold}
                />
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  依据 IPC-A-610G：Class 3 必须 ≥75%，Class 2 必须 ≥50%
                </div>
              </div>

              {/* Icicle Flag Detection */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>2. 锡尖/拉尖冰锥识别 (Icicles & Flags)</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      检测从焊点延伸出的锐利锡刺，防止装配短路
                    </div>
                  </div>
                  <Switch checked={enableIcicleDetection} onChange={setEnableIcicleDetection} />
                </div>
              </div>

              {/* 360 Degree Circumferential Scan */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>3. 360° 圆周润湿环扫描 (Circumferential Wetting)</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      验证引脚与焊盘接触面润湿角连续性 (需 ≥330°)
                    </div>
                  </div>
                  <Switch checked={enableCircumferentialArcScan} onChange={setEnableCircumferentialArcScan} />
                </div>
              </div>

              {/* Algorithm Comparison Card */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>4. 采用算法路线</div>
                <Alert
                  type="info"
                  message={
                    algorithmMode === 'yolo_tpvg'
                      ? 'TPVG-YOLO：采用双锥体引脚定点空间注意力，对 THT 引脚识别精准度极高'
                      : algorithmMode === 'bvae_anomaly'
                      ? 'β-VAE：无需大量异常样本标注，通过正常焊点无监督自编码重构对比发现未定义未知缺陷'
                      : '混合架构 (Hybrid)：TPVG-YOLO 检出显性缺陷 + β-VAE 兜底捕获偶发性未知焊接畸变'
                  }
                  showIcon
                />
              </div>

              <Button
                type="primary"
                block
                icon={<FileDoneOutlined />}
                style={{ background: '#002766', borderColor: '#002766', height: 40, marginTop: 8 }}
                onClick={() => {
                  message.success('已固化波峰焊接质检参数并分发至炉后 AOI 检测机');
                }}
              >
                分发当前波峰焊接质检算法至产线
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Defect List Table */}
      <Card
        style={{ marginTop: 16 }}
        title={
          <Space>
            <AlertOutlined style={{ color: '#ff4d4f' }} />
            <span>波峰焊异常引脚与通孔清单 (THT Defects Log)</span>
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={currentBoard.joints}
          columns={columns}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* GitHub Open-source Programs Reference for Wave Soldering */}
      <Card
        style={{ marginTop: 16 }}
        title="GitHub 上专门针对波峰焊接与通孔插装 (THT) 的优秀开源算法解析"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="1. TPVG-YOLO (Pin Focus)">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>原理：</strong> 针对 PCB 通孔焊点研发的双锥体空间定位网络，克服传统 YOLO 矩形框无法精准贴合圆环形焊盘的问题，定位准确率提升 14.8%。
              </p>
              <Tag color="blue">适合：通孔透锡量、引脚偏转识别</Tag>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="2. β-VAE 焊点异常检测">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>原理：</strong> (GitHub: furkanulger/Anomaly-detection-for-solder) 利用 $\beta$-变分自编码器学习合格焊点特征空间，当遇到拉尖、气孔等罕见异形缺陷时重构误差激增。
              </p>
              <Tag color="purple">适合：免缺陷样本、冷焊吹孔</Tag>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="3. PCB-AOI (OpenCV + YOLO)">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>原理：</strong> 结合金标准模板差分 (Golden Board Subtraction) 与 YOLO 目标检测，先对齐定位引脚圆心，再分析圆周润湿角完整度。
              </p>
              <Tag color="green">适合：360° 圆周润湿不全检测</Tag>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="4. PCBA-Dataset (ismh16)">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>原理：</strong> 包含 4,000+ 多视角波峰焊与回流焊实拍缺陷数据集，涵盖多引脚短路桥接、少锡、锡珠及浮高。
              </p>
              <Tag color="orange">适合：提供高质量 YOLO 训练集</Tag>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default WaveSolderInspectionLab;
