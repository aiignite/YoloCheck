import { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Row, Col, Statistic } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface SystemConfig {
  id: number;
  category: string;
  key: string;
  value: string | null;
  description: string | null;
}

interface CameraDriver {
  id: number;
  name: string;
  protocol: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Settings() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [drivers, setDrivers] = useState<CameraDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [configForm] = Form.useForm();
  const [driverForm] = Form.useForm();
  const { t } = useTranslation();

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await api.get('/system/configs');
      setConfigs(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch { /* empty */ }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await api.get('/system/drivers');
      setDrivers(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch { /* empty */ }
  }, []);

  const reloadAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchConfigs(), fetchDrivers()]).finally(() => setLoading(false));
  }, [fetchConfigs, fetchDrivers]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const handleCreateConfig = async (values: Record<string, string>) => {
    try {
      await api.post('/system/configs', values);
      message.success(t('pages.settings.configSaved'));
      setConfigModalOpen(false);
      configForm.resetFields();
      fetchConfigs();
    } catch {
      message.error(t('common.failed'));
    }
  };

  const handleDeleteConfig = async (id: number) => {
    try {
      await api.delete(`/system/configs/${id}`);
      message.success(t('pages.settings.configDeleted'));
      fetchConfigs();
    } catch {
      message.error(t('common.failed'));
    }
  };

  const handleCreateDriver = async (values: Record<string, string>) => {
    try {
      await api.post('/system/drivers', values);
      message.success(t('pages.settings.driverAdded'));
      setDriverModalOpen(false);
      driverForm.resetFields();
      fetchDrivers();
    } catch {
      message.error(t('common.failed'));
    }
  };

  const handleDeleteDriver = async (id: number) => {
    try {
      await api.delete(`/system/drivers/${id}`);
      message.success(t('pages.settings.driverDeleted'));
      fetchDrivers();
    } catch {
      message.error(t('common.failed'));
    }
  };

  const configColumns = [
    {
      title: t('pages.settings.category'),
      dataIndex: 'category',
      key: 'cat',
      width: 130,
      render: (c: string) => (
        <Tag color="geekblue" style={{ fontWeight: 600 }}>
          {c.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: t('pages.settings.configKey'),
      dataIndex: 'key',
      key: 'key',
      width: 220,
      render: (k: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: '#096dd9' }}>
          {k}
        </span>
      ),
    },
    {
      title: t('pages.settings.configValue'),
      dataIndex: 'value',
      key: 'val',
      render: (v: string | null) => (
        <span style={{ fontFamily: 'var(--mono)', background: '#fafafa', padding: '2px 8px', borderRadius: 4, border: '1px solid #f0f0f0' }}>
          {v ?? '-'}
        </span>
      ),
    },
    {
      title: t('pages.settings.description'),
      dataIndex: 'description',
      key: 'desc',
      render: (d: string | null) => (
        <span style={{ color: '#8c8c8c' }}>{d || '-'}</span>
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 100,
      render: (_: unknown, record: SystemConfig) => (
        <Popconfirm
          title={t('pages.settings.confirmDeleteConfig')}
          okText={t('common.confirm') || '确定'}
          cancelText={t('common.cancel') || '取消'}
          okType="danger"
          onConfirm={() => handleDeleteConfig(record.id)}
        >
          <Button icon={<DeleteOutlined />} size="small" danger>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const driverColumns = [
    {
      title: t('pages.settings.driverName'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (n: string) => (
        <span style={{ fontWeight: 600 }}>{n}</span>
      ),
    },
    {
      title: t('pages.settings.protocol'),
      dataIndex: 'protocol',
      key: 'proto',
      width: 140,
      render: (p: string) => (
        <Tag color="cyan" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {p.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: t('pages.settings.description'),
      dataIndex: 'description',
      key: 'desc',
      render: (d: string | null) => (
        <span style={{ color: '#595959' }}>{d || '-'}</span>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'active',
      width: 120,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'} icon={v ? <CheckCircleOutlined /> : undefined}>
          {v ? '驱动已装载' : '未装载'}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 100,
      render: (_: unknown, record: CameraDriver) => (
        <Popconfirm
          title={t('pages.settings.confirmDeleteDriver')}
          okText={t('common.confirm') || '确定'}
          cancelText={t('common.cancel') || '取消'}
          okType="danger"
          onConfirm={() => handleDeleteDriver(record.id)}
        >
          <Button icon={<DeleteOutlined />} size="small" danger>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Metric Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="活动系统全局配置项"
              value={configs.length}
              prefix={<SettingOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="工业相机驱动协议适配"
              value={drivers.length}
              prefix={<ApiOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="系统运行模式"
              value="工业边缘超频实时流"
              prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />}
              styles={{ content: { fontSize: 18 } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ color: '#1890ff' }} />
            <span>{t('pages.settings.title') || '系统全局参数与工业相机驱动配置'}</span>
          </div>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={reloadAll} loading={loading}>
            {t('common.refresh') || '刷新'}
          </Button>
        }
      >
        <Tabs
          items={[
            {
              key: 'configs',
              label: (
                <Space>
                  <SettingOutlined />
                  <span>{t('pages.settings.systemConfig')}</span>
                </Space>
              ),
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setConfigModalOpen(true)}
                    >
                      {t('pages.settings.addConfig')}
                    </Button>
                  </div>
                  <Table
                    columns={configColumns}
                    dataSource={configs}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                  />
                </>
              ),
            },
            {
              key: 'drivers',
              label: (
                <Space>
                  <ApiOutlined />
                  <span>{t('pages.settings.cameraDrivers')}</span>
                </Space>
              ),
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setDriverModalOpen(true)}
                    >
                      {t('pages.settings.addDriver')}
                    </Button>
                  </div>
                  <Table
                    columns={driverColumns}
                    dataSource={drivers}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                  />
                </>
              ),
            },
          ]}
        />

        <Modal
          title={t('pages.settings.addConfig')}
          open={configModalOpen}
          onCancel={() => setConfigModalOpen(false)}
          onOk={() => configForm.submit()}
          destroyOnClose
        >
          <Form form={configForm} layout="vertical" onFinish={handleCreateConfig}>
            <Form.Item name="category" label={t('pages.settings.category')} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'general', label: t('pages.settings.catGeneral') },
                  { value: 'detection', label: t('pages.settings.catDetection') },
                  { value: 'storage', label: t('pages.settings.catStorage') },
                  { value: 'notification', label: t('pages.settings.catNotification') },
                ]}
                placeholder={t('pages.settings.selectCategory')}
              />
            </Form.Item>
            <Form.Item name="key" label={t('pages.settings.configKey')} rules={[{ required: true }]}>
              <Input placeholder="例如: default_confidence_threshold" />
            </Form.Item>
            <Form.Item name="value" label={t('pages.settings.configValue')}>
              <Input placeholder="例如: 0.65" />
            </Form.Item>
            <Form.Item name="description" label={t('pages.settings.description')}>
              <Input placeholder="配置说明" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={t('pages.settings.addCameraDriver')}
          open={driverModalOpen}
          onCancel={() => setDriverModalOpen(false)}
          onOk={() => driverForm.submit()}
          destroyOnClose
        >
          <Form form={driverForm} layout="vertical" onFinish={handleCreateDriver}>
            <Form.Item
              name="name"
              label={t('pages.settings.driverName')}
              rules={[{ required: true }]}
            >
              <Input placeholder={t('pages.settings.driverNamePlaceholder')} />
            </Form.Item>
            <Form.Item name="protocol" label={t('pages.settings.protocol')} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'rtsp', label: 'RTSP (实时流协议)' },
                  { value: 'gigE', label: 'GigE Vision (千兆网工业高速相机)' },
                  { value: 'usb', label: 'USB3.0 (工控 UVC 直连)' },
                  { value: 'http', label: 'HTTP / MJPEG 流' },
                ]}
              />
            </Form.Item>
            <Form.Item name="description" label={t('pages.settings.description')}>
              <Input.TextArea rows={2} placeholder="驱动参数及硬件特异性说明" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
}
