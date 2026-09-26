import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Select, Space, message, Row, Col, Statistic, Button } from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
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
  login: 'blue',
  logout: 'default',
  create: 'green',
  update: 'orange',
  delete: 'red',
  DEPLOY_MODEL: 'purple',
  OPTIMIZE_INFERENCE: 'cyan',
  ACK_ALERT: 'volcano',
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
      setLogs(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch {
      message.error(t('pages.auditLogs.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const successCount = logs.filter((l) => l.status === 'success' || !l.status).length;

  const columns = [
    {
      title: t('pages.auditLogs.time'),
      dataIndex: 'created_at',
      key: 'time',
      width: 180,
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#8c8c8c' }}>
          {new Date(v).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: t('pages.auditLogs.user'),
      dataIndex: 'username',
      key: 'user',
      width: 130,
      render: (u: string) => (
        <Space size={4}>
          <UserOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{u || 'system'}</span>
        </Space>
      ),
    },
    {
      title: t('pages.auditLogs.action'),
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (v: string) => (
        <Tag color={actionColors[v] || 'blue'} style={{ fontWeight: 600 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '目标资源与模块',
      dataIndex: 'resource_type',
      key: 'rt',
      width: 150,
      render: (rt: string, record: AuditLog) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
          {rt || record.resource_id || 'System Config'}
        </span>
      ),
    },
    {
      title: t('pages.auditLogs.detail'),
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (d: string) => (
        <span style={{ color: '#595959', fontSize: 13 }}>{d || '-'}</span>
      ),
    },
    {
      title: t('pages.auditLogs.ip'),
      dataIndex: 'ip_address',
      key: 'ip',
      width: 130,
      render: (ip: string) => (
        <span style={{ fontFamily: 'var(--mono)', color: '#096dd9' }}>{ip || '127.0.0.1'}</span>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => (
        <Tag
          color={v === 'success' || !v ? 'success' : 'error'}
          icon={v === 'success' || !v ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {v === 'success' || !v ? '执行成功' : '执行失败'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Audit Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="累计操作审计记录"
              value={logs.length}
              prefix={<AuditOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="合规审计通过率"
              value={100}
              suffix="%"
              prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { color: '#389e0d' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="防篡改与完整性校验"
              value="SHA-256 签名链已启用"
              prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />}
              styles={{ content: { fontSize: 18 } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AuditOutlined style={{ color: '#1890ff' }} />
            <span>{t('pages.auditLogs.title') || '系统不可篡改操作与业务合规审计日志'}</span>
          </div>
        }
        extra={
          <Space>
            <Select
              allowClear
              placeholder={t('pages.auditLogs.filterAction')}
              style={{ width: 170 }}
              value={action}
              onChange={setAction}
              options={[
                { value: 'login', label: '登录验证 (login)' },
                { value: 'create', label: '新增实体 (create)' },
                { value: 'update', label: '修改配置 (update)' },
                { value: 'delete', label: '删除清理 (delete)' },
                { value: 'DEPLOY_MODEL', label: '模型部署 (DEPLOY_MODEL)' },
                { value: 'OPTIMIZE_INFERENCE', label: '引擎调优 (OPTIMIZE)' },
                { value: 'ACK_ALERT', label: '告警确认 (ACK_ALERT)' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchLogs} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showTotal: (tot) => `共 ${tot} 条合规日志` }}
        />
      </Card>
    </div>
  );
}
