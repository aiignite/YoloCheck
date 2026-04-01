import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Select, Space, message, Card, Row, Col, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface Alert {
  id: number;
  severity: string;
  message: string;
  camera_id: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  created_at: string;
}

interface AlertStatsData {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>();
  const { t } = useTranslation();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (filterSeverity) params.severity = filterSeverity;
      const [alertsRes, statsRes] = await Promise.all([
        api.get('/alerts', { params }),
        api.get('/alerts/stats'),
      ]);
      setAlerts(alertsRes.data);
      setStats(statsRes.data);
    } catch (e) {
      message.error(t('pages.alerts.fetchFailed'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterSeverity]);

  const handleAcknowledge = async (id: number) => {
    try {
      await api.put(`/alerts/${id}/acknowledge`, { acknowledged_by: 'admin' });
      message.success(t('pages.alerts.acknowledged'));
      fetchData();
    } catch (e) {
      message.error(t('pages.alerts.acknowledgeFailed'));
    }
  };

  const severityColor: Record<string, string> = {
    critical: 'red', warning: 'orange', info: 'blue',
  };

  const columns = [
    {
      title: t('pages.alerts.level'), dataIndex: 'severity', width: 100,
      render: (s: string) => <Tag color={severityColor[s]}>{s.toUpperCase()}</Tag>,
    },
    { title: t('alert.message'), dataIndex: 'message' },
    { title: t('pages.alerts.camera'), dataIndex: 'camera_id', width: 100 },
    {
      title: t('common.status'), dataIndex: 'acknowledged', width: 100,
      render: (v: boolean) => v ? <Tag color="green">{t('alert.acknowledged')}</Tag> : <Tag color="red">{t('pages.alerts.pending')}</Tag>,
    },
    {
      title: t('pages.alerts.time'), dataIndex: 'created_at', width: 180,
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: t('common.actions'), width: 100,
      render: (_: any, record: Alert) => (
        !record.acknowledged && (
          <Button size="small" type="primary" onClick={() => handleAcknowledge(record.id)}>
            {t('alert.acknowledge')}
          </Button>
        )
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title={t('pages.alerts.totalAlerts')} value={stats?.total ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title={t('alert.critical')} value={stats?.critical ?? 0} styles={{ content: { color: '#cf1322' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title={t('alert.warning')} value={stats?.warning ?? 0} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title={t('pages.alerts.pending')} value={stats?.unacknowledged ?? 0} styles={{ content: { color: '#1890ff' } }} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 150 }}
          placeholder={t('pages.alerts.filterLevel')}
          allowClear
          onChange={(v) => setFilterSeverity(v)}
        >
          <Select.Option value="critical">Critical</Select.Option>
          <Select.Option value="warning">Warning</Select.Option>
          <Select.Option value="info">Info</Select.Option>
        </Select>
      </Space>

      <Table columns={columns} dataSource={alerts} rowKey="id" loading={loading} />
    </div>
  );
};

export default Alerts;
