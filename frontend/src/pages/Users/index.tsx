import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Row, Col, Statistic } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface User {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const roleColors: Record<string, string> = { admin: 'red', manager: 'blue', operator: 'green' };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch {
      message.error(t('pages.users.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (user: User) => {
    setEditing(user);
    form.setFieldsValue({ ...user, password: undefined });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string>) => {
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, {
          display_name: values.display_name,
          email: values.email,
          role: values.role,
        });
        message.success(t('pages.users.updateSuccess'));
      } else {
        await api.post('/users', values);
        message.success(t('pages.users.createSuccess'));
      }
      setModalOpen(false);
      fetchUsers();
    } catch {
      message.error(editing ? t('pages.users.updateFailed') : t('pages.users.createFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/users/${id}`);
      message.success(t('pages.users.deleteSuccess'));
      fetchUsers();
    } catch {
      message.error(t('pages.users.deleteFailed'));
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const managerCount = users.filter((u) => u.role === 'manager').length;
  const operatorCount = users.filter((u) => u.role === 'operator').length;

  const columns = [
    {
      title: t('auth.username'),
      dataIndex: 'username',
      key: 'username',
      render: (u: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: '#1890ff' }}>
          {u}
        </span>
      ),
    },
    {
      title: t('pages.users.displayName'),
      dataIndex: 'display_name',
      key: 'display_name',
      render: (name: string, record: User) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <span>{name || record.username}</span>
        </Space>
      ),
    },
    {
      title: t('user.email'),
      dataIndex: 'email',
      key: 'email',
      render: (em: string) => em || <span style={{ color: '#bfbfbf' }}>未绑定</span>,
    },
    {
      title: t('user.role'),
      dataIndex: 'role',
      key: 'role',
      render: (v: string) => (
        <Tag color={roleColors[v]} style={{ fontWeight: 600 }}>
          {t(`role.${v}`, v)}
        </Tag>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>
          {v ? t('pages.users.active') : t('pages.users.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: unknown, record: User) => (
        <Space size="small">
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('pages.users.confirmDelete')}
            okText={t('common.confirm') || '确定'}
            cancelText={t('common.cancel') || '取消'}
            okType="danger"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* RBAC Visual Header */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="系统注册总用户"
              value={users.length}
              prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="超级管理员 (Admin)"
              value={adminCount}
              prefix={<KeyOutlined style={{ color: '#cf1322' }} />}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="产线主管 (Manager)"
              value={managerCount}
              prefix={<SafetyCertificateOutlined style={{ color: '#096dd9' }} />}
              styles={{ content: { color: '#096dd9' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="质检操作员 (Operator)"
              value={operatorCount}
              prefix={<UserOutlined style={{ color: '#389e0d' }} />}
              styles={{ content: { color: '#389e0d' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: '#1890ff' }} />
            <span>{t('user.title')} (RBAC 角色权限管控)</span>
          </div>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('pages.users.addUser')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (tot) => `共 ${tot} 位账号成员` }}
        />
      </Card>

      <Modal
        title={editing ? t('pages.users.editUser') : t('pages.users.addUser')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="username"
            label={t('auth.username')}
            rules={[{ required: !editing, message: t('pages.users.usernameRequired') }]}
          >
            <Input disabled={!!editing} placeholder={t('auth.username')} />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="password"
              label={t('auth.password')}
              rules={[{ required: true, min: 6, message: t('pages.users.passwordMin') }]}
            >
              <Input.Password placeholder={t('auth.password')} />
            </Form.Item>
          )}
          <Form.Item name="display_name" label={t('pages.users.displayName')}>
            <Input placeholder={t('user.displayName')} />
          </Form.Item>
          <Form.Item name="email" label={t('user.email')}>
            <Input placeholder={t('user.email')} />
          </Form.Item>
          <Form.Item name="role" label={t('user.role')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'admin', label: t('role.admin') },
                { value: 'manager', label: t('role.manager') },
                { value: 'operator', label: t('role.operator') },
              ]}
              placeholder={t('pages.users.selectRole')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
