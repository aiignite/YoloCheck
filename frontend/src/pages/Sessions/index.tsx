import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, message, Popconfirm } from 'antd';
import { LogoutOutlined, DesktopOutlined } from '@ant-design/icons';
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
      setSessions(res.data);
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
      title: t('sessions.device') || '设备',
      dataIndex: 'device_info',
      key: 'device',
      render: (val: string | null) => (
        <Space>
          <DesktopOutlined />
          <span>{val || '-'}</span>
        </Space>
      ),
    },
    {
      title: t('sessions.ip') || 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip',
      render: (val: string | null) => val || '-',
    },
    {
      title: t('sessions.browser') || '浏览器',
      dataIndex: 'user_agent',
      key: 'ua',
      ellipsis: true,
      render: (val: string | null) => {
        if (!val) return '-';
        const short = val.length > 60 ? val.substring(0, 60) + '...' : val;
        return <span title={val}>{short}</span>;
      },
    },
    {
      title: t('sessions.loginTime') || '登录时间',
      dataIndex: 'created_at',
      key: 'created',
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: t('sessions.lastActive') || '最后活跃',
      dataIndex: 'last_accessed_at',
      key: 'last',
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: t('sessions.status') || '状态',
      key: 'status',
      render: (_: unknown, record: Session) =>
        record.is_current ? <Tag color="green">当前会话</Tag> : <Tag>其他</Tag>,
    },
    {
      title: t('sessions.action') || '操作',
      key: 'action',
      render: (_: unknown, record: Session) =>
        !record.is_current ? (
          <Popconfirm
            title="确定要终止此会话吗？"
            onConfirm={() => terminateSession(record.id)}
          >
            <Button size="small" danger icon={<LogoutOutlined />}>
              {t('sessions.terminate') || '终止'}
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Card title={t('sessions.title') || '会话管理'}>
      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />
    </Card>
  );
}
