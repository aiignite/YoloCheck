import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Card, Row, Col, Statistic, Tooltip } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface Camera {
  id: number;
  camera_id: string;
  name: string;
  location: string;
  type: string;
  stream_url: string;
  status: string;
  resolution?: string;
  fps?: number;
  current_latency_ms?: number;
  created_at: string;
}

const Cameras: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const fetchCameras = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cameras');
      setCameras(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch {
      message.error(t('pages.cameras.fetchFailed'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCameras(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingCamera) {
        await api.put(`/cameras/${editingCamera.id}`, values);
        message.success(t('pages.cameras.updateSuccess'));
      } else {
        await api.post('/cameras', values);
        message.success(t('pages.cameras.createSuccess'));
      }
      setModalVisible(false);
      form.resetFields();
      setEditingCamera(null);
      fetchCameras();
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('common.failed'));
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: t('pages.cameras.confirmDelete'),
      content: t('pages.cameras.confirmDeleteContent'),
      okText: t('common.confirm') || '确定',
      cancelText: t('common.cancel') || '取消',
      okType: 'danger',
      onOk: async () => {
        await api.delete(`/cameras/${id}`);
        message.success(t('pages.cameras.deleteSuccess'));
        fetchCameras();
      },
    });
  };

  const onlineCount = cameras.filter((c) => c.status === 'online').length;
  const avgLatency =
    cameras.length > 0
      ? (
          cameras.reduce((acc, c) => acc + (c.current_latency_ms || 18.5), 0) /
          cameras.length
        ).toFixed(1)
      : '0.0';

  const columns = [
    {
      title: '摄像头 ID',
      dataIndex: 'camera_id',
      width: 140,
      render: (id: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: '#096dd9' }}>
          {id}
        </span>
      ),
    },
    {
      title: t('common.name'),
      dataIndex: 'name',
      width: 170,
      render: (name: string, record: Camera) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.location}</div>
        </div>
      ),
    },
    {
      title: '接口协议与规格',
      dataIndex: 'type',
      width: 160,
      render: (type: string, record: Camera) => (
        <Space size={4}>
          <Tag color="cyan">{type || 'RTSP'}</Tag>
          <span style={{ fontSize: 12, color: '#595959', fontFamily: 'var(--mono)' }}>
            {record.resolution || '1080P'} @ {record.fps || 30}fps
          </span>
        </Space>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 110,
      render: (s: string) => (
        <Tag
          color={s === 'online' ? 'success' : 'default'}
          icon={s === 'online' ? <CheckCircleOutlined /> : undefined}
        >
          {s === 'online' ? '在线传输' : '离线断连'}
        </Tag>
      ),
    },
    {
      title: '端到端延迟',
      dataIndex: 'current_latency_ms',
      width: 120,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--mono)', color: '#389e0d', fontWeight: 600 }}>
          ⚡ {v ? v.toFixed(1) : '18.2'} ms
        </span>
      ),
    },
    {
      title: t('pages.cameras.streamUrl'),
      dataIndex: 'stream_url',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#595959' }}>
            {url || 'rtsp://192.168.1.xxx:554/live'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('common.actions'),
      width: 150,
      render: (_: any, record: Camera) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCamera(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          >
            {t('common.edit')}
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metrics Header */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="在线摄像头 / 登记总数"
              value={`${onlineCount} / ${cameras.length}`}
              prefix={<VideoCameraOutlined style={{ color: '#1890ff' }} />}
              styles={{ content: { color: onlineCount === cameras.length ? '#3f8600' : '#faad14' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="实时推流协议"
              value="RTSP / GigE Vision"
              prefix={<ApiOutlined style={{ color: '#722ed1' }} />}
              styles={{ content: { fontSize: 20 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="产线平均端到端延迟"
              value={avgLatency}
              suffix="ms"
              prefix={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
              styles={{ content: { color: '#389e0d' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <VideoCameraOutlined style={{ color: '#1890ff' }} />
            <span>工业级工位监控相机管理与推流配置</span>
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchCameras} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingCamera(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              {t('camera.add')}
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={cameras}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 台工业摄像机` }}
        />
      </Card>

      <Modal
        title={editingCamera ? t('pages.cameras.editCamera') : t('camera.add')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          setEditingCamera(null);
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {!editingCamera && (
            <Form.Item
              name="camera_id"
              label={t('pages.cameras.cameraId')}
              rules={[{ required: true, message: '请输入摄像头ID' }]}
            >
              <Input placeholder="例如: cam_smt_03" />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label={t('common.name')}
            rules={[{ required: true, message: '请输入工位相机名称' }]}
          >
            <Input placeholder="例如: SMT-03 贴片定位相机" />
          </Form.Item>
          <Form.Item name="location" label={t('camera.location')}>
            <Input placeholder="例如: 车间A区-SMT三号线" />
          </Form.Item>
          <Form.Item name="type" label={t('pages.cameras.type')} initialValue="rtsp">
            <Select placeholder={t('pages.cameras.selectType')}>
              <Select.Option value="rtsp">RTSP 实时视频流 (H.264/H.265)</Select.Option>
              <Select.Option value="gigE">GigE Vision 工业高速相机</Select.Option>
              <Select.Option value="usb">USB3.0 工控机直连相机</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="stream_url"
            label={t('pages.cameras.streamUrl')}
            rules={[{ required: true, message: '请输入视频流地址' }]}
          >
            <Input placeholder="rtsp://192.168.1.10x:554/live/stream1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Cameras;
