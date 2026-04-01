import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Upload, Modal, Form, Input, Select, Tag, Progress,
  Space, message, Descriptions, Image, Row, Col, Statistic, Tabs, InputNumber,
  List, Checkbox, Divider,
} from 'antd';
import {
  UploadOutlined, PlayCircleOutlined, EyeOutlined,
  VideoCameraOutlined, ClockCircleOutlined, AimOutlined, EditOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface VideoTemplate {
  id: number;
  name: string;
  description: string | null;
  video_path: string;
  duration_seconds: number | null;
  fps: number | null;
  frame_count: number | null;
  resolution: string | null;
  business_type: string;
  station_id: string | null;
  learning_config?: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

interface LearningSession {
  id: number;
  template_id: number;
  status: string;
  progress: number;
  total_frames: number;
  processed_frames: number;
  objects_detected: number;
  actions_identified: number;
  learning_mode?: string | null;
  focus_classes?: string[] | null;
  sample_rate?: number | null;
  min_confidence?: number | null;
  scene_threshold?: number | null;
  error_message: string | null;
  analysis_result: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ActionSequence {
  id: number;
  step_order: number;
  action_name: string;
  user_defined_name?: string | null;
  note?: string | null;
  is_kept: boolean;
  description: string | null;
  start_time: number | null;
  end_time: number | null;
  duration: number | null;
  confidence: number | null;
  keyframe_path: string | null;
  objects_in_scene: string[] | null;
  features?: Record<string, any> | null;
}

const defaultFocusClasses = ['screwdriver', 'product', 'hand'];

export default function VideoLearning() {
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [actions, setActions] = useState<ActionSequence[]>([]);
  const [uploadForm] = Form.useForm();
  const [configForm] = Form.useForm();
  const [editActionForm] = Form.useForm();
  const [editingAction, setEditingAction] = useState<ActionSequence | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [compareTargetId, setCompareTargetId] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<Record<string, any> | null>(null);
  const { t } = useTranslation();

  const businessTypeOptions = [
    { value: 'assembly', label: t('pages.videoLearning.assembly') },
    { value: 'welding', label: t('pages.videoLearning.welding') },
    { value: 'inspection', label: t('pages.videoLearning.inspection') },
    { value: 'packaging', label: t('pages.videoLearning.packaging') },
    { value: 'custom', label: t('pages.videoLearning.custom') },
  ];

  const learningModes = [
    { value: 'action_and_object', label: t('pages.videoLearning.modeActionAndObject') },
    { value: 'action_only', label: t('pages.videoLearning.modeActionOnly') },
    { value: 'object_only', label: t('pages.videoLearning.modeObjectOnly') },
  ];

  const statusTagColor: Record<string, string> = {
    pending: 'default', analyzing: 'processing', completed: 'success', failed: 'error', running: 'processing',
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/video-learning/templates');
      setTemplates(res.data);
    } catch {
      message.error(t('pages.videoLearning.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openWorkbench = async (tpl: VideoTemplate) => {
    setSelectedTemplate(tpl);
    setDetailOpen(true);
    configForm.setFieldsValue({
      learning_mode: tpl.learning_config?.learning_mode || 'action_and_object',
      sample_rate: tpl.learning_config?.sample_rate || 5,
      min_confidence: tpl.learning_config?.min_confidence || 0.4,
      scene_threshold: tpl.learning_config?.scene_threshold || 30,
      focus_classes: tpl.learning_config?.focus_classes || defaultFocusClasses,
    });
    try {
      const sessRes = await api.get(`/video-learning/templates/${tpl.id}/sessions`);
      setSessions(sessRes.data);
      const completed = (sessRes.data as LearningSession[]).find((s) => s.status === 'completed') || sessRes.data[0];
      if (completed) {
        const actRes = await api.get(`/video-learning/sessions/${completed.id}/actions`);
        setActions(actRes.data);
      } else {
        setActions([]);
      }
    } catch {
      message.error(t('pages.videoLearning.detailFailed'));
    }
  };

  const handleUpload = async (values: Record<string, string>) => {
    const fileList = uploadForm.getFieldValue('file') as UploadFile[];
    if (!fileList?.length) {
      message.warning(t('pages.videoLearning.selectVideo'));
      return;
    }
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('business_type', values.business_type);
    if (values.description) formData.append('description', values.description);
    if (values.station_id) formData.append('station_id', values.station_id);
    formData.append('file', fileList[0].originFileObj as Blob);

    try {
      await api.post('/video-learning/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(t('pages.videoLearning.uploadSuccess'));
      setUploadOpen(false);
      uploadForm.resetFields();
      fetchTemplates();
    } catch {
      message.error(t('pages.videoLearning.uploadFailed'));
    }
  };

  const saveLearningConfig = async () => {
    if (!selectedTemplate) return;
    const values = await configForm.validateFields();
    try {
      await api.put(`/video-learning/templates/${selectedTemplate.id}/config`, {
        learning_config: values,
      });
      setSelectedTemplate((prev) => prev ? { ...prev, learning_config: values } : prev);
      message.success(t('pages.videoLearning.configSaved'));
      fetchTemplates();
    } catch {
      message.error(t('pages.videoLearning.configSaveFailed'));
    }
  };

  const startLearning = async (templateId: number) => {
    const values = configForm.getFieldsValue();
    try {
      await api.post(`/video-learning/templates/${templateId}/learn`, values);
      message.success(t('pages.videoLearning.learningStarted'));
      fetchTemplates();
      if (selectedTemplate) {
        openWorkbench(selectedTemplate);
      }
    } catch {
      message.error(t('pages.videoLearning.startLearningFailed'));
    }
  };

  const openActionEdit = (action: ActionSequence) => {
    setEditingAction(action);
    editActionForm.setFieldsValue({
      user_defined_name: action.user_defined_name || action.action_name,
      note: action.note || '',
      is_kept: action.is_kept,
    });
    setEditingOpen(true);
  };

  const saveActionEdit = async () => {
    if (!editingAction) return;
    const values = await editActionForm.validateFields();
    try {
      const res = await api.put(`/video-learning/actions/${editingAction.id}`, values);
      setActions((prev) => prev.map((a) => a.id === editingAction.id ? res.data : a));
      setEditingOpen(false);
      setEditingAction(null);
      message.success(t('pages.videoLearning.actionUpdated'));
    } catch {
      message.error(t('pages.videoLearning.actionUpdateFailed'));
    }
  };

  const splitAction = async (action: ActionSequence) => {
    if (!selectedTemplate || action.start_time == null || action.end_time == null) return;
    const midFrame = Math.floor(((action.start_time + action.end_time) / 2) * (selectedTemplate.fps || 1));
    try {
      const res = await api.post(`/video-learning/actions/${action.id}/split`, { target_frame: midFrame });
      setActions(res.data);
      message.success(t('pages.videoLearning.actionSplitSuccess'));
    } catch {
      message.error(t('pages.videoLearning.actionSplitFailed'));
    }
  };

  const mergeAction = async (action: ActionSequence) => {
    try {
      const res = await api.post(`/video-learning/actions/${action.id}/merge`, { with_previous: true });
      setActions(res.data);
      message.success(t('pages.videoLearning.actionMergeSuccess'));
    } catch {
      message.error(t('pages.videoLearning.actionMergeFailed'));
    }
  };

  const runCompare = async () => {
    if (!selectedTemplate || !compareTargetId) return;
    try {
      const res = await api.get(`/video-learning/templates/${selectedTemplate.id}/compare/${compareTargetId}`);
      setCompareResult(res.data);
    } catch {
      message.error(t('pages.videoLearning.compareFailed'));
    }
  };

  const latestSession = sessions.find((s) => s.status === 'completed') || sessions[0];
  const objectFrequency = latestSession?.analysis_result?.analysis?.object_frequency || {};

  const columns = [
    { title: t('common.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('pages.videoLearning.businessType'),
      dataIndex: 'business_type',
      key: 'business_type',
      render: (v: string) => businessTypeOptions.find((o) => o.value === v)?.label || v,
    },
    {
      title: t('pages.videoLearning.duration'),
      dataIndex: 'duration_seconds',
      key: 'duration',
      render: (v: number | null) => (v ? `${v.toFixed(1)}s` : '-'),
    },
    { title: t('camera.resolution'), dataIndex: 'resolution', key: 'resolution' },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusTagColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: unknown, record: VideoTemplate) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openWorkbench(record)}>
            {t('pages.videoLearning.workbench')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={t('pages.videoLearning.title')}
        extra={
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            {t('pages.videoLearning.uploadVideoTemplate')}
          </Button>
        }
      >
        <Table columns={columns} dataSource={templates} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={t('pages.videoLearning.uploadVideoTemplate')}
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => uploadForm.submit()}
        okText={t('common.upload')}
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="name" label={t('pages.videoLearning.templateName')} rules={[{ required: true }]}>
            <Input placeholder={t('pages.videoLearning.templateNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="business_type" label={t('pages.videoLearning.businessType')} rules={[{ required: true }]}>
            <Select options={businessTypeOptions} placeholder={t('pages.videoLearning.selectType')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="station_id" label={t('pages.videoLearning.stationId')}>
            <Input placeholder={t('pages.videoLearning.stationIdPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="file"
            label={t('pages.videoLearning.videoFile')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: t('pages.videoLearning.selectVideo') }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept="video/*">
              <Button icon={<UploadOutlined />}>{t('pages.videoLearning.selectFile')}</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedTemplate?.name || t('pages.videoLearning.learningDetail')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={1200}
        destroyOnHidden
      >
        {selectedTemplate && (
          <Row gutter={16}>
            <Col span={8}>
              <Card title={t('pages.videoLearning.templateInfo')} size="small">
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label={t('pages.videoLearning.businessType')}>{selectedTemplate.business_type}</Descriptions.Item>
                  <Descriptions.Item label={t('camera.resolution')}>{selectedTemplate.resolution}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.videoLearning.duration')}>{selectedTemplate.duration_seconds?.toFixed(1)}s</Descriptions.Item>
                  <Descriptions.Item label={t('pages.videoLearning.totalFrames')}>{selectedTemplate.frame_count}</Descriptions.Item>
                  <Descriptions.Item label={t('common.status')}>
                    <Tag color={statusTagColor[selectedTemplate.status]}>{selectedTemplate.status}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title={t('pages.videoLearning.learningConfig')} size="small" style={{ marginTop: 16 }}>
                <Form form={configForm} layout="vertical">
                  <Form.Item name="learning_mode" label={t('pages.videoLearning.learningMode')}>
                    <Select options={learningModes} />
                  </Form.Item>
                  <Form.Item name="sample_rate" label={t('pages.videoLearning.sampleRate')}>
                    <InputNumber min={1} max={30} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="min_confidence" label={t('pages.videoLearning.minConfidence')}>
                    <InputNumber min={0.1} max={1} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="scene_threshold" label={t('pages.videoLearning.sceneThreshold')}>
                    <InputNumber min={5} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="focus_classes" label={t('pages.videoLearning.focusClasses')}>
                    <Select mode="tags" tokenSeparators={[',']} placeholder={t('pages.videoLearning.focusClassesPlaceholder')} />
                  </Form.Item>
                  <Space>
                    <Button onClick={saveLearningConfig}>{t('common.save')}</Button>
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => startLearning(selectedTemplate.id)}>
                      {t('pages.videoLearning.learn')}
                    </Button>
                  </Space>
                </Form>
              </Card>
            </Col>

            <Col span={16}>
              {latestSession && (
                <>
                  <Row gutter={16}>
                    <Col span={6}><Card size="small"><Statistic title={t('pages.videoLearning.detectedObjects')} value={latestSession.objects_detected} prefix={<AimOutlined />} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title={t('pages.videoLearning.identifiedActions')} value={latestSession.actions_identified} prefix={<VideoCameraOutlined />} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title={t('pages.videoLearning.processedFrames')} value={latestSession.processed_frames} prefix={<ClockCircleOutlined />} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title={t('common.status')} value={latestSession.status} /></Card></Col>
                  </Row>

                  {latestSession.status === 'running' && (
                    <Card size="small" style={{ marginTop: 16 }}>
                      <Progress percent={latestSession.progress} status="active" />
                    </Card>
                  )}

                  <Card title={t('pages.videoLearning.workbench')} size="small" style={{ marginTop: 16 }}>
                    <Tabs
                      items={[
                        {
                          key: 'timeline',
                          label: t('pages.videoLearning.timeline'),
                          children: (
                            <List
                              dataSource={actions}
                              renderItem={(action) => (
                                <List.Item
                                  actions={[
                                    <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => openActionEdit(action)}>
                                      {t('common.edit')}
                                    </Button>,
                                    <Button key="split" size="small" onClick={() => splitAction(action)}>
                                      {t('pages.videoLearning.split')}
                                    </Button>,
                                    <Button key="merge" size="small" onClick={() => mergeAction(action)}>
                                      {t('pages.videoLearning.mergePrev')}
                                    </Button>,
                                  ]}
                                >
                                  <List.Item.Meta
                                    title={`${t('pages.videoLearning.step')} ${action.step_order}: ${action.user_defined_name || action.action_name}`}
                                    description={
                                      <Space direction="vertical" size={2}>
                                        <span>{action.start_time?.toFixed(1)}s - {action.end_time?.toFixed(1)}s ({action.duration?.toFixed(1)}s)</span>
                                        <span>{action.description}</span>
                                        <Space wrap>
                                          {action.objects_in_scene?.map((obj) => <Tag key={obj}>{obj}</Tag>)}
                                        </Space>
                                      </Space>
                                    }
                                  />
                                </List.Item>
                              )}
                            />
                          ),
                        },
                        {
                          key: 'pose',
                          label: t('pages.videoLearning.poseLearning'),
                          children: (
                            <Row gutter={[12, 12]}>
                              {actions.map((action) => (
                                <Col span={12} key={action.id}>
                                  <Card size="small" title={`${t('pages.videoLearning.step')} ${action.step_order}`}>
                                    <div>{t('pages.videoLearning.poseFrames')}: {action.features?.pose_summary?.frames_with_pose ?? 0}</div>
                                    <div>{t('pages.videoLearning.wristSpanX')}: {action.features?.pose_summary?.wrist_span_x ?? 0}</div>
                                    <div>{t('pages.videoLearning.wristSpanY')}: {action.features?.pose_summary?.wrist_span_y ?? 0}</div>
                                  </Card>
                                </Col>
                              ))}
                            </Row>
                          ),
                        },
                        {
                          key: 'objects',
                          label: t('pages.videoLearning.objectLearning'),
                          children: (
                            <Row gutter={[12, 12]}>
                              {Object.entries(objectFrequency).map(([name, count]) => (
                                <Col span={8} key={name}>
                                  <Card size="small">
                                    <Statistic title={name} value={count as number} />
                                  </Card>
                                </Col>
                              ))}
                              {Object.keys(objectFrequency).length === 0 && <div>{t('pages.videoLearning.noObjectStats')}</div>}
                            </Row>
                          ),
                        },
                        {
                          key: 'compare',
                          label: t('pages.videoLearning.templateCompare'),
                          children: (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Space>
                                <Select
                                  style={{ width: 260 }}
                                  placeholder={t('pages.videoLearning.selectCompareTemplate')}
                                  value={compareTargetId ?? undefined}
                                  onChange={setCompareTargetId}
                                  options={templates.filter((tpl) => tpl.id !== selectedTemplate.id).map((tpl) => ({ value: tpl.id, label: tpl.name }))}
                                />
                                <Button onClick={runCompare}>{t('pages.videoLearning.compareNow')}</Button>
                              </Space>
                              {compareResult && (
                                <Card size="small">
                                  <Descriptions size="small" column={1}>
                                    <Descriptions.Item label={t('pages.videoLearning.sourceActionCount')}>{compareResult.source_action_count}</Descriptions.Item>
                                    <Descriptions.Item label={t('pages.videoLearning.targetActionCount')}>{compareResult.target_action_count}</Descriptions.Item>
                                    <Descriptions.Item label={t('pages.videoLearning.commonObjects')}>
                                      <Space wrap>
                                        {(compareResult.common_objects || []).map((obj: string) => <Tag key={obj}>{obj}</Tag>)}
                                      </Space>
                                    </Descriptions.Item>
                                    <Descriptions.Item label={t('pages.videoLearning.avgDurationGap')}>{compareResult.avg_duration_gap}</Descriptions.Item>
                                  </Descriptions>
                                </Card>
                              )}
                            </Space>
                          ),
                        },
                        {
                          key: 'keyframes',
                          label: t('pages.videoLearning.keyframes'),
                          children: (
                            <Row gutter={[12, 12]}>
                              {actions.filter((a) => a.keyframe_path).map((a) => (
                                <Col span={8} key={a.id}>
                                  <Card size="small" title={`${t('pages.videoLearning.step')} ${a.step_order}`}>
                                    <Image
                                      width="100%"
                                      src={`${api.defaults.baseURL?.replace('/api', '')}/${a.keyframe_path}`}
                                      fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4="
                                    />
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div>{a.user_defined_name || a.action_name}</div>
                                  </Card>
                                </Col>
                              ))}
                              {actions.filter((a) => a.keyframe_path).length === 0 && <div>{t('pages.videoLearning.noKeyframes')}</div>}
                            </Row>
                          ),
                        },
                      ]}
                    />
                  </Card>
                </>
              )}
            </Col>
          </Row>
        )}
      </Modal>

      <Modal
        title={t('pages.videoLearning.editAction')}
        open={editingOpen}
        onCancel={() => setEditingOpen(false)}
        onOk={saveActionEdit}
        destroyOnHidden
      >
        <Form form={editActionForm} layout="vertical">
          <Form.Item name="user_defined_name" label={t('pages.videoLearning.actionName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="note" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="is_kept" valuePropName="checked">
            <Checkbox>{t('pages.videoLearning.keepAsStandardAction')}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
