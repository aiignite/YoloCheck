import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
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

interface ObjectAnnotationSetItem {
  id: number;
  name: string;
  description?: string | null;
  source_type: string;
  status: string;
  created_by?: number | null;
  created_at: string;
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

interface TrainingJobDetail {
  job: TrainingJobItem & {
    dataset_type: string;
    dataset_id: number;
    config_json?: Record<string, any> | null;
    metrics_json?: Record<string, any> | null;
    log_path?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    created_at?: string;
  };
  model?: {
    id: number;
    name: string;
    model_type: string;
    status: string;
    is_active?: boolean;
  } | null;
  runtime_summary: Record<string, any>;
  dataset_summary: {
    dataset_export?: Record<string, any>;
    sample_summary?: Record<string, any>;
    prototype_summary?: Record<string, any>;
    class_metrics?: Record<string, any>;
  };
  artifact_summary: {
    file_name?: string | null;
    file_path?: string | null;
    relative_path?: string | null;
    file_size?: number | null;
    exists: boolean;
    download_url?: string | null;
  };
  log_summary: {
    file_path?: string | null;
    relative_path?: string | null;
    exists: boolean;
    line_count: number;
    tail_lines: string[];
    view_url?: string | null;
  };
  status_timeline: Array<{
    status: string;
    label?: string | null;
    timestamp?: string | null;
  }>;
}

interface TemplateItem {
  id: number;
  name: string;
}

interface SessionItem {
  id: number;
  status: string;
}

const JOB_STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
};

