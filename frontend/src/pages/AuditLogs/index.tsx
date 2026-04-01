import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Select, Space, message } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  detail: string | null;
  ip_address: string | null;
  status: string;
  created_at: string;
}

const actionColors: Record<string, string> = {
  login: 'blue', logout: 'default', create: 'green', update: 'orange', delete: 'red',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | undefined>();
  const { t } = useTranslation();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (action) params.action = action;
      const res = await api.get('/auth/audit-logs', { params });
      setLogs(res.data);
    } catch {
      message.error(t('pages.auditLogs.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const columns = [
    { title: t('pages.auditLogs.time'), dataIndex: 'created_at', key: 'time', width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: t('pages.auditLogs.user'), dataIndex: 'username', key: 'user', width: 100 },
    { title: t('pages.auditLogs.action'), dataIndex: 'action', key: 'action', width: 80,
      render: (v: string) => <Tag color={actionColors[v] || 'default'}>{v}</Tag> },
    { title: t('pages.auditLogs.resourceType'), dataIndex: 'resource_type', key: 'rt', width: 100 },
    { title: t('pages.auditLogs.resourceId'), dataIndex: 'resource_id', key: 'rid', width: 100 },
    { title: t('pages.auditLogs.detail'), dataIndex: 'detail', key: 'detail', ellipsis: true },
    { title: t('pages.auditLogs.ip'), dataIndex: 'ip_address', key: 'ip', width: 120 },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'success' ? 'green' : 'red'}>{v}</Tag> },
  ];

  return (
    <Card
      title={t('pages.auditLogs.title')}
      extra={
        <Space>
          <Select
            allowClear placeholder={t('pages.auditLogs.filterAction')} style={{ width: 120 }}
            value={action} onChange={setAction}
            options={['login', 'logout', 'create', 'update', 'delete'].map(a => ({ value: a, label: a }))}
          />
        </Space>
      }
    >
      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
      />
    </Card>
  );
}
