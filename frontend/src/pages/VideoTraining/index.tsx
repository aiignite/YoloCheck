import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import api from '../../utils/api';

interface ObjectCategoryItem {
  id: number;
  name: string;
  display_name: string;
  description?: string | null;
  color?: string | null;
}

interface ActionCategoryItem {
  id: number;
  name: string;
  display_name: string;
  description?: string | null;
}

interface TrainingJobItem {
  id: number;
  name: string;
  job_type: string;
  status: string;
  progress: number;
  model_id?: number | null;
}

interface TemplateItem {
  id: number;
  name: string;
}

interface SessionItem {
  id: number;
  status: string;
}

export default function VideoTraining() {
  const [objectCategories, setObjectCategories] = useState<ObjectCategoryItem[]>([]);
  const [actionCategories, setActionCategories] = useState<ActionCategoryItem[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJobItem[]>([]);
  const [actionSetList, setActionSetList] = useState<any[]>([]);
  const [templateList, setTemplateList] = useState<TemplateItem[]>([]);
  const [sessionOptions, setSessionOptions] = useState<SessionItem[]>([]);
  const [importForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [objectCategoryOpen, setObjectCategoryOpen] = useState(false);
  const [actionSetOpen, setActionSetOpen] = useState(false);
  const [objectCategoryForm] = Form.useForm();
  const [actionSetForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [objectCategoryRes, actionCategoryRes, _objectSetRes, actionSetRes, jobsRes, templateRes] = await Promise.all([
        api.get('/video-training/object-categories'),
        api.get('/video-training/action-categories'),
        api.get('/video-training/object-annotation-sets'),
        api.get('/video-training/action-sample-sets'),
        api.get('/video-training/training-jobs'),
        api.get('/video-learning/templates'),
      ]);
      setObjectCategories(objectCategoryRes.data);
      setActionCategories(actionCategoryRes.data);
      setActionSetList(actionSetRes.data);
      setTrainingJobs(jobsRes.data);
      setTemplateList(Array.isArray(templateRes.data) ? templateRes.data : []);
    } catch {
      message.error('加载训练数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createObjectCategory = async (values: Record<string, string>) => {
    try {
      await api.post('/video-training/object-categories', values);
      message.success('物体类别已创建');
      setObjectCategoryOpen(false);
      objectCategoryForm.resetFields();
      void loadData();
    } catch {
      message.error('创建物体类别失败');
    }
  };

  const createActionSampleSet = async (values: Record<string, string>) => {
    try {
      await api.post('/video-training/action-sample-sets', {
        ...values,
        source_type: 'pose_json',
      });
      message.success('动作样本集已创建');
      setActionSetOpen(false);
      actionSetForm.resetFields();
      void loadData();
    } catch {
      message.error('创建动作样本集失败');
    }
  };

  const loadTemplateSessions = async (templateId: number) => {
    try {
      const res = await api.get(`/video-learning/templates/${templateId}/sessions`);
      const sessions = Array.isArray(res.data) ? res.data.filter((item: SessionItem) => item.status === 'completed') : [];
      setSessionOptions(sessions);
      if (sessions[0]) {
        importForm.setFieldValue('session_id', sessions[0].id);
      }
    } catch {
      setSessionOptions([]);
      message.error('加载学习会话失败');
    }
  };

  const importSamplesFromSession = async () => {
    try {
      let values = await importForm.validateFields();
      if (!values.session_id && sessionOptions[0]) {
        values = { ...values, session_id: sessionOptions[0].id };
      }
      await api.post(`/video-training/action-sample-sets/${values.sample_set_id}/samples/from-session`, {
        session_id: values.session_id,
        action_category_id: values.action_category_id,
      });
      message.success('已导入会话动作样本');
      void loadData();
    } catch {
      message.error('导入会话动作样本失败');
    }
  };

  const activateTrainingModel = async (jobId: number) => {
    try {
      await api.post(`/video-training/training-jobs/${jobId}/activate-model`);
      message.success('训练模型已激活');
      void loadData();
    } catch {
      message.error('激活训练模型失败');
    }
  };

  return (
    <div>
      <Card title="自定义训练工作台">
        <Tabs
          items={[
            {
              key: 'object-categories',
              label: '物体类别',
              children: (
                <Card
                  size="small"
                  extra={<Button type="primary" onClick={() => setObjectCategoryOpen(true)}>新建物体类别</Button>}
                >
                  <Table
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    dataSource={objectCategories}
                    columns={[
                      { title: '类别编码', dataIndex: 'name', key: 'name' },
                      { title: '显示名称', dataIndex: 'display_name', key: 'display_name' },
                      { title: '描述', dataIndex: 'description', key: 'description' },
                      {
                        title: '颜色',
                        dataIndex: 'color',
                        key: 'color',
                        render: (value: string) => <Tag color={value || 'blue'}>{value || '-'}</Tag>,
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: 'action-samples',
              label: '动作样本',
              children: (
                <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                  <Card
                    size="small"
                    extra={<Button type="primary" onClick={() => setActionSetOpen(true)}>新建动作样本集</Button>}
                  >
                    <Table
                      rowKey="id"
                      loading={loading}
                      pagination={false}
                      dataSource={actionSetList}
                      columns={[
                        { title: '样本集名称', dataIndex: 'name', key: 'name' },
                        { title: '描述', dataIndex: 'description', key: 'description' },
                        { title: '来源', dataIndex: 'source_type', key: 'source_type' },
                      ]}
                    />
                  </Card>
                  <Card size="small" title="动作类别">
                    <Table
                      rowKey="id"
                      loading={loading}
                      pagination={false}
                      dataSource={actionCategories}
                      columns={[
                        { title: '类别编码', dataIndex: 'name', key: 'name' },
                        { title: '显示名称', dataIndex: 'display_name', key: 'display_name' },
                        { title: '描述', dataIndex: 'description', key: 'description' },
                      ]}
                    />
                  </Card>
                  <Card size="small" title="从学习会话导入">
                    <Form form={importForm} layout="vertical">
                      <Form.Item name="template_id" label="选择模板" rules={[{ required: true }]}>
                        <Select
                          options={templateList.map((item) => ({ value: item.id, label: item.name }))}
                          onChange={(value) => {
                            importForm.setFieldValue('session_id', undefined);
                            void loadTemplateSessions(value);
                          }}
                        />
                      </Form.Item>
                      <Button size="small" onClick={() => void loadTemplateSessions(templateList[0]?.id)}>
                        载入默认会话
                      </Button>
                      <Form.Item name="session_id" label="选择会话" rules={[{ required: true }]}>
                        <Select options={sessionOptions.map((item) => ({ value: item.id, label: `会话 ${item.id}` }))} />
                      </Form.Item>
                      <Form.Item name="sample_set_id" label="目标样本集" rules={[{ required: true }]}>
                        <Select options={actionSetList.map((item) => ({ value: item.id, label: item.name }))} />
                      </Form.Item>
                      <Form.Item name="action_category_id" label="动作类别" rules={[{ required: true }]}>
                        <Select options={actionCategories.map((item) => ({ value: item.id, label: item.display_name }))} />
                      </Form.Item>
                      <Button type="primary" onClick={() => void importSamplesFromSession()}>导入会话动作</Button>
                    </Form>
                  </Card>
                </Space>
              ),
            },
            {
              key: 'training-jobs',
              label: '训练任务',
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  dataSource={trainingJobs}
                  columns={[
                    { title: '任务名称', dataIndex: 'name', key: 'name' },
                          { title: '任务类型', dataIndex: 'job_type', key: 'job_type' },
                          { title: '状态', dataIndex: 'status', key: 'status' },
                          { title: '进度', dataIndex: 'progress', key: 'progress' },
                          {
                            title: '操作',
                            key: 'actions',
                            render: (_, record: TrainingJobItem) => (
                              <Button
                                size="small"
                                disabled={record.status !== 'completed' || !record.model_id}
                                onClick={() => void activateTrainingModel(record.id)}
                              >
                                激活模型
                              </Button>
                            ),
                          },
                        ]}
                      />
                ),
            },
          ]}
        />
      </Card>

      <Modal title="新建物体类别" open={objectCategoryOpen} onCancel={() => setObjectCategoryOpen(false)} onOk={() => objectCategoryForm.submit()} destroyOnHidden>
        <Form form={objectCategoryForm} layout="vertical" onFinish={createObjectCategory}>
          <Form.Item name="name" label="类别编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="color" label="颜色" initialValue="#1677ff">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新建动作样本集" open={actionSetOpen} onCancel={() => setActionSetOpen(false)} onOk={() => actionSetForm.submit()} destroyOnHidden>
        <Form form={actionSetForm} layout="vertical" onFinish={createActionSampleSet}>
          <Form.Item name="name" label="样本集名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