export default function VideoTraining() {
  const [objectCategories, setObjectCategories] = useState<ObjectCategoryItem[]>([]);
  const [actionCategories, setActionCategories] = useState<ActionCategoryItem[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJobItem[]>([]);
  const [objectSetList, setObjectSetList] = useState<ObjectAnnotationSetItem[]>([]);
  const [actionSetList, setActionSetList] = useState<any[]>([]);
  const [templateList, setTemplateList] = useState<TemplateItem[]>([]);
  const [objectSessionOptions, setObjectSessionOptions] = useState<SessionItem[]>([]);
  const [actionSessionOptions, setActionSessionOptions] = useState<SessionItem[]>([]);
  const [actionImportForm] = Form.useForm();
  const [objectImportForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [objectCategoryOpen, setObjectCategoryOpen] = useState(false);
  const [objectSetOpen, setObjectSetOpen] = useState(false);
  const [actionSetOpen, setActionSetOpen] = useState(false);
  const [trainingJobOpen, setTrainingJobOpen] = useState(false);
  const [jobDetailOpen, setJobDetailOpen] = useState(false);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [selectedJobDetail, setSelectedJobDetail] = useState<TrainingJobDetail | null>(null);
  const [selectedAnnotationSetId, setSelectedAnnotationSetId] = useState<number | null>(null);
  const [fullLogContent, setFullLogContent] = useState('');
  const [objectCategoryForm] = Form.useForm();
  const [objectSetForm] = Form.useForm();
  const [actionSetForm] = Form.useForm();
  const [trainingJobForm] = Form.useForm();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [objectCategoryRes, actionCategoryRes, objectSetRes, actionSetRes, jobsRes, templateRes] = await Promise.all([
        api.get('/video-training/object-categories'),
        api.get('/video-training/action-categories'),
        api.get('/video-training/object-annotation-sets'),
        api.get('/video-training/action-sample-sets'),
        api.get('/video-training/training-jobs'),
        api.get('/video-learning/templates'),
      ]);
      setObjectCategories(objectCategoryRes.data);
      setActionCategories(actionCategoryRes.data);
      setObjectSetList(objectSetRes.data);
      setActionSetList(actionSetRes.data);
      setTrainingJobs(jobsRes.data);
      setTemplateList(Array.isArray(templateRes.data) ? templateRes.data : []);
    } catch {
      message.error('加载训练数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const hasRunning = trainingJobs.some((j) => j.status === 'running' || j.status === 'pending');
    if (hasRunning) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => void loadData(), 5000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [trainingJobs, loadData]);

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

  const createObjectAnnotationSet = async (values: Record<string, string>) => {
    try {
      await api.post('/video-training/object-annotation-sets', {
        ...values,
        source_type: 'video_frame',
      });
      message.success('标注集已创建');
      setObjectSetOpen(false);
      objectSetForm.resetFields();
      void loadData();
    } catch {
      message.error('创建标注集失败');
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

  const loadSessions = async (templateId: number, type: 'object' | 'action') => {
    try {
      const res = await api.get(`/video-learning/templates/${templateId}/sessions`);
      const sessions = Array.isArray(res.data) ? res.data.filter((item: SessionItem) => item.status === 'completed') : [];
      if (type === 'object') {
        setObjectSessionOptions(sessions);
        if (sessions[0]) objectImportForm.setFieldValue('session_id', sessions[0].id);
      } else {
        setActionSessionOptions(sessions);
        if (sessions[0]) actionImportForm.setFieldValue('session_id', sessions[0].id);
      }
    } catch {
      if (type === 'object') setObjectSessionOptions([]);
      else setActionSessionOptions([]);
      message.error('加载学习会话失败');
    }
  };

  const importObjectAnnotationsFromSession = async () => {
    try {
      const values = await objectImportForm.validateFields();
      await api.post(`/video-training/object-annotation-sets/${values.annotation_set_id}/annotations/from-session`, {
        session_id: values.session_id,
        min_confidence: values.min_confidence ?? 0.3,
      });
      message.success('已从学习会话导入物体标注');
      void loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('导入物体标注失败');
    }
  };

  const importSamplesFromSession = async () => {
    try {
      let values = await actionImportForm.validateFields();
      if (!values.session_id && actionSessionOptions[0]) {
        values = { ...values, session_id: actionSessionOptions[0].id };
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

  const createTrainingJob = async (values: Record<string, any>) => {
    try {
      await api.post('/video-training/training-jobs/object-detection', {
        name: values.name,
        dataset_id: values.dataset_id,
        epochs: values.epochs ?? 10,
        image_size: values.image_size ?? 640,
      });
      message.success('物体检测训练任务已创建');
      setTrainingJobOpen(false);
      trainingJobForm.resetFields();
      void loadData();
    } catch {
      message.error('创建训练任务失败');
    }
  };

  const openCreateTrainingJob = (annotationSetId: number) => {
    setSelectedAnnotationSetId(annotationSetId);
    trainingJobForm.setFieldValue('dataset_id', annotationSetId);
    setTrainingJobOpen(true);
  };

  const activateTrainingModel = async (jobId: number) => {
    try {
      await api.post(`/video-training/training-jobs/${jobId}/activate-model`);
      message.success('训练模型已激活，可在视频学习中使用');
      void loadData();
    } catch {
      message.error('激活训练模型失败');
    }
  };

  const openJobDetail = async (jobId: number) => {
    setJobDetailOpen(true);
    setJobDetailLoading(true);
    try {
      const res = await api.get(`/video-training/training-jobs/${jobId}`);
      setSelectedJobDetail(res.data);
    } catch {
      message.error('加载训练任务详情失败');
      setJobDetailOpen(false);
    } finally {
      setJobDetailLoading(false);
    }
  };

  const downloadTrainingArtifact = async (jobId: number) => {
    try {
      const res = await api.get(`/video-training/training-jobs/${jobId}/artifact`, {
        responseType: 'blob',
      });
      if (window.navigator.userAgent.includes('jsdom')) {
        return;
      }
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedJobDetail?.artifact_summary.file_name || `training_job_${jobId}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('下载训练产物失败');
    }
  };

  const loadFullTrainingLog = async (jobId: number) => {
    try {
      const res = await api.get(`/video-training/training-jobs/${jobId}/log`);
      setFullLogContent(typeof res.data === 'string' ? res.data : '');
    } catch {
      message.error('加载完整训练日志失败');
    }
  };

  const datasetClassNames = selectedJobDetail?.dataset_summary?.dataset_export?.class_names;

  const renderObjectImportForm = (setList: ObjectAnnotationSetItem[] | any[], formInstance: ReturnType<typeof Form.useForm>[0], sessions: SessionItem[], importFn: () => void, type: 'object' | 'action') => (
    <Card size="small" title="从学习会话导入">
      <Form form={formInstance} layout="vertical">
        <Form.Item name="template_id" label="选择模板" rules={[{ required: true }]}>
          <Select
            options={templateList.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => {
              formInstance.setFieldValue('session_id', undefined);
              void loadSessions(value, type);
            }}
          />
        </Form.Item>
        <Form.Item name="session_id" label="选择会话" rules={[{ required: true }]}>
          <Select options={sessions.map((item) => ({ value: item.id, label: `会话 ${item.id}` }))} />
        </Form.Item>
        {type === 'object' && (
          <Form.Item name="annotation_set_id" label="目标标注集" rules={[{ required: true }]}>
            <Select options={setList.map((item: any) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
        )}
        {type === 'action' && (
          <>
            <Form.Item name="sample_set_id" label="目标样本集" rules={[{ required: true }]}>
              <Select options={setList.map((item: any) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
            <Form.Item name="action_category_id" label="动作类别" rules={[{ required: true }]}>
              <Select options={actionCategories.map((item) => ({ value: item.id, label: item.display_name }))} />
            </Form.Item>
          </>
        )}
        <Button type="primary" onClick={() => void importFn()}>
          {type === 'object' ? '导入物体标注' : '导入会话动作'}
        </Button>
      </Form>
    </Card>
  );

  return (
    <div>
      <Card title="自定义训练工作台">
        <Tabs
          items={[
            {
              key: 'object-training',
              label: '物体检测训练',
              children: (
                <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                  <Card
                    size="small"
                    title="物体类别"
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
                  <Card
                    size="small"
                    title="标注集"
                    extra={<Button type="primary" onClick={() => setObjectSetOpen(true)}>新建标注集</Button>}
                  >
                    <Table
                      rowKey="id"
                      loading={loading}
                      pagination={false}
                      dataSource={objectSetList}
                      columns={[
                        { title: '名称', dataIndex: 'name', key: 'name' },
                        { title: '来源', dataIndex: 'source_type', key: 'source_type' },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          key: 'status',
                          render: (v: string) => <Tag color={v === 'ready' ? 'green' : 'blue'}>{v}</Tag>,
                        },
                        {
                          title: '操作',
                          key: 'actions',
                          render: (_: any, record: ObjectAnnotationSetItem) => (
                            <Button size="small" type="primary" onClick={() => openCreateTrainingJob(record.id)}>
                              开始训练
                            </Button>
                          ),
                        },
                      ]}
                    />
                  </Card>
                  {renderObjectImportForm(objectSetList, objectImportForm, objectSessionOptions, importObjectAnnotationsFromSession, 'object')}
                </Space>
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
                  {renderObjectImportForm(actionSetList, actionImportForm, actionSessionOptions, importSamplesFromSession, 'action')}
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
                    {
                      title: '任务类型',
                      dataIndex: 'job_type',
                      key: 'job_type',
                      render: (v: string) => v === 'object_detection' ? '物体检测' : '动作识别',
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (v: string) => <Tag color={JOB_STATUS_COLOR[v] || 'default'}>{v}</Tag>,
                    },
                    {
                      title: '进度',
                      dataIndex: 'progress',
                      key: 'progress',
                      render: (v: number, record: TrainingJobItem) => (
                        record.status === 'running' ? (
                          <Progress percent={Math.round(v)} size="small" style={{ width: 120 }} />
                        ) : (
                          `${Math.round(v)}%`
                        )
                      ),
                    },
                    {
                      title: '操作',
                      key: 'actions',
                      render: (_: any, record: TrainingJobItem) => (
                        <Space>
                          <Button size="small" onClick={() => void openJobDetail(record.id)}>
                            查看详情
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            disabled={record.status !== 'completed' || !record.model_id}
                            onClick={() => void activateTrainingModel(record.id)}
                          >
                            激活模型
                          </Button>
                        </Space>
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

      <Modal title="新建标注集" open={objectSetOpen} onCancel={() => setObjectSetOpen(false)} onOk={() => objectSetForm.submit()} destroyOnHidden>
        <Form form={objectSetForm} layout="vertical" onFinish={createObjectAnnotationSet}>
          <Form.Item name="name" label="标注集名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
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

      <Modal
        title={`创建训练任务 — 标注集 #${selectedAnnotationSetId ?? ''}`}
        open={trainingJobOpen}
        onCancel={() => setTrainingJobOpen(false)}
        onOk={() => trainingJobForm.submit()}
        destroyOnHidden
      >
        <Form form={trainingJobForm} layout="vertical" onFinish={createTrainingJob}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dataset_id" label="标注集" rules={[{ required: true }]}>
            <Select disabled options={objectSetList.map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item name="epochs" label="训练轮数 (epochs)" initialValue={10}>
            <InputNumber min={1} max={500} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="image_size" label="图片尺寸" initialValue={640}>
            <InputNumber min={64} max={2048} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="训练任务详情"
        open={jobDetailOpen}
        size="large"
        onClose={() => {
          setJobDetailOpen(false);
          setSelectedJobDetail(null);
          setFullLogContent('');
        }}
      >
        {selectedJobDetail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="训练流程">
              <Space wrap>
                <Tag color={selectedJobDetail.job.status === 'completed' ? 'green' : 'default'}>1. 数据准备</Tag>
                <Tag color={selectedJobDetail.job.status === 'completed' || selectedJobDetail.job.status === 'running' ? 'green' : 'default'}>2. 模型训练</Tag>
                <Tag color={selectedJobDetail.model?.id ? 'green' : 'default'}>3. 模型生成</Tag>
                <Tag color={selectedJobDetail.model?.is_active ? 'blue' : 'default'}>4. 模型激活</Tag>
              </Space>
              {selectedJobDetail.model?.is_active && (
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">模型已激活 - 可在视频学习工作台中使用</Tag>
                </div>
              )}
            </Card>

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="任务名称">{selectedJobDetail.job.name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={JOB_STATUS_COLOR[selectedJobDetail.job.status] || 'default'}>
                  {selectedJobDetail.job.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="任务类型">{selectedJobDetail.job.job_type}</Descriptions.Item>
              <Descriptions.Item label="模型">
                {selectedJobDetail.model?.name ? (
                  <Space>
                    {selectedJobDetail.model.name}
                    {selectedJobDetail.model?.is_active && <Tag color="blue">已激活</Tag>}
                  </Space>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="epochs">{selectedJobDetail.runtime_summary.epochs ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="image_size">{selectedJobDetail.runtime_summary.image_size ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="class_count">{selectedJobDetail.runtime_summary.class_count ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="inference_speed">{selectedJobDetail.runtime_summary.inference_speed ?? '-'}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="关键指标">
              <Row gutter={16}>
                <Col span={4}>
                  <Statistic title="mAP50" value={selectedJobDetail.runtime_summary.map50 ?? '-'} suffix={selectedJobDetail.runtime_summary.map50 != null ? '%' : ''} styles={{ content: { fontSize: 20 } }} />
                </Col>
                <Col span={4}>
                  <Statistic title="Accuracy" value={selectedJobDetail.runtime_summary.accuracy != null ? (selectedJobDetail.runtime_summary.accuracy * 100).toFixed(1) : '-'} suffix={selectedJobDetail.runtime_summary.accuracy != null ? '%' : ''} styles={{ content: { fontSize: 20 } }} />
                </Col>
                <Col span={4}>
                  <Statistic title="Precision" value={selectedJobDetail.runtime_summary.precision != null ? (selectedJobDetail.runtime_summary.precision * 100).toFixed(1) : '-'} suffix={selectedJobDetail.runtime_summary.precision != null ? '%' : ''} styles={{ content: { fontSize: 20 } }} />
                </Col>
                <Col span={4}>
                  <Statistic title="Recall" value={selectedJobDetail.runtime_summary.recall != null ? (selectedJobDetail.runtime_summary.recall * 100).toFixed(1) : '-'} suffix={selectedJobDetail.runtime_summary.recall != null ? '%' : ''} styles={{ content: { fontSize: 20 } }} />
                </Col>
                <Col span={4}>
                  <Statistic title="mAP50-95" value={selectedJobDetail.runtime_summary.map50_95 ?? '-'} suffix={selectedJobDetail.runtime_summary.map50_95 != null ? '%' : ''} styles={{ content: { fontSize: 20 } }} />
                </Col>
                <Col span={4}>
                  <Statistic title="推理速度" value={selectedJobDetail.runtime_summary.inference_speed != null ? selectedJobDetail.runtime_summary.inference_speed.toFixed(1) : '-'} suffix={selectedJobDetail.runtime_summary.inference_speed != null ? 'ms' : ''} styles={{ content: { fontSize: 20 } }} />
                </Col>
              </Row>
            </Card>

            <Card
              size="small"
              title="训练产物"
              extra={(
                <Button
                  size="small"
                  type="primary"
                  disabled={!selectedJobDetail.artifact_summary.exists}
                  onClick={() => void downloadTrainingArtifact(selectedJobDetail.job.id)}
                >
                  下载产物
                </Button>
              )}
            >
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="文件名">{selectedJobDetail.artifact_summary.file_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="文件路径">{selectedJobDetail.artifact_summary.file_path || '-'}</Descriptions.Item>
                <Descriptions.Item label="文件大小">{selectedJobDetail.artifact_summary.file_size ?? '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              size="small"
              title="训练日志摘要"
              extra={(
                <Button
                  size="small"
                  disabled={!selectedJobDetail.log_summary.exists}
                  onClick={() => void loadFullTrainingLog(selectedJobDetail.job.id)}
                >
                  查看完整日志
                </Button>
              )}
            >
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="日志路径">{selectedJobDetail.log_summary.file_path || '-'}</Descriptions.Item>
                <Descriptions.Item label="日志行数">{selectedJobDetail.log_summary.line_count}</Descriptions.Item>
              </Descriptions>
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {selectedJobDetail.log_summary.tail_lines.join('\n') || '暂无日志内容'}
              </Typography.Paragraph>
              {fullLogContent ? (
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, marginTop: 12 }}>
                  {fullLogContent}
                </Typography.Paragraph>
              ) : null}
            </Card>

            <Card size="small" title="数据集摘要">
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="标注数量">{selectedJobDetail.dataset_summary.dataset_export?.annotation_count ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="样本数量">{selectedJobDetail.dataset_summary.sample_summary?.total_samples ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="类别列表">{Array.isArray(datasetClassNames) && datasetClassNames.length > 0 ? datasetClassNames.join(', ') : '-'}</Descriptions.Item>
              </Descriptions>
              {selectedJobDetail.dataset_summary.class_metrics && Object.keys(selectedJobDetail.dataset_summary.class_metrics).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Typography.Text strong>类别分布:</Typography.Text>
                  <Space wrap style={{ marginTop: 8 }}>
                    {Object.entries(selectedJobDetail.dataset_summary.class_metrics).map(([className, count]) => (
                      <Tag key={className} color="blue">{className}: {count}</Tag>
                    ))}
                  </Space>
                </div>
              )}
            </Card>

            <Card size="small" title="状态时间线">
              <Descriptions size="small" column={1}>
                {selectedJobDetail.status_timeline.map((item) => (
                  <Descriptions.Item key={`${item.status}-${item.timestamp || 'none'}`} label={item.label || item.status}>
                    {item.timestamp || '-'}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          </Space>
        ) : jobDetailLoading ? (
          <Typography.Text>加载中...</Typography.Text>
        ) : null}
      </Drawer>
    </div>
  );
}
