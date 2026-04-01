import { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
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
      setConfigs(res.data);
    } catch { /* empty */ }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await api.get('/system/drivers');
      setDrivers(res.data);
    } catch { /* empty */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchConfigs(), fetchDrivers()]).finally(() => setLoading(false));
  }, [fetchConfigs, fetchDrivers]);

  const handleCreateConfig = async (values: Record<string, string>) => {
    try {
      await api.post('/system/configs', values);
      message.success(t('pages.settings.configSaved'));
      setConfigModalOpen(false);
      configForm.resetFields();
      fetchConfigs();
    } catch {
      message.error(t('pages.settings.saveFailed'));
    }
  };

  const handleDeleteConfig = async (id: number) => {
    try {
      await api.delete(`/system/configs/${id}`);
      fetchConfigs();
    } catch {
      message.error(t('pages.settings.deleteFailed'));
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
      message.error(t('pages.settings.addFailed'));
    }
  };

  const handleDeleteDriver = async (id: number) => {
    try {
      await api.delete(`/system/drivers/${id}`);
      fetchDrivers();
    } catch {
      message.error(t('pages.settings.deleteFailed'));
    }
  };

  const configColumns = [
    { title: t('pages.settings.category'), dataIndex: 'category', key: 'category', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('pages.settings.key'), dataIndex: 'key', key: 'key' },
    { title: t('pages.settings.value'), dataIndex: 'value', key: 'value' },
    { title: t('pages.settings.description'), dataIndex: 'description', key: 'description' },
    {
      title: t('common.actions'), key: 'action',
      render: (_: unknown, record: SystemConfig) => (
        <Popconfirm title={t('pages.settings.confirmDelete')} onConfirm={() => handleDeleteConfig(record.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    },
  ];

  const driverColumns = [
    { title: t('common.name'), dataIndex: 'name', key: 'name' },
    { title: t('pages.settings.protocol'), dataIndex: 'protocol', key: 'protocol', render: (v: string) => <Tag color="blue">{v.toUpperCase()}</Tag> },
    { title: t('pages.settings.description'), dataIndex: 'description', key: 'description' },
    {
      title: t('common.status'), dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('common.enabled') : t('common.disabled')}</Tag>,
    },
    {
      title: t('common.actions'), key: 'action',
      render: (_: unknown, record: CameraDriver) => (
        <Popconfirm title={t('pages.settings.confirmDelete')} onConfirm={() => handleDeleteDriver(record.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card title={t('pages.settings.title')}>
      <Tabs items={[
        {
          key: 'configs',
          label: t('pages.settings.systemConfig'),
          children: (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setConfigModalOpen(true)}>{t('pages.settings.addConfig')}</Button>
              </Space>
              <Table columns={configColumns} dataSource={configs} rowKey="id" loading={loading} pagination={false} size="small" />
            </>
          ),
        },
        {
          key: 'drivers',
          label: t('pages.settings.cameraDrivers'),
          children: (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setDriverModalOpen(true)}>{t('pages.settings.addDriver')}</Button>
              </Space>
              <Table columns={driverColumns} dataSource={drivers} rowKey="id" loading={loading} pagination={false} size="small" />
            </>
          ),
        },
      ]} />

      <Modal title={t('pages.settings.addConfig')} open={configModalOpen} onCancel={() => setConfigModalOpen(false)} onOk={() => configForm.submit()}>
        <Form form={configForm} layout="vertical" onFinish={handleCreateConfig}>
          <Form.Item name="category" label={t('pages.settings.category')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'general', label: t('pages.settings.catGeneral') },
              { value: 'detection', label: t('pages.settings.catDetection') },
              { value: 'storage', label: t('pages.settings.catStorage') },
              { value: 'notification', label: t('pages.settings.catNotification') },
            ]} placeholder={t('pages.settings.selectCategory')} />
          </Form.Item>
          <Form.Item name="key" label={t('pages.settings.configKey')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="value" label={t('pages.settings.configValue')}><Input /></Form.Item>
          <Form.Item name="description" label={t('pages.settings.description')}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pages.settings.addCameraDriver')} open={driverModalOpen} onCancel={() => setDriverModalOpen(false)} onOk={() => driverForm.submit()}>
        <Form form={driverForm} layout="vertical" onFinish={handleCreateDriver}>
          <Form.Item name="name" label={t('pages.settings.driverName')} rules={[{ required: true }]}><Input placeholder={t('pages.settings.driverNamePlaceholder')} /></Form.Item>
          <Form.Item name="protocol" label={t('pages.settings.protocol')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'rtsp', label: 'RTSP' },
              { value: 'gigE', label: 'GigE Vision' },
              { value: 'usb', label: 'USB' },
              { value: 'http', label: 'HTTP' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label={t('pages.settings.description')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
