import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Select, Space, message, Card, Row, Col, Statistic, Tooltip } from 'antd';
import {
  DownloadOutlined,
  ThunderboltOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface Alert {
  id: number;
  severity: string;
  message: string;
  camera_id: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  status: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface AlertStatsData {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
  pending: number;
  investigating: number;
  resolved: number;
}

const statusTag = (status: string, t: (k: string) => string) => {
  if (status === 'resolved')
    return (
      <Tag color="success" icon={<CheckCircleOutlined />}>
        {t('pages.alerts.statusResolved')}
      </Tag>
    );
  if (status === 'investigating')
    return (
      <Tag color="warning" icon={<ClockCircleOutlined />}>
        {t('pages.alerts.statusInvestigating')}
      </Tag>
    );
  return (
    <Tag color="error" icon={<ExclamationCircleOutlined />}>
      {t('pages.alerts.statusPending')}
    </Tag>
  );
};

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (filterSeverity) params.severity = filterSeverity;
      if (filterStatus) params.status = filterStatus;
      const [alertsRes, statsRes] = await Promise.all([
        api.get('/alerts', { params }),
        api.get('/alerts/stats'),
      ]);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : alertsRes.data?.items || []);
      setStats(statsRes.data);
    } catch {
      message.error(t('pages.alerts.fetchFailed'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterSeverity, filterStatus]);

  const handleClaim = async (id: number) => {
    try {
      await api.put(`/alerts/${id}/claim`, { assigned_to: user?.username || 'admin' });
      message.success(t('pages.alerts.claimed'));
      fetchData();
    } catch {
      message.error(t('pages.alerts.actionFailed'));
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await api.put(`/alerts/${id}/resolve`, {});
      message.success(t('pages.alerts.resolved'));
      fetchData();
    } catch {
      message.error(t('pages.alerts.actionFailed'));
    }
  };

  const handleClaimAll = async () => {
    try {
      await api.post('/alerts/claim-all');
      message.success(t('pages.alerts.claimAllSuccess'));
      fetchData();
    } catch {
      message.error(t('pages.alerts.actionFailed'));
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/alerts/export/csv', { responseType: 'blob' });
      if (window.navigator.userAgent.includes('jsdom')) return;
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `alerts_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('pages.alerts.exportFailed'));
    }
  };

  const severityColor: Record<string, string> = {
    critical: 'red',
    warning: 'orange',
    info: 'blue',
  };

  const columns = [
    {
      title: t('pages.alerts.level'),
      dataIndex: 'severity',
      width: 110,
      render: (s: string) => (
        <Tag color={severityColor[s]} style={{ fontWeight: 600 }}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: t('alert.message'),
      dataIndex: 'message',
      render: (msg: string) => (
        <span style={{ fontWeight: 500, color: 'rgba(0,0,0,0.85)' }}>{msg}</span>
      ),
    },
    {
      title: t('pages.alerts.camera'),
      dataIndex: 'camera_id',
      width: 140,
      render: (cam: string) => (
        <Tag color="geekblue" style={{ fontFamily: 'var(--mono)' }}>
          {cam}
        </Tag>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 120,
      render: (status: string) => statusTag(status || 'pending', t),
    },
    {
      title: t('pages.alerts.assignee'),
      dataIndex: 'assigned_to',
      width: 120,
      render: (v: string | null) => (
        <Space size={4}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <span>{v || '-'}</span>
        </Space>
      ),
    },
    {
      title: t('pages.alerts.time'),
      dataIndex: 'created_at',
      width: 180,
      render: (t: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#8c8c8c' }}>
          {new Date(t).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('common.actions'),
      width: 120,
      render: (_: any, record: Alert) => {
        const status = record.status || 'pending';
        if (status === 'pending') {
          return (
            <Button size="small" type="primary" onClick={() => handleClaim(record.id)}>
              {t('pages.alerts.claim')}
            </Button>
          );
        }
        if (status === 'investigating') {
          return (
            <Button size="small" type="primary" ghost onClick={() => handleResolve(record.id)}>
              {t('pages.alerts.resolve')}
            </Button>
          );
        }
        return <Tag color="success">{t('pages.alerts.closed')}</Tag>;
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Visual Metric Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={4}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('pages.alerts.totalAlerts')}
              value={stats?.total ?? 0}
              prefix={<AlertOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('alert.critical')}
              value={stats?.critical ?? 0}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('alert.warning')}
              value={stats?.warning ?? 0}
              styles={{ content: { color: '#faad14' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('pages.alerts.statusPending')}
              value={stats?.pending ?? 0}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('pages.alerts.statusInvestigating')}
              value={stats?.investigating ?? 0}
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('pages.alerts.statusResolved')}
              value={stats?.resolved ?? 0}
              styles={{ content: { color: '#3f8600' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Alert Records Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertOutlined style={{ color: '#ff4d4f' }} />
            <span>产线缺陷与安防预警闭环工单库</span>
          </div>
        }
        extra={
          <Space wrap>
            <Select
              style={{ width: 130 }}
              placeholder={t('pages.alerts.filterLevel')}
              allowClear
              onChange={(v) => setFilterSeverity(v)}
            >
              <Select.Option value="critical">Critical (严重)</Select.Option>
              <Select.Option value="warning">Warning (警告)</Select.Option>
              <Select.Option value="info">Info (提示)</Select.Option>
            </Select>
            <Select
              style={{ width: 130 }}
              placeholder={t('pages.alerts.filterStatus')}
              allowClear
              value={filterStatus}
              onChange={(v) => setFilterStatus(v)}
            >
              <Select.Option value="pending">{t('pages.alerts.statusPending')}</Select.Option>
              <Select.Option value="investigating">{t('pages.alerts.statusInvestigating')}</Select.Option>
              <Select.Option value="resolved">{t('pages.alerts.statusResolved')}</Select.Option>
            </Select>
            <Tooltip title={t('pages.alerts.claimAllTip')}>
              <Button icon={<ThunderboltOutlined />} onClick={handleClaimAll}>
                {t('pages.alerts.claimAll')}
              </Button>
            </Tooltip>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              {t('pages.alerts.exportCsv')}
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={alerts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条告警工单` }}
        />
      </Card>
    </div>
  );
};

export default Alerts;
