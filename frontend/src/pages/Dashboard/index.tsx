import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CameraOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface DashboardData {
  total_production: number;
  total_defects: number;
  yield_rate: number;
  oee: number;
  active_cameras: number;
  total_cameras: number;
  unacknowledged_alerts: number;
  critical_alerts: number;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const { t } = useTranslation();

  const fetchData = async () => {
    try {
      const [dashRes, eventsRes, alertsRes] = await Promise.all([
        api.get('/stats/dashboard'),
        api.get('/events', { params: { limit: 10 } }),
        api.get('/alerts', { params: { limit: 10, acknowledged: false } }),
      ]);
      setData(dashRes.data);
      setEvents(eventsRes.data);
      setAlerts(alertsRes.data);
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 5000);
    return () => clearInterval(timer);
  }, []);

  const severityColor: Record<string, string> = {
    critical: 'red',
    warning: 'orange',
    info: 'blue',
  };

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('pages.dashboard.todayProduction')}
              value={data?.total_production ?? 0}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('pages.dashboard.yieldRate')}
              value={data?.yield_rate ?? 100}
              suffix="%"
              precision={1}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: (data?.yield_rate ?? 100) >= 95 ? '#3f8600' : '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('pages.dashboard.activeCameras')}
              value={`${data?.active_cameras ?? 0} / ${data?.total_cameras ?? 0}`}
              prefix={<CameraOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('pages.dashboard.unacknowledgedAlerts')}
              value={data?.unacknowledged_alerts ?? 0}
              prefix={<WarningOutlined />}
              styles={{ content: { color: (data?.unacknowledged_alerts ?? 0) > 0 ? '#cf1322' : '#3f8600' } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card title={t('pages.dashboard.recentEvents')} size="small">
            <Table
              dataSource={events}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: t('pages.dashboard.camera'), dataIndex: 'camera_id', width: 100 },
                { title: t('pages.dashboard.type'), dataIndex: 'event_type', width: 80, render: (t: string) => <Tag>{t}</Tag> },
                { title: t('pages.dashboard.confidence'), dataIndex: 'confidence', width: 80, render: (v: number) => `${(v * 100).toFixed(0)}%` },
                { title: t('pages.dashboard.time'), dataIndex: 'event_time', render: (t: string) => new Date(t).toLocaleString() },
              ]}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title={t('pages.dashboard.alertNotifications')} size="small">
            <div>
              {alerts.map((item: any) => (
                <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
                  <Tag color={severityColor[item.severity]}>{item.severity}</Tag>
                  <span style={{ flex: 1 }}>{item.message}</span>
                </div>
              ))}
              {alerts.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>{t('pages.dashboard.noAlerts')}</div>}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
