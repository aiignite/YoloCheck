import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  Upload, message, Descriptions, Row, Col, Statistic, Popconfirm, Tooltip,
} from 'antd';
import {
  UploadOutlined, RocketOutlined, RollbackOutlined, DeleteOutlined,
  PlusOutlined, SwapOutlined, CloudUploadOutlined, ThunderboltOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import api from '../../utils/api';

interface ModelItem {
  id: number;
  name: string;
  version: string;
  model_path: string;
  model_type: string;
  description: string;
  file_size: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  map50: number | null;
  map50_95: number | null;
  inference_speed: number | null;
  is_active: boolean;
  status: string;
  deployed_at: string | null;
  created_at: string;
}

const statusMap: Record<string, { color: string; text: string }> = {
  uploaded: { color: 'default', text: '已上传' },
  validating: { color: 'processing', text: '验证中' },
  ready: { color: 'cyan', text: '就绪' },
  deployed: { color: 'green', text: '已部署' },
  archived: { color: 'default', text: '已归档' },
};

const typeMap: Record<string, { color: string; text: string }> = {
  defect: { color: 'red', text: '缺陷检测' },
  safety: { color: 'orange', text: '安全检测' },
  efficiency: { color: 'blue', text: '效率分析' },
  pose: { color: 'purple', text: '姿态检测' },
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const ModelManager: React.FC = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [form] = Form.useForm();
  const [uploadForm] = Form.useForm();

  const fetchModels = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType) params.model_type = filterType;
      const { data } = await api.get('/models', { params });
      setModels(data);
    } catch { message.error('加载模型列表失败'); }
    setLoading(false);
  };

  useEffect(() => { fetchModels(); }, [filterType]);

  const handleCreate = async (values: any) => {
    try {
      await api.post('/models', values);
      message.success('模型创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchModels();
    } catch { message.error('创建失败'); }
  };

  const handleUpdate = async (values: any) => {
    if (!editingModel) return;
    try {
      await api.put(`/models/${editingModel.id}`, values);
      message.success('更新成功');
      setEditingModel(null);
      setModalOpen(false);
      form.resetFields();
      fetchModels();
    } catch { message.error('更新失败'); }
  };

  const handleUpload = async (values: any) => {
    const formData = new FormData();
    formData.append('file', values.file.file);
    formData.append('name', values.name);
    formData.append('version', values.version);
    formData.append('model_type', values.model_type);
    formData.append('description', values.description || '');
    try {
      await api.post('/models/upload', formData);
      message.success('模型上传成功');
      setUploadOpen(false);
      uploadForm.resetFields();
      fetchModels();
    } catch { message.error('上传失败'); }
  };

  const handleDeploy = async (id: number) => {
    try {
      await api.post(`/models/${id}/deploy`);
      message.success('模型已部署');
      fetchModels();
    } catch { message.error('部署失败'); }
  };

  const handleRollback = async (id: number) => {
    try {
      await api.post(`/models/${id}/rollback`);
      message.success('已回滚');
      fetchModels();
    } catch { message.error('回滚失败'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/models/${id}`);
      message.success('已删除');
      fetchModels();
    } catch (e: any) { message.error(e.response?.data?.detail || '删除失败'); }
  };

  const handleCompare = async () => {
    if (selectedRows.length !== 2) { message.warning('请选择两个模型进行对比'); return; }
    try {
      const { data } = await api.get(`/models/compare/${selectedRows[0]}/${selectedRows[1]}`);
      setCompareResult(data);
      setCompareOpen(true);
    } catch { message.error('对比失败'); }
  };

  const renderMetric = (v: number | null, unit = '', pct = false) => {
    if (v == null) return <span style={{ color: '#ccc' }}>-</span>;
    return pct ? `${(v * 100).toFixed(1)}%` : `${v}${unit}`;
  };

  const renderDiff = (v: number | null, reverse = false) => {
    if (v == null) return '-';
    const positive = reverse ? v < 0 : v > 0;
    const color = v === 0 ? '#999' : positive ? '#52c41a' : '#ff4d4f';
    const sign = v > 0 ? '+' : '';
    return <span style={{ color, fontWeight: 600 }}>{sign}{(v * 100).toFixed(2)}%</span>;
  };

  const columns: ColumnsType<ModelItem> = [
    { title: '名称', dataIndex: 'name', width: 150, render: (t, r) => (
      <div><strong>{t}</strong><div style={{ fontSize: 12, color: '#999' }}>{r.description}</div></div>
    )},
    { title: '版本', dataIndex: 'version', width: 80, render: v => <Tag>{v}</Tag> },
    { title: '类型', dataIndex: 'model_type', width: 100, render: v => {
      const t = typeMap[v]; return t ? <Tag color={t.color}>{t.text}</Tag> : v;
    }},
    { title: '状态', dataIndex: 'status', width: 90, render: (v, r) => {
      const s = statusMap[v] || { color: 'default', text: v };
      return <>{r.is_active && <Tag color="green">活跃</Tag>}<Tag color={s.color}>{s.text}</Tag></>;
    }},
    { title: '精度', dataIndex: 'accuracy', width: 80, render: v => renderMetric(v, '', true) },
    { title: 'mAP@50', dataIndex: 'map50', width: 90, render: v => renderMetric(v, '', true) },
    { title: '速度', dataIndex: 'inference_speed', width: 110, render: v => {
      if (v == null) return <span style={{ color: '#ccc' }}>-</span>;
      if (v <= 30) {
        return <Tag color="green" icon={<ThunderboltOutlined />}>⚡ {v}ms (超频加速)</Tag>;
      }
      return <Tag color="orange">{v}ms (基线)</Tag>;
    }},
    { title: '大小', dataIndex: 'file_size', width: 80, render: v => formatSize(v) },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: v => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', fixed: 'right', width: 200, render: (_, r) => (
      <Space size="small">
        <Tooltip title="编辑">
          <Button size="small" onClick={() => { setEditingModel(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
        </Tooltip>
        {!r.is_active && (
          <Popconfirm title="确认部署此模型？（将自动替换同类型活跃模型）" onConfirm={() => handleDeploy(r.id)}>
            <Button size="small" type="primary" icon={<RocketOutlined />}>部署</Button>
          </Popconfirm>
        )}
        {r.is_active && (
          <Popconfirm title="确认回滚（取消部署）？" onConfirm={() => handleRollback(r.id)}>
            <Button size="small" danger icon={<RollbackOutlined />}>回滚</Button>
          </Popconfirm>
        )}
        {!r.is_active && (
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      </Space>
    )},
  ];

  const activeModels = models.filter(m => m.is_active);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="模型总数" value={models.length} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="已部署" value={activeModels.length} styles={{ content: { color: '#52c41a' } }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="最高精度" value={models.reduce((max, m) => Math.max(max, (m.accuracy || 0) * 100), 0).toFixed(1)} suffix="%" /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="最快推理" value={models.reduce((min, m) => m.inference_speed ? Math.min(min, m.inference_speed) : min, 999).toFixed(1)} suffix="ms" /></Card>
        </Col>
      </Row>

      <Card
        title="模型版本管理"
        extra={
          <Space>
            <Select value={filterType} onChange={setFilterType} style={{ width: 120 }} allowClear placeholder="类型筛选"
              options={[{ value: 'defect', label: '缺陷检测' }, { value: 'safety', label: '安全检测' }, { value: 'efficiency', label: '效率分析' }, { value: 'pose', label: '姿态检测' }]}
            />
            <Button
              type="primary"
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
              icon={<ThunderboltOutlined />}
              onClick={() => navigate('/model-optimizer')}
            >
              🚀 模型响应加速优化 (10.8x)
            </Button>
            <Button
              style={{ background: '#f6ffed', borderColor: '#b7eb8f', color: '#52c41a' }}
              icon={<ScanOutlined />}
              onClick={() => navigate('/image-lab')}
            >
              🔬 SAHI微目标切片
            </Button>
            <Button icon={<SwapOutlined />} disabled={selectedRows.length !== 2} onClick={handleCompare}>对比</Button>
            <Button icon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)}>上传模型</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingModel(null); form.resetFields(); setModalOpen(true); }}>新建</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={models}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
          rowSelection={{ selectedRowKeys: selectedRows, onChange: keys => setSelectedRows(keys as number[]), type: 'checkbox' }}
        />
      </Card>

      {/* 新建/编辑 Modal */}
      <Modal
        title={editingModel ? '编辑模型' : '新建模型'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingModel(null); }}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={editingModel ? handleUpdate : handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}><Input placeholder="v1.0.0" /></Form.Item>
          <Form.Item name="model_type" label="类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'defect', label: '缺陷检测' }, { value: 'safety', label: '安全检测' }, { value: 'efficiency', label: '效率分析' }, { value: 'pose', label: '姿态检测' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="accuracy" label="精度"><InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="precision" label="Precision"><InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="recall" label="Recall"><InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="map50" label="mAP@50"><InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="map50_95" label="mAP@50:95"><InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="inference_speed" label="推理速度(ms)"><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 上传 Modal */}
      <Modal
        title="上传模型文件"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => uploadForm.submit()}
        destroyOnHidden
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}><Input placeholder="v1.0.0" /></Form.Item>
          <Form.Item name="model_type" label="类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'defect', label: '缺陷检测' }, { value: 'safety', label: '安全检测' }, { value: 'efficiency', label: '效率分析' }, { value: 'pose', label: '姿态检测' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="file" label="模型文件" rules={[{ required: true }]}>
            <Upload beforeUpload={() => false} maxCount={1} accept=".pt,.onnx,.engine">
              <Button icon={<UploadOutlined />}>选择文件 (.pt / .onnx / .engine)</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* 对比 Modal */}
      <Modal title="模型性能对比" open={compareOpen} onCancel={() => setCompareOpen(false)} footer={null} width={700}>
        {compareResult && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}><Card size="small" title={`模型A: ${compareResult.model_a.name} ${compareResult.model_a.version}`}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="精度">{renderMetric(compareResult.model_a.accuracy, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="Precision">{renderMetric(compareResult.model_a.precision, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="Recall">{renderMetric(compareResult.model_a.recall, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="mAP@50">{renderMetric(compareResult.model_a.map50, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="速度">{renderMetric(compareResult.model_a.inference_speed, 'ms')}</Descriptions.Item>
                </Descriptions>
              </Card></Col>
              <Col span={12}><Card size="small" title={`模型B: ${compareResult.model_b.name} ${compareResult.model_b.version}`}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="精度">{renderMetric(compareResult.model_b.accuracy, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="Precision">{renderMetric(compareResult.model_b.precision, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="Recall">{renderMetric(compareResult.model_b.recall, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="mAP@50">{renderMetric(compareResult.model_b.map50, '', true)}</Descriptions.Item>
                  <Descriptions.Item label="速度">{renderMetric(compareResult.model_b.inference_speed, 'ms')}</Descriptions.Item>
                </Descriptions>
              </Card></Col>
            </Row>
            <Card size="small" title="差异 (A - B)">
              <Row gutter={16}>
                <Col span={8}><Statistic title="精度差" value=" " prefix={renderDiff(compareResult.metrics_diff.accuracy)} /></Col>
                <Col span={8}><Statistic title="Precision差" value=" " prefix={renderDiff(compareResult.metrics_diff.precision)} /></Col>
                <Col span={8}><Statistic title="Recall差" value=" " prefix={renderDiff(compareResult.metrics_diff.recall)} /></Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={8}><Statistic title="mAP@50差" value=" " prefix={renderDiff(compareResult.metrics_diff.map50)} /></Col>
                <Col span={8}><Statistic title="mAP@50:95差" value=" " prefix={renderDiff(compareResult.metrics_diff.map50_95)} /></Col>
                <Col span={8}><Statistic title="速度差" value=" " prefix={renderDiff(compareResult.metrics_diff.inference_speed, true)} /></Col>
              </Row>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ModelManager;
