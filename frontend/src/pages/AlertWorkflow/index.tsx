import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  Switch, message, Row, Col, Statistic, Popconfirm, Tabs,
} from 'antd';
import {
  PlusOutlined, ThunderboltOutlined, SendOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as echarts from 'echarts';
import api from '../../utils/api';

interface AlertRule {
  id: number;
  name: string;
  description: string;
  severity: string;
  condition_type: string;
  condition_config: any;
  notification_channels: string;
  escalation_minutes: number;
  escalation_target: string;
  is_enabled: boolean;
  created_at: string;
}

interface TrendItem {
  date: string;
  critical: number;
  warning: number;
  info: number;
}

const severityMap: Record<string, { color: string; text: string }> = {
  critical: { color: 'red', text: '严重' },
  warning: { color: 'orange', text: '警告' },
  info: { color: 'blue', text: '信息' },
};

const condTypeMap: Record<string, string> = {
  threshold: '阈值触发',
  pattern: '模式匹配',
  frequency: '频率触发',
};

const channelOptions = [
  { value: 'email', label: '邮件' },
  { value: 'dingtalk', label: '钉钉' },
  { value: 'wechat', label: '企业微信' },
  { value: 'sms', label: '短信' },
];

const AlertWorkflow: React.FC = () => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();
  const chartRef = React.useRef<HTMLDivElement>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/alert-workflow/rules');
      setRules(data);
    } catch { message.error('加载规则失败'); }
    setLoading(false);
  };

  const fetchTrends = async () => {
    try {
      const { data } = await api.get('/alert-workflow/trends?days=14');
      setTrends(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchRules(); fetchTrends(); }, []);

  useEffect(() => {
    if (!chartRef.current || trends.length === 0) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['严重', '警告', '信息'] },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: trends.map(t => t.date.slice(5)) },
      yAxis: { type: 'value' },
      series: [
        { name: '严重', data: trends.map(t => t.critical), type: 'bar', stack: 'total', color: '#ff4d4f' },
        { name: '警告', data: trends.map(t => t.warning), type: 'bar', stack: 'total', color: '#faad14' },
        { name: '信息', data: trends.map(t => t.info), type: 'bar', stack: 'total', color: '#1890ff' },
      ],
    });
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.dispose(); };
  }, [trends]);

  const handleSave = async (values: any) => {
    const payload = {
      ...values,
      notification_channels: (values.notification_channels || []).join(','),
      condition_config: {
        metric: values.metric || '',
        operator: values.operator || '>=',
        value: values.threshold_value ?? 0,
      },
    };
    try {
      if (editingRule) {
        await api.put(`/alert-workflow/rules/${editingRule.id}`, payload);
        message.success('规则已更新');
      } else {
        await api.post('/alert-workflow/rules', payload);
        message.success('规则已创建');
      }
      setModalOpen(false);
      setEditingRule(null);
      form.resetFields();
      fetchRules();
    } catch { message.error('保存失败'); }
  };

  const handleToggle = async (id: number) => {
    try { await api.post(`/alert-workflow/rules/${id}/toggle`); fetchRules(); }
    catch { message.error('切换失败'); }
  };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/alert-workflow/rules/${id}`); message.success('已删除'); fetchRules(); }
    catch { message.error('删除失败'); }
  };

  const handleCheckEscalation = async () => {
    try {
      const { data } = await api.post('/alert-workflow/check-escalation');
      message.info(data.message);
    } catch { message.error('检查失败'); }
  };

  const handleTestNotify = async (values: any) => {
    try {
      const { data } = await api.post('/alert-workflow/notify/test', values);
      message.success(data.message);
      setTestOpen(false);
    } catch { message.error('发送失败'); }
  };

  const openEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      ...rule,
      notification_channels: rule.notification_channels ? rule.notification_channels.split(',') : [],
      metric: rule.condition_config?.metric,
      operator: rule.condition_config?.operator,
      threshold_value: rule.condition_config?.value,
    });
    setModalOpen(true);
  };

  const ruleColumns: ColumnsType<AlertRule> = [
    { title: '规则名称', dataIndex: 'name', width: 160 },
    { title: '级别', dataIndex: 'severity', width: 80, render: v => {
      const s = severityMap[v]; return s ? <Tag color={s.color}>{s.text}</Tag> : v;
    }},
    { title: '类型', dataIndex: 'condition_type', width: 100, render: v => condTypeMap[v] || v },
    { title: '通知渠道', dataIndex: 'notification_channels', width: 180, render: v => v ? v.split(',').map((c: string) => (
      <Tag key={c}>{channelOptions.find(o => o.value === c)?.label || c}</Tag>
    )) : '-' },
    { title: '升级时间', dataIndex: 'escalation_minutes', width: 90, render: v => `${v}分钟` },
    { title: '状态', width: 80, render: (_, r) => (
      <Switch checked={r.is_enabled} size="small" onChange={() => handleToggle(r.id)} />
    )},
    { title: '操作', width: 140, render: (_, r) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  const totalTrend = trends.reduce((s, t) => s + t.critical + t.warning + t.info, 0);
  const criticalTrend = trends.reduce((s, t) => s + t.critical, 0);

  return (
    <div>
      <Tabs defaultActiveKey="rules" items={[
        { key: 'rules', label: '告警规则', children: (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card size="small"><Statistic title="规则总数" value={rules.length} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="启用中" value={rules.filter(r => r.is_enabled).length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="近14天告警" value={totalTrend} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="近14天严重" value={criticalTrend} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
            </Row>

            <Card
              title="告警规则配置"
              extra={
                <Space>
                  <Button icon={<ThunderboltOutlined />} onClick={handleCheckEscalation}>检查升级</Button>
                  <Button icon={<SendOutlined />} onClick={() => setTestOpen(true)}>测试通知</Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRule(null); form.resetFields(); setModalOpen(true); }}>新建规则</Button>
                </Space>
              }
            >
              <Table rowKey="id" columns={ruleColumns} dataSource={rules} loading={loading} pagination={false} />
            </Card>
          </div>
        )},
        { key: 'trends', label: '告警趋势', children: (
          <Card title="近14天告警趋势">
            <div ref={chartRef} style={{ width: '100%', height: 400 }} />
          </Card>
        )},
      ]} />

      {/* 新建/编辑规则 */}
      <Modal
        title={editingRule ? '编辑规则' : '新建告警规则'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingRule(null); }}
        onOk={() => form.submit()}
        destroyOnHidden
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="severity" label="告警级别" rules={[{ required: true }]}>
              <Select options={[{ value: 'critical', label: '严重' }, { value: 'warning', label: '警告' }, { value: 'info', label: '信息' }]} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="condition_type" label="条件类型" rules={[{ required: true }]}>
              <Select options={[{ value: 'threshold', label: '阈值触发' }, { value: 'pattern', label: '模式匹配' }, { value: 'frequency', label: '频率触发' }]} />
            </Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="metric" label="指标"><Input placeholder="如: defect_rate" /></Form.Item></Col>
            <Col span={8}><Form.Item name="operator" label="运算符">
              <Select options={[{ value: '>=', label: '>=' }, { value: '>', label: '>' }, { value: '<=', label: '<=' }, { value: '<', label: '<' }, { value: '==', label: '==' }]} />
            </Form.Item></Col>
            <Col span={8}><Form.Item name="threshold_value" label="阈值"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="notification_channels" label="通知渠道">
            <Select mode="multiple" options={channelOptions} placeholder="选择通知渠道" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="escalation_minutes" label="升级时间(分钟)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="escalation_target" label="升级目标"><Input placeholder="如: 主管邮箱" /></Form.Item></Col>
          </Row>
          <Form.Item name="is_enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      {/* 测试通知 */}
      <Modal
        title="测试通知"
        open={testOpen}
        onCancel={() => setTestOpen(false)}
        onOk={() => testForm.submit()}
        destroyOnHidden
      >
        <Form form={testForm} layout="vertical" onFinish={handleTestNotify}>
          <Form.Item name="channel" label="通知渠道" rules={[{ required: true }]}>
            <Select options={channelOptions} />
          </Form.Item>
          <Form.Item name="target" label="目标"><Input placeholder="如: user@example.com" /></Form.Item>
          <Form.Item name="message" label="消息内容" initialValue="YoloCheck 测试通知"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertWorkflow;
