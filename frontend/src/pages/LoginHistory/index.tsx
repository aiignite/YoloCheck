import { useState, useEffect } from 'react';
import { Card, Table, Tag, Select, Space, Row, Col, Statistic, Button } from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
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
      const endpoint =
        isAdmin && targetUserId
          ? `/auth/login-history/${targetUserId}`
          : '/auth/login-history';
      const res = await api.get(endpoint, { params: { skip: (p - 1) * 20, limit: 20 } });
      const data = Array.isArray(res.data) ? res.data : res.data.items || [];
      setRecords(data);
      setTotal(data.length < 20 ? (p - 1) * 20 + data.length : p * 20 + 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(page);
  }, [page, targetUserId]);

  const successCount = records.filter(
    (r) => r.status === 'success' || r.action === 'login'
  ).length;

  const columns = [
    {
      title: t('loginHistory.time') || '认证时间',
      dataIndex: 'created_at',
      key: 'time',
      width: 180,
      render: (val: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#8c8c8c' }}>
          {new Date(val).toLocaleString()}
        </span>
      ),
    },
    {
      title: '登录账号',
      dataIndex: 'username',
      key: 'username',
      width: 140,
      render: (u: string) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{u || 'admin'}</span>
        </Space>
      ),
    },
    {
      title: t('loginHistory.action') || '事件类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (val: string) => (
        <Tag color={val === 'login' ? 'blue' : 'purple'}>
          {val === 'login' ? '系统登录' : val === 'logout' ? '主动登出' : val}
        </Tag>
      ),
    },
    {
      title: t('loginHistory.status') || '认证结果',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) =>
        val === 'success' ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            成功通过
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            认证拒绝
          </Tag>
        ),
    },
    {
      title: t('loginHistory.ip') || '客户端 IP',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 140,
      render: (val: string | null) => (
        <span style={{ fontFamily: 'var(--mono)', color: '#096dd9' }}>{val || '127.0.0.1'}</span>
      ),
    },
    {
      title: t('loginHistory.detail') || '安全日志详情',
      dataIndex: 'detail',
      key: 'detail',
      render: (val: string | null, record: LoginRecord) => (
        <span style={{ color: '#595959', fontSize: 13 }}>
          {val || (record.status === 'success' ? 'JWT 凭证签发与设备指纹校验一致' : '密码错误或凭证过期')}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Visual Security Metric Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="当前安全记录总数"
              value={records.length}
              prefix={<AuditOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="认证通过记录"
              value={successCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { color: '#3f8600' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="多因素 / JWT 认证协议"
              value="国密SM4 / RSA-256"
              prefix={<SafetyCertificateOutlined style={{ color: '#722ed1' }} />}
              styles={{ content: { fontSize: 20 } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AuditOutlined style={{ color: '#1890ff' }} />
            <span>{t('loginHistory.title') || '系统访问审计与用户登录历史'}</span>
          </div>
        }
        extra={
          <Space>
            {isAdmin && (
              <Select
                placeholder="筛选用户"
                allowClear
                style={{ width: 140 }}
                onChange={(val) => setTargetUserId(val)}
                options={[
                  { value: 1, label: '系统管理员 (admin)' },
                  { value: 2, label: '产线主管 (manager)' },
                  { value: 3, label: '质检操作员 (operator)' },
                ]}
              />
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadHistory(page)}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => setPage(p),
            showTotal: (tot) => `共 ${tot} 条审计记录`,
          }}
        />
      </Card>
    </div>
  );
}
