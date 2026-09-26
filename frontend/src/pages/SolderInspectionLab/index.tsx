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
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../../utils/api';

const { Option } = Select;

// Solder joint defect item interface
interface SolderDefectItem {
  id: string;
  name: string;
  category: 'critical' | 'major' | 'minor';
  ipcStandard: string; // IPC-A-610G standard clause
  location: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  solderQualityScore: number; // 0-100
  pinPinholeCount?: number;
  wettingAngleDeg?: number; // Solder wetting angle (ideal 15°-45°)
  status: 'rejected' | 'accepted' | 'rework_needed';
}

// Preset SMT PCB Inspection Boards with realistic solder joint defects
const SMT_BOARDS = [
  {
    id: 'pcb_main_01',
    name: 'SMT回流焊出炉主控板 (PCB-AOI-SPI 01)',
    standard: 'IPC-A-610G Class 3 (高可靠性电子)',
    bgType: 'green',
    componentsCount: 38,
    defects: [
      {
        id: 'sd-01',
        name: '焊锡桥接短路 (Solder Bridging)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.3.5',
        location: 'IC U2 (QFP-48) Pin 12-13',
        x: 175,
        y: 195,
        w: 36,
        h: 24,
        confidence: 0.965,
        solderQualityScore: 18,
        wettingAngleDeg: 110,
        status: 'rejected',
      },
      {
        id: 'sd-02',
        name: '焊料不足/虚焊 (Insufficient Solder / Cold Solder)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.3.3',
        location: 'Capacitor C18 (0402)',
        x: 290,
        y: 140,
        w: 24,
        h: 22,
        confidence: 0.942,
        solderQualityScore: 32,
        wettingAngleDeg: 85,
        status: 'rework_needed',
      },
      {
        id: 'sd-03',
        name: '墓碑效应元件立碑 (Tombstoning Defect)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.1.4',
        location: 'Resistor R22 (0603)',
        x: 420,
        y: 160,
        w: 26,
        h: 30,
        confidence: 0.978,
        solderQualityScore: 10,
        status: 'rejected',
      },
      {
        id: 'sd-04',
        name: '焊料球溅落 (Solder Balls / Splatters)',
        category: 'minor',
        ipcStandard: 'IPC-A-610G 7.3.4',
        location: 'Vias Zone A-4',
        x: 350,
        y: 280,
        w: 20,
        h: 20,
        confidence: 0.894,
        solderQualityScore: 65,
        status: 'rework_needed',
      },
      {
        id: 'sd-05',
        name: '焊点气孔与针孔 (Pinholes & Voids 18%)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 7.3.2',
        location: 'BGA Pad J3',
        x: 230,
        y: 310,
        w: 30,
        h: 28,
        confidence: 0.915,
        solderQualityScore: 54,
        wettingAngleDeg: 42,
        status: 'rework_needed',
      },
    ] as SolderDefectItem[],
  },
  {
    id: 'pcb_power_02',
    name: '高频电源管理板 (Power SMT Section)',
    standard: 'IPC-A-610G Class 2 (专用服务类电子)',
    bgType: 'blue',
    componentsCount: 24,
    defects: [
      {
        id: 'sd-11',
        name: '焊锡过多起堆 (Excess Solder)',
        category: 'major',
        ipcStandard: 'IPC-A-610G 7.3.1',
        location: 'Inductor L1 Pad',
        x: 190,
        y: 160,
        w: 48,
        h: 42,
        confidence: 0.932,
        solderQualityScore: 48,
        wettingAngleDeg: 95,
        status: 'rework_needed',
      },
      {
        id: 'sd-12',
        name: '焊盘元器件错位 (Pad Misalignment)',
        category: 'critical',
        ipcStandard: 'IPC-A-610G 7.1.1',
        location: 'MOSFET Q3',
        x: 380,
        y: 210,
        w: 44,
        h: 36,
        confidence: 0.958,
        solderQualityScore: 25,
        status: 'rejected',
      },
    ] as SolderDefectItem[],
  },
];

