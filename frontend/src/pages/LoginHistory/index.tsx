import { useState, useEffect } from 'react';
import { Card, Table, Tag, Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

interface LoginRecord {
  id: number;
  username: string | null;
  action: string;
  detail: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
}

export default function LoginHistory() {
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [targetUserId, setTargetUserId] = useState<number | undefined>();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const isAdmin = currentUser?.role === 'admin';

  const loadHistory = async (p: number) => {
    setLoading(true);
    try {
      const endpoint = isAdmin && targetUserId
        ? `/auth/login-history/${targetUserId}`
        : '/auth/login-history';
      const res = await api.get(endpoint, { params: { skip: (p - 1) * 20, limit: 20 } });
      setRecords(res.data);
      setTotal(res.data.length < 20 ? (p - 1) * 20 + res.data.length : p * 20 + 1);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(page);
  }, [page, targetUserId]);

  const columns = [
    {
      title: t('loginHistory.time') || '时间',
      dataIndex: 'created_at',
      key: 'time',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: t('loginHistory.action') || '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'login' ? 'blue' : 'default'}>
          {val === 'login' ? '登录' : '登出'}
        </Tag>
      ),
    },
    {
      title: t('loginHistory.status') || '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'success' ? 'green' : 'red'}>
          {val === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: t('loginHistory.detail') || '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: t('loginHistory.ip') || 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 140,
    },
    {
      title: t('loginHistory.device') || '设备',
      dataIndex: 'user_agent',
      key: 'ua',
      ellipsis: true,
      render: (val: string | null) => {
        if (!val) return '-';
        const short = val.length > 50 ? val.substring(0, 50) + '...' : val;
        return <span title={val || ''}>{short}</span>;
      },
    },
  ];

  return (
    <Card
      title={t('loginHistory.title') || '登录历史'}
      extra={isAdmin ? (
        <Space>
          <span>用户：</span>
          <Select
            allowClear
            placeholder="选择用户"
            style={{ width: 200 }}
            value={targetUserId}
            onChange={(val) => { setTargetUserId(val); setPage(1); }}
            options={[{ value: undefined as any, label: '全部' }]}
          />
        </Space>
      ) : undefined}
    >
      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showSizeChanger: false,
        }}
      />
    </Card>
  );
}
