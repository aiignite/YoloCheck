import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Tag, Space, message, Popconfirm, Descriptions } from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface MESOrder {
  id: number;
  order_no: string;
  product_name: string | null;
  product_code: string | null;
  target_quantity: number | null;
  completed_quantity: number;
  defect_quantity: number;
  station_id: string | null;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  created_at: string;
}

interface QualityReport {
  order_no: string;
  product_name: string | null;
  target_quantity: number;
  completed_quantity: number;
  defect_quantity: number;
  yield_rate: number;
  defect_rate: number;
}

export default function MES() {
  const [orders, setOrders] = useState<MESOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const statusLabels: Record<string, string> = {
    pending: t('pages.mes.statusPending'), in_progress: t('pages.mes.statusInProgress'), completed: t('pages.mes.statusCompleted'), cancelled: t('pages.mes.statusCancelled'),
  };
  const statusColors: Record<string, string> = {
    pending: 'default', in_progress: 'processing', completed: 'success', cancelled: 'error',
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/mes/orders');
      setOrders(res.data);
    } catch {
      message.error(t('pages.mes.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await api.post('/mes/orders', values);
      message.success(t('pages.mes.createSuccess'));
      setCreateOpen(false);
      form.resetFields();
      fetchOrders();
    } catch {
      message.error(t('pages.mes.createFailed'));
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/mes/orders/${id}`, { status });
      message.success(t('pages.mes.statusUpdateSuccess'));
      fetchOrders();
    } catch {
      message.error(t('pages.mes.updateFailed'));
    }
  };

  const viewReport = async (id: number) => {
    try {
      const res = await api.get(`/mes/orders/${id}/quality-report`);
      setReport(res.data);
      setReportOpen(true);
    } catch {
      message.error(t('pages.mes.reportFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/mes/orders/${id}`);
      message.success(t('pages.mes.deleteSuccess'));
      fetchOrders();
    } catch {
      message.error(t('pages.mes.deleteFailed'));
    }
  };

  const columns = [
    { title: t('pages.mes.orderNo'), dataIndex: 'order_no', key: 'order_no' },
    { title: t('pages.mes.product'), dataIndex: 'product_name', key: 'product_name' },
    { title: t('pages.mes.targetQuantity'), dataIndex: 'target_quantity', key: 'target_quantity' },
    { title: t('pages.mes.completedQuantity'), dataIndex: 'completed_quantity', key: 'completed_quantity' },
    { title: t('pages.mes.defectQuantity'), dataIndex: 'defect_quantity', key: 'defect_quantity' },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: t('common.actions'), key: 'action',
      render: (_: unknown, record: MESOrder) => (
        <Space>
          {record.status === 'pending' && (
            <Button size="small" onClick={() => updateStatus(record.id, 'in_progress')}>{t('pages.mes.startProduction')}</Button>
          )}
          {record.status === 'in_progress' && (
            <Button size="small" type="primary" onClick={() => updateStatus(record.id, 'completed')}>{t('pages.mes.complete')}</Button>
          )}
          <Button size="small" icon={<FileTextOutlined />} onClick={() => viewReport(record.id)}>{t('pages.mes.qualityReport')}</Button>
          <Popconfirm title={t('pages.mes.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={t('pages.mes.title')}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{t('pages.mes.newOrder')}</Button>}
      >
        <Table columns={columns} dataSource={orders} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title={t('pages.mes.newOrder')} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="order_no" label={t('pages.mes.orderNo')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="product_name" label={t('pages.mes.productName')}><Input /></Form.Item>
          <Form.Item name="product_code" label={t('pages.mes.productCode')}><Input /></Form.Item>
          <Form.Item name="target_quantity" label={t('pages.mes.targetQuantity')} rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="station_id" label={t('pages.mes.stationId')}><Input placeholder={t('pages.mes.stationIdPlaceholder')} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pages.mes.qualityReport')} open={reportOpen} onCancel={() => setReportOpen(false)} footer={null}>
        {report && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t('pages.mes.orderNo')}>{report.order_no}</Descriptions.Item>
            <Descriptions.Item label={t('pages.mes.product')}>{report.product_name}</Descriptions.Item>
            <Descriptions.Item label={t('pages.mes.targetQuantity')}>{report.target_quantity}</Descriptions.Item>
            <Descriptions.Item label={t('pages.mes.completedQuantity')}>{report.completed_quantity}</Descriptions.Item>
            <Descriptions.Item label={t('pages.mes.defectQuantity')}>{report.defect_quantity}</Descriptions.Item>
            <Descriptions.Item label={t('pages.mes.yieldRate')}>
              <Tag color={report.yield_rate >= 95 ? 'green' : report.yield_rate >= 90 ? 'orange' : 'red'}>
                {report.yield_rate}%
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.mes.defectRate')}>
              <Tag color={report.defect_rate <= 2 ? 'green' : report.defect_rate <= 5 ? 'orange' : 'red'}>
                {report.defect_rate}%
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