export const SolderInspectionLab: React.FC = () => {
  const [selectedBoardId, setSelectedBoardId] = useState<string>('pcb_main_01');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [ipcClassStandard, setIpcClassStandard] = useState<'class2' | 'class3'>('class3');
  const [enableSpikeInspection, setEnableSpikeInspection] = useState<boolean>(true);
  const [enableWettingAngleCalc, setEnableWettingAngleCalc] = useState<boolean>(true);
  const [enableAoiThresholding, setEnableAoiThresholding] = useState<boolean>(true);
  const [highlightSolderLuster, setHighlightSolderLuster] = useState<boolean>(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.75);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentBoard = SMT_BOARDS.find((b) => b.id === selectedBoardId) || SMT_BOARDS[0];

  // Draw PCB Canvas with microscopic solder pads
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. PCB Substrate Background
    const isGreen = currentBoard.bgType === 'green';
    const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (isGreen) {
      bgGrad.addColorStop(0, '#09361e');
      bgGrad.addColorStop(1, '#042111');
    } else {
      bgGrad.addColorStop(0, '#002766');
      bgGrad.addColorStop(1, '#001529');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Copper Traces & Ground Vias
    ctx.strokeStyle = isGreen ? 'rgba(212, 175, 55, 0.4)' : 'rgba(145, 213, 255, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 20; i < canvas.height; i += 35) {
      ctx.beginPath();
      ctx.moveTo(30, i);
      ctx.lineTo(canvas.width - 30, i);
      ctx.stroke();
    }
    for (let j = 50; j < canvas.width; j += 60) {
      ctx.beginPath();
      ctx.moveTo(j, 30);
      ctx.lineTo(j, canvas.height - 30);
      ctx.stroke();
    }

    // 3. Normal Good Solder Joints (Pads & Fillets)
    for (let col = 80; col < canvas.width - 60; col += 70) {
      for (let row = 70; row < canvas.height - 50; row += 80) {
        // Draw normal metallic silver solder pad with IPC Class 3 curved wetting fillet
        const solderGrad = ctx.createRadialGradient(col, row, 2, col, row, 12);
        solderGrad.addColorStop(0, highlightSolderLuster ? '#ffffff' : '#e8e8e8');
        solderGrad.addColorStop(0.5, '#bfbfbf');
        solderGrad.addColorStop(1, '#595959');

        ctx.fillStyle = solderGrad;
        ctx.beginPath();
        ctx.arc(col, row, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 4. Draw Identified Solder Defects with High-Vis Overlays
    currentBoard.defects.forEach((d) => {
      if (d.confidence < confidenceThreshold) return;
      if (filterSeverity !== 'all' && d.category !== filterSeverity) return;

      const isCritical = d.category === 'critical';
      const boxColor = isCritical ? '#ff4d4f' : d.category === 'major' ? '#faad14' : '#1890ff';

      // Solder Defect Area
      ctx.save();
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(d.x - 3, d.y - 3, d.w + 6, d.h + 6);
      ctx.restore();

      // Highlight defect anomaly
      ctx.fillStyle = isCritical ? 'rgba(255, 77, 79, 0.35)' : 'rgba(250, 173, 20, 0.3)';
      ctx.fillRect(d.x, d.y, d.w, d.h);

      // Simulated Solder anomaly graphics
      if (d.name.includes('桥接')) {
        // Draw bridge connection between pads
        ctx.fillStyle = '#ff4d4f';
        ctx.fillRect(d.x + 4, d.y + d.h / 2 - 3, d.w - 8, 6);
      } else if (d.name.includes('墓碑')) {
        // Draw tilted resistor tombstone
        ctx.fillStyle = '#faad14';
        ctx.fillRect(d.x + 2, d.y + 2, 8, d.h - 4);
      }

      // IPC Tag Banner
      const label = `${d.name} [${d.confidence * 100}%]`;
      ctx.font = 'bold 11px sans-serif';
      const txtWidth = ctx.measureText(label).width;

      ctx.fillStyle = boxColor;
      ctx.fillRect(d.x - 3, d.y - 20, txtWidth + 10, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, d.x + 2, d.y - 6);

      // Wetting Angle Indicator (if enabled)
      if (enableWettingAngleCalc && d.wettingAngleDeg) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(d.x - 3, d.y + d.h + 4, 110, 16);
        ctx.fillStyle = d.wettingAngleDeg > 90 ? '#ff7875' : '#73d13d';
        ctx.font = '10px monospace';
        ctx.fillText(`θ润湿角: ${d.wettingAngleDeg}° (${d.wettingAngleDeg > 90 ? '不良' : '良品'})`, d.x + 2, d.y + d.h + 16);
      }
    });
  }, [
    selectedBoardId,
    filterSeverity,
    ipcClassStandard,
    enableWettingAngleCalc,
    highlightSolderLuster,
    confidenceThreshold,
  ]);

  // Quality distribution chart
  const qualityChartOption = {
    title: { text: '焊点质量评分分布 (IPC-A-610G 规范)', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['优良焊点 (Class 3)', '边缘合格 (Class 2)', '需补焊返修', '拒收缺陷 (Reject)'],
    },
    yAxis: { type: 'value', name: '焊点数 (Pads)' },
    series: [
      {
        data: [
          { value: 168, itemStyle: { color: '#52c41a' } },
          { value: 18, itemStyle: { color: '#faad14' } },
          { value: currentBoard.defects.filter((d) => d.status === 'rework_needed').length, itemStyle: { color: '#fa8c16' } },
          { value: currentBoard.defects.filter((d) => d.status === 'rejected').length, itemStyle: { color: '#f5222d' } },
        ],
        type: 'bar',
        barWidth: '40%',
      },
    ],
  };

  const defectColumns = [
    {
      title: '缺陷类型 (Defect)',
      dataIndex: 'name',
      key: 'name',
      render: (t: string, r: SolderDefectItem) => (
        <Space orientation="vertical" size={2}>
          <span style={{ fontWeight: 600 }}>{t}</span>
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>{r.location}</span>
        </Space>
      ),
    },
    {
      title: '等级',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => {
        if (cat === 'critical') return <Tag color="error">严重致命</Tag>;
        if (cat === 'major') return <Tag color="warning">主要缺陷</Tag>;
        return <Tag color="blue">次要缺陷</Tag>;
      },
    },
    {
      title: 'IPC 标准判据',
      dataIndex: 'ipcStandard',
      key: 'ipcStandard',
      render: (t: string) => <Tag color="geekblue">{t}</Tag>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      title: '润湿角 θ',
      dataIndex: 'wettingAngleDeg',
      key: 'wettingAngleDeg',
      render: (v?: number) =>
        v ? (
          <span style={{ color: v > 90 ? '#cf1322' : '#389e0d', fontWeight: 'bold' }}>
            {v}° ({v > 90 ? '浸润不良' : '良品'})
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: '工单处置 (Action)',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        if (s === 'rejected') return <Tag color="red">强制报废/下线</Tag>;
        if (s === 'rework_needed') return <Tag color="orange">送SMT工位补焊</Tag>;
        return <Tag color="green">合格放行</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: '4px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #061178 0%, #092b00 50%, #135200 100%)',
          padding: '20px 28px',
          borderRadius: 8,
          marginBottom: 16,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(6, 17, 120, 0.25)',
        }}
      >
        <Row align="middle" justify="space-between">
          <Col xs={24} md={16}>
            <Space align="center" size={12}>
              <ExperimentOutlined style={{ fontSize: 32, color: '#ffec3d' }} />
              <div>
                <h1 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>
                  PCB SMT 回流焊焊接质量专用质检工作台 (DeepPCB + IPC-A-610G)
                </h1>
                <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: 13 }}>
                  吸纳 GitHub 开源 <strong>DeepPCB、PKU-Market-PCB、PCB-AoI (KubeEdge-Ianvs)</strong> 与 <strong>SolDef_AI</strong> 优秀检测算法，专门攻克<strong>锡桥短路、焊料虚焊、元件立碑 (Tombstone)、焊锡球飞溅及润湿角异常</strong>。
                </p>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Tag color="gold" style={{ fontSize: 13, padding: '4px 8px' }}>
                ⭐ 融合 GitHub 顶级 PCB 数据集
              </Tag>
              <Tag color="cyan" style={{ fontSize: 13, padding: '4px 8px' }}>
                📋 IPC-A-610G 电子装配判据
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
              title="当前板卡焊点良品率 (FPY)"
              value={97.2}
              precision={1}
              suffix="%"
              styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              共 191 个测试焊点，{currentBoard.defects.length} 处异常拦截
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="锡桥/短路致命缺陷 (Bridging)"
              value={currentBoard.defects.filter((d) => d.name.includes('桥接')).length}
              suffix="处"
              styles={{ content: { color: '#f5222d', fontWeight: 'bold' } }}
              prefix={<CloseCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              阻断通电短路烧板事故
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="墓碑/立碑效应 (Tombstoning)"
              value={currentBoard.defects.filter((d) => d.name.includes('墓碑')).length}
              suffix="处"
              styles={{ content: { color: '#fa8c16', fontWeight: 'bold' } }}
              prefix={<AlertOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              两端表面张力不平衡导致芯片立起
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" hoverable>
            <Statistic
              title="AOI-SPI 锡膏与焊点识别平均耗时"
              value={15.4}
              precision={1}
              suffix="ms"
              styles={{ content: { color: '#1890ff', fontWeight: 'bold' } }}
              prefix={<ThunderboltOutlined />}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              结合微目标切片与焊锡反光增强算法
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Inspection Viewport & Controls */}
      <Row gutter={[16, 16]}>
        {/* Left: PCB Canvas Viewport */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <EyeOutlined />
                <span>SMT 回流焊微观光学质检视口 (Microscopic Solder Viewport)</span>
                <Tag color="blue">{currentBoard.name}</Tag>
              </Space>
            }
            extra={
              <Space>
                <Select
                  size="small"
                  value={filterSeverity}
                  onChange={setFilterSeverity}
                  style={{ width: 110 }}
                >
                  <Option value="all">全部缺陷</Option>
                  <Option value="critical">严重致命</Option>
                  <Option value="major">主要缺陷</Option>
                  <Option value="minor">次要缺陷</Option>
                </Select>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => message.success('已重新加载 AOI 显微相机最新曝光帧')}
                >
                  刷新采样
                </Button>
              </Space>
            }
          >
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 6, background: '#000' }}>
              <canvas
                ref={canvasRef}
                width={640}
                height={420}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />

              {/* Viewport Info Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 12,
                  background: 'rgba(0, 0, 0, 0.75)',
                  padding: '6px 12px',
                  borderRadius: 4,
                  color: '#95de64',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  border: '1px solid rgba(149, 222, 100, 0.4)',
                }}
              >
                <div>[AOI SOLDER INSPECTION] {currentBoard.standard}</div>
                <div>WETTING ANGLE CALCULATION: {enableWettingAngleCalc ? 'ENABLED (θ)' : 'OFF'}</div>
                <div>LUSTER FILTER: {highlightSolderLuster ? 'ACTIVE' : 'OFF'}</div>
                <div>DETECTED DEFECTS: {currentBoard.defects.length} FOUND</div>
              </div>
            </div>

            {/* Solder Inspection Quality Distribution Chart */}
            <div style={{ marginTop: 14 }}>
              <ReactECharts option={qualityChartOption} style={{ height: 180 }} />
            </div>
          </Card>
        </Col>

        {/* Right: Inspection Algorithm & IPC Settings */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <Space>
                <SlidersOutlined />
                <span>焊点视觉算法与 IPC 标准判据配置</span>
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Board Selection */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>1. 待测 SMT 工件与批次板卡</div>
                <Select
                  value={selectedBoardId}
                  onChange={setSelectedBoardId}
                  style={{ width: '100%' }}
                >
                  {SMT_BOARDS.map((b) => (
                    <Option key={b.id} value={b.id}>
                      {b.name}
                    </Option>
                  ))}
                </Select>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                  当前质检规范：{currentBoard.standard}
                </div>
              </div>

              {/* Wetting Angle Calculation Switch */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>2. 焊料润湿角 (Wetting Angle θ) 自动测算</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      借鉴 SolDef_AI 轮廓拟合，理想凹面角 &lt; 90°，大于 90° 判虚焊
                    </div>
                  </div>
                  <Switch checked={enableWettingAngleCalc} onChange={setEnableWettingAngleCalc} />
                </div>
              </div>

              {/* Luster Reflection */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>3. 焊锡金属高光反光补偿 (Luster Filter)</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      过滤无铅焊锡表面微小反光伪影，提升真缺陷召回
                    </div>
                  </div>
                  <Switch checked={highlightSolderLuster} onChange={setHighlightSolderLuster} />
                </div>
              </div>

              {/* IPC Standard Level */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>4. IPC-A-610G 电子组件可接受性等级</div>
                <Select
                  value={ipcClassStandard}
                  onChange={setIpcClassStandard}
                  style={{ width: '100%' }}
                >
                  <Option value="class3">Class 3 (高可靠性/医疗航天军工严格规范)</Option>
                  <Option value="class2">Class 2 (通用工业服务类专用规范)</Option>
                </Select>
              </div>

              {/* Confidence Threshold */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>置信度过滤阈值:</span>
                  <span>{(confidenceThreshold * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  value={confidenceThreshold}
                  onChange={setConfidenceThreshold}
                />
              </div>

              <Button
                type="primary"
                block
                icon={<FileDoneOutlined />}
                style={{ background: '#092b00', borderColor: '#092b00', height: 40, marginTop: 8 }}
                onClick={() => {
                  message.success('已将当前 SMT 焊接缺陷算法模型推送到全线 AOI 质检工位');
                }}
              >
                分发当前焊接质检算法至 AOI 产线
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
            <span>检出缺陷焊点详细清单与处置建议 (Defects Audit Table)</span>
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={currentBoard.defects}
          columns={defectColumns}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* GitHub Open-source Programs Reference */}
      <Card
        style={{ marginTop: 16 }}
        title="GitHub 上专门针对 PCB SMT 焊接质量检测的优秀开源项目调研与借鉴方案"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="1. DeepPCB 开源缺陷库">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>介绍：</strong> 工业界广泛引用的开源 PCB 缺陷基准，专门针对短路 (Short)、开路 (Open)、鼠咬 (Mousebite)、孔洞 (Pinhole) 及残铜。
              </p>
              <Tag color="green">在本项目中：完善基础布线与通孔短路识别</Tag>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="2. PCB-AoI (KubeEdge-Ianvs)">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>介绍：</strong> 专注于 SMT 锡膏印刷检测 (SPI)，覆盖焊盘缺锡 (Less paste)、锡膏过多桥接 (Bridging) 及贴片偏移 (Misalignment)。
              </p>
              <Tag color="cyan">在本项目中：强化回流焊前锡膏几何形态</Tag>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="3. SolDef_AI 焊接缺陷分割">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>介绍：</strong> 专门针对 SMT 元器件焊接过程缺陷（立碑、冷焊、拉尖 Spikes 与焊锡球），并引入焊锡润湿角 (Wetting Angle) 几何计算。
              </p>
              <Tag color="gold">在本项目中：落地润湿角 θ &lt; 90° 虚焊测算</Tag>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card type="inner" size="small" title="4. PKU-Market-PCB 数据集">
              <p style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                <strong>介绍：</strong> 北京大学开源的 PCB 表面缺陷高分辨率数据集，搭配 CBAM 注意力机制与高精特征金字塔，解决极细微焊点漏检。
              </p>
              <Tag color="purple">在本项目中：适配微小元器件 (0201/0402)</Tag>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default SolderInspectionLab;
