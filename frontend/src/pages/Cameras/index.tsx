import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
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
      setCameras(res.data);
    } catch (e) {
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
      onOk: async () => {
        await api.delete(`/cameras/${id}`);
        message.success(t('pages.cameras.deleteSuccess'));
        fetchCameras();
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'camera_id', width: 100 },
    { title: t('common.name'), dataIndex: 'name', width: 120 },
    { title: t('camera.location'), dataIndex: 'location', width: 120 },
    { title: t('pages.cameras.type'), dataIndex: 'type', width: 80, render: (t: string) => <Tag>{t}</Tag> },
    {
      title: t('common.status'), dataIndex: 'status', width: 80,
      render: (s: string) => <Tag color={s === 'online' ? 'green' : 'default'}>{s}</Tag>,
    },
    { title: t('pages.cameras.streamUrl'), dataIndex: 'stream_url', ellipsis: true },
    {
      title: t('common.actions'), width: 160,
      render: (_: any, record: Camera) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingCamera(record);
            form.setFieldsValue(record);
            setModalVisible(true);
          }}>{t('common.edit')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>{t('common.delete')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingCamera(null);
          form.resetFields();
          setModalVisible(true);
        }}>{t('camera.add')}</Button>
      </div>

      <Table
        columns={columns}
        dataSource={cameras}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingCamera ? t('pages.cameras.editCamera') : t('camera.add')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); setEditingCamera(null); }}
      >
        <Form form={form} layout="vertical">
          {!editingCamera && (
            <Form.Item name="camera_id" label={t('pages.cameras.cameraId')} rules={[{ required: true }]}>
              <Input placeholder={t('pages.cameras.cameraIdPlaceholder')} />
            </Form.Item>
          )}
          <Form.Item name="name" label={t('common.name')}>
            <Input placeholder={t('pages.cameras.namePlaceholder')} />
          </Form.Item>
          <Form.Item name="location" label={t('camera.location')}>
            <Input placeholder={t('pages.cameras.locationPlaceholder')} />
          </Form.Item>
          <Form.Item name="type" label={t('pages.cameras.type')} rules={[{ required: !editingCamera }]}>
            <Select placeholder={t('pages.cameras.selectType')}>
              <Select.Option value="rtsp">{t('pages.cameras.rtspCamera')}</Select.Option>
              <Select.Option value="gigE">{t('pages.cameras.gigECamera')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="stream_url" label={t('pages.cameras.streamUrl')}>
            <Input placeholder="rtsp://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Cameras;
