import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, message, Popconfirm, Row, Col, Statistic } from 'antd';
import {
  LogoutOutlined,
  DesktopOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface Session {
  id: number;
  jti: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
  last_accessed_at: string;
  is_current: boolean;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/sessions');
      setSessions(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch {
      message.error('加载会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const terminateSession = async (id: number) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      message.success('会话已终止');
      loadSessions();
    } catch {
      message.error('终止会话失败');
    }
  };

  const columns = [
    {
      title: t('sessions.device') || '设备终端',
      dataIndex: 'device_info',
      key: 'device',
      width: 180,
      render: (val: string | null) => (
        <Space size={6}>
          <DesktopOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 600 }}>{val || '工控机终端 / PC'}</span>
        </Space>
      ),
    },
    {
      title: t('sessions.ip') || '客户端 IP',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 140,
      render: (val: string | null) => (
        <span style={{ fontFamily: 'var(--mono)', color: '#096dd9' }}>{val || '127.0.0.1'}</span>
      ),
    },
    {
      title: t('sessions.browser') || '系统与浏览器标识 (User-Agent)',
      dataIndex: 'user_agent',
      key: 'ua',
      ellipsis: true,
      render: (val: string | null) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#595959' }}>
          {val || 'Chrome/124.0 (Industrial Edge OS)'}
        </span>
      ),
    },
    {
      title: t('sessions.loginTime') || '会话建立时间',
      dataIndex: 'created_at',
      key: 'created',
      width: 180,
      render: (val: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#8c8c8c' }}>
          {new Date(val).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('sessions.lastActive') || '最近心跳时间',
      dataIndex: 'last_accessed_at',
      key: 'last',
      width: 180,
      render: (val: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#389e0d', fontWeight: 600 }}>
          {new Date(val).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('sessions.status') || '会话状态',
      key: 'status',
      width: 120,
      render: (_: unknown, record: Session) =>
        record.is_current ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            当前活跃
          </Tag>
        ) : (
          <Tag color="default">其他终端</Tag>
        ),
    },
    {
      title: t('sessions.action') || '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Session) =>
        !record.is_current ? (
          <Popconfirm
            title="确定要强制下线此会话吗？"
            okText={t('common.confirm') || '确定'}
            cancelText={t('common.cancel') || '取消'}
            okType="danger"
            onConfirm={() => terminateSession(record.id)}
          >
            <Button size="small" danger icon={<LogoutOutlined />}>
              {t('sessions.terminate') || '下线'}
            </Button>
          </Popconfirm>
        ) : (
          <span style={{ color: '#bfbfbf', fontSize: 12 }}>本机</span>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Session Security Overview */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="在线会话连接数"
              value={sessions.length}
              prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="当前受保护登录终端"
              value="本机在线"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { color: '#3f8600', fontSize: 20 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="安全鉴权机制"
              value="JWT + 双令牌自刷新"
              prefix={<SafetyCertificateOutlined style={{ color: '#722ed1' }} />}
              styles={{ content: { fontSize: 20 } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GlobalOutlined style={{ color: '#1890ff' }} />
            <span>{t('sessions.title') || '在线会话管理与安全强退'}</span>
          </div>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadSessions} loading={loading}>
            {t('common.refresh') || '刷新'}
          </Button>
        }
      >
        <Table
          dataSource={sessions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
}
