import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card, Table, Button, Upload, Modal, Form, Input, Select, Tag, Progress,
  Space, message, Descriptions, Image, Row, Col, Statistic, Tabs, InputNumber,
  Checkbox, Divider, Slider, Flex,
} from 'antd';
import {
  UploadOutlined, PlayCircleOutlined, EyeOutlined,
  VideoCameraOutlined, ClockCircleOutlined, AimOutlined, EditOutlined, PauseOutlined,
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
  sop_content?: Record<string, any> | null;
  workflow_summary?: Record<string, any> | null;
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
  min_action_duration_seconds?: number | null;
  object_change_sensitivity?: string | null;
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
  suggestions?: Array<Record<string, any>> | null;
  features?: Record<string, any> | null;
}

interface FrameOverlay {
  frame_number: number;
  timestamp: number;
  image_path?: string | null;
  objects: Array<Record<string, any>>;
  pose_keypoints: Array<Record<string, any>>;
  interaction_summary?: Record<string, any> | null;
  scene_change_score?: number | null;
  is_action_boundary: boolean;
}

interface ModelOption {
  id: number;
  name: string;
  version: string;
  model_type: string;
}

const defaultFocusClasses: string[] = [];

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
  const [sopPreview, setSopPreview] = useState<Record<string, any> | null>(null);
  const [overlayFrames, setOverlayFrames] = useState<FrameOverlay[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showPose, setShowPose] = useState(true);
  const [objectModels, setObjectModels] = useState<ModelOption[]>([]);
  const [actionModels, setActionModels] = useState<ModelOption[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { t } = useTranslation();

  const resolveAssetUrl = useCallback((path?: string | null) => {
    if (!path) return '';
    const baseUrl = api.defaults.baseURL?.replace('/api', '') || '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/uploads/')) return `${baseUrl}${path}`;
    if (path.startsWith('uploads/')) return `${baseUrl}/${path}`;
    if (path.startsWith('/')) return `${baseUrl}${path}`;
    return `${baseUrl}/${path}`;
  }, []);

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

  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await api.get('/models');
        const allModels = Array.isArray(res.data) ? res.data : [];
        setObjectModels(allModels.filter((item) => item.model_type === 'custom_object'));
        setActionModels(allModels.filter((item) => item.model_type === 'custom_action'));
      } catch {
        setObjectModels([]);
        setActionModels([]);
      }
    };
    void loadModels();
  }, []);

  const openWorkbench = async (tpl: VideoTemplate) => {
    setSelectedTemplate(tpl);
    setDetailOpen(true);
    setCurrentTime(0);
    setIsPlaying(false);
    setTimeout(() => {
      configForm.setFieldsValue({
        learning_mode: tpl.learning_config?.learning_mode || 'action_and_object',
        sample_rate: tpl.learning_config?.sample_rate || 5,
        min_confidence: tpl.learning_config?.min_confidence || 0.4,
        scene_threshold: tpl.learning_config?.scene_threshold || 30,
        min_action_duration_seconds: tpl.learning_config?.min_action_duration_seconds || 1,
        object_change_sensitivity: tpl.learning_config?.object_change_sensitivity || 'medium',
        focus_classes: tpl.learning_config?.focus_classes ?? defaultFocusClasses,
        object_model_id: tpl.learning_config?.object_model_id,
        action_model_id: tpl.learning_config?.action_model_id,
        object_category_ids: tpl.learning_config?.object_category_ids || [],
      });
    }, 0);
    try {
      const sessRes = await api.get(`/video-learning/templates/${tpl.id}/sessions`);
      setSessions(sessRes.data);
      const fresh = (sessRes.data as LearningSession[])[0];
      if (fresh && fresh.status === 'completed') {
        const actRes = await api.get(`/video-learning/sessions/${fresh.id}/actions`);
        const overlayRes = await api.get(`/video-learning/sessions/${fresh.id}/frame-overlays`, { params: { limit: 100000 } });
        setActions(actRes.data);
        setOverlayFrames(overlayRes.data);
        const sopRes = await api.post(`/video-learning/templates/${tpl.id}/sop-preview`);
        setSopPreview(sopRes.data);
      } else {
        setActions([]);
        setOverlayFrames([]);
        setSopPreview(null);
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
        const sessRes = await api.get(`/video-learning/templates/${templateId}/sessions`);
        setSessions(sessRes.data);
      }
    } catch {
      message.error(t('pages.videoLearning.startLearningFailed'));
    }
  };

  const openActionEdit = (action: ActionSequence) => {
    setEditingAction(action);
    setEditingOpen(true);
    setTimeout(() => {
      editActionForm.setFieldsValue({
        user_defined_name: action.user_defined_name || action.action_name,
        start_time: action.start_time,
        end_time: action.end_time,
        note: action.note || '',
        is_kept: action.is_kept,
      });
    }, 0);
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

  const applySuggestion = async (action: ActionSequence, suggestionType: string) => {
    try {
      const res = await api.post(`/video-learning/actions/${action.id}/apply-suggestion`, {
        suggestion_type: suggestionType,
      });
      setActions((prev) => prev.map((item) => (item.id === action.id ? { ...item, ...res.data } : item)));
      message.success(t('pages.videoLearning.suggestionApplied'));
    } catch {
      message.error(t('pages.videoLearning.suggestionApplyFailed'));
    }
  };

  const latestSession = sessions[0];
  const objectFrequency = latestSession?.analysis_result?.analysis?.object_frequency || {};
  const workflowSummary = latestSession?.analysis_result?.workflow_summary || selectedTemplate?.workflow_summary || {};
  const workflowSuggestions = latestSession?.analysis_result?.workflow_suggestions || [];
  const lowQualityCount = actions.filter((action) => (action.features?.quality_score ?? 0) < 0.7).length;
  const pendingSuggestions = workflowSuggestions.length + actions.reduce((count, action) => {
    return count + ((action.suggestions || action.features?.suggestions || []).length);
  }, 0);
  const videoUrl = resolveAssetUrl(selectedTemplate?.video_path);
  const currentOverlayFrame = useMemo(() => {
    if (!overlayFrames.length) return null;
    return overlayFrames.reduce<FrameOverlay | null>((closest, frame) => {
      if (!closest) return frame;
      return Math.abs(frame.timestamp - currentTime) < Math.abs(closest.timestamp - currentTime) ? frame : closest;
    }, null);
  }, [overlayFrames, currentTime]);

  const getOverlayTransform = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const displayWidth = video.clientWidth || 0;
    const displayHeight = video.clientHeight || 0;
    const [resolutionWidth, resolutionHeight] = (selectedTemplate?.resolution || '0x0').split('x').map(Number);
    const sourceWidth = video.videoWidth || resolutionWidth || displayWidth;
    const sourceHeight = video.videoHeight || resolutionHeight || displayHeight;
    if (!displayWidth || !displayHeight || !sourceWidth || !sourceHeight) return null;
    const scale = Math.min(displayWidth / sourceWidth, displayHeight / sourceHeight);
    const renderWidth = sourceWidth * scale;
    const renderHeight = sourceHeight * scale;
    return {
      sourceWidth,
      sourceHeight,
      displayWidth,
      displayHeight,
      scaleX: renderWidth / sourceWidth,
      scaleY: renderHeight / sourceHeight,
      offsetX: (displayWidth - renderWidth) / 2,
      offsetY: (displayHeight - renderHeight) / 2,
    };
  }, [selectedTemplate?.resolution]);
  const currentAction = useMemo(() => {
    return actions.find((action) => {
      if (action.start_time == null || action.end_time == null) return false;
      return currentTime >= action.start_time && currentTime <= action.end_time;
    }) || null;
  }, [actions, currentTime]);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (!selectedTemplate || !latestSession) return;
    if (latestSession.status !== 'running' && latestSession.status !== 'analyzing') return;
    pollingRef.current = setInterval(async () => {
      try {
        const sessRes = await api.get(`/video-learning/templates/${selectedTemplate.id}/sessions`);
        const updatedSessions = sessRes.data as LearningSession[];
        setSessions(updatedSessions);
        const fresh = updatedSessions[0];
        if (fresh && fresh.status !== 'running' && fresh.status !== 'analyzing') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          fetchTemplates();
          if (fresh.status === 'completed') {
            const actRes = await api.get(`/video-learning/sessions/${fresh.id}/actions`);
            const overlayRes = await api.get(`/video-learning/sessions/${fresh.id}/frame-overlays`, { params: { limit: 100000 } });
            setActions(actRes.data);
            setOverlayFrames(overlayRes.data);
            try {
              const sopRes = await api.post(`/video-learning/templates/${selectedTemplate.id}/sop-preview`);
              setSopPreview(sopRes.data);
            } catch { /* sop preview optional */ }
          }
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [selectedTemplate, latestSession?.status]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;
    const transform = getOverlayTransform();
    const width = transform?.displayWidth || 0;
    const height = transform?.displayHeight || 0;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    if (showBoxes && currentOverlayFrame?.objects?.length) {
      currentOverlayFrame.objects.forEach((obj) => {
        const bbox = Array.isArray(obj.bbox) ? obj.bbox : [];
        if (bbox.length !== 4) return;
        const [x1, y1, x2, y2] = bbox;
        const sourceWidth = transform?.sourceWidth || width;
        const sourceHeight = transform?.sourceHeight || height;
        const rawLeft = x1 <= 1 ? x1 * sourceWidth : x1;
        const rawTop = y1 <= 1 ? y1 * sourceHeight : y1;
        const rawRight = x2 <= 1 ? x2 * sourceWidth : x2;
        const rawBottom = y2 <= 1 ? y2 * sourceHeight : y2;
        const left = (transform?.offsetX || 0) + rawLeft * (transform?.scaleX || 1);
        const top = (transform?.offsetY || 0) + rawTop * (transform?.scaleY || 1);
        const right = (transform?.offsetX || 0) + rawRight * (transform?.scaleX || 1);
        const bottom = (transform?.offsetY || 0) + rawBottom * (transform?.scaleY || 1);
        ctx.strokeStyle = '#00b96b';
        ctx.lineWidth = 2;
        ctx.strokeRect(left, top, Math.max(right - left, 1), Math.max(bottom - top, 1));
        ctx.fillStyle = 'rgba(0, 185, 107, 0.85)';
        ctx.fillRect(left, Math.max(top - 22, 0), 120, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        const confidence = typeof obj.confidence === 'number' ? ` ${(obj.confidence * 100).toFixed(0)}%` : '';
        ctx.fillText(`${obj.class_name || 'object'}${confidence}`, left + 6, Math.max(top - 8, 12));
      });
    }

    if (showPose && currentOverlayFrame?.pose_keypoints?.length) {
      const skeletonPairs = [
        [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
        [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      ];
      currentOverlayFrame.pose_keypoints.forEach((person) => {
        const points = Array.isArray(person.points) ? person.points : [];
        const pointMap = new Map<number, { x: number; y: number; conf?: number }>();
        points.forEach((point) => {
          pointMap.set(point.index, { x: point.x, y: point.y, conf: point.conf });
        });

        ctx.strokeStyle = '#1677ff';
        ctx.lineWidth = 2;
        skeletonPairs.forEach(([start, end]) => {
          const p1 = pointMap.get(start);
          const p2 = pointMap.get(end);
          if (!p1 || !p2) return;
          const mappedX1 = (transform?.offsetX || 0) + p1.x * (transform?.scaleX || 1);
          const mappedY1 = (transform?.offsetY || 0) + p1.y * (transform?.scaleY || 1);
          const mappedX2 = (transform?.offsetX || 0) + p2.x * (transform?.scaleX || 1);
          const mappedY2 = (transform?.offsetY || 0) + p2.y * (transform?.scaleY || 1);
          ctx.beginPath();
          ctx.moveTo(mappedX1, mappedY1);
          ctx.lineTo(mappedX2, mappedY2);
          ctx.stroke();
        });

        points.forEach((point) => {
          const mappedX = (transform?.offsetX || 0) + point.x * (transform?.scaleX || 1);
          const mappedY = (transform?.offsetY || 0) + point.y * (transform?.scaleY || 1);
          ctx.fillStyle = '#1677ff';
          ctx.beginPath();
          ctx.arc(mappedX, mappedY, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }
  }, [currentOverlayFrame, showBoxes, showPose, currentTime, getOverlayTransform]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const seekToAction = (action: ActionSequence) => {
    if (action.start_time == null) return;
    handleSeek(action.start_time);
  };

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
                  <Form.Item name="min_action_duration_seconds" label={t('pages.videoLearning.minActionDurationSeconds')}>
                    <InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="object_change_sensitivity" label={t('pages.videoLearning.objectChangeSensitivity')}>
                    <Select
                      options={[
                        { value: 'low', label: t('pages.videoLearning.sensitivityLow') },
                        { value: 'medium', label: t('pages.videoLearning.sensitivityMedium') },
                        { value: 'high', label: t('pages.videoLearning.sensitivityHigh') },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="focus_classes" label={t('pages.videoLearning.focusClasses')}>
                    <Select mode="tags" tokenSeparators={[',']} placeholder={t('pages.videoLearning.focusClassesPlaceholder')} />
                  </Form.Item>
                  <Form.Item name="object_model_id" label="物体模型">
                    <Select
                      allowClear
                      options={objectModels.map((item) => ({ value: item.id, label: `${item.name} ${item.version}` }))}
                    />
                  </Form.Item>
                  <Form.Item name="action_model_id" label="动作模型">
                    <Select
                      allowClear
                      options={actionModels.map((item) => ({ value: item.id, label: `${item.name} ${item.version}` }))}
                    />
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
                  <Card title="视频回放" size="small" style={{ marginBottom: 16 }}>
                    {videoUrl ? (
                      <>
                        <div style={{ position: 'relative' }}>
                          <video
                            ref={videoRef}
                            src={videoUrl}
                            controls={false}
                            style={{ width: '100%', maxHeight: 360, background: '#000', borderRadius: 6, display: 'block' }}
                            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                          />
                          <canvas
                            ref={overlayCanvasRef}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                          />
                          {currentAction && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 12,
                                left: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                pointerEvents: 'none',
                              }}
                            >
                              <Tag color="processing" style={{ width: 'fit-content', marginInlineEnd: 0 }}>
                                步骤 {currentAction.step_order}: {currentAction.user_defined_name || currentAction.action_name}
                              </Tag>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {(currentAction.objects_in_scene || []).map((obj) => (
                                  <Tag key={`current-${obj}`} color="green" style={{ marginInlineEnd: 0 }}>
                                    {obj}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <Flex vertical style={{ width: '100%', marginTop: 12, gap: 12 }}>
                          <Space wrap>
                            <Button
                              size="small"
                              icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />}
                              onClick={togglePlayback}
                            >
                              {isPlaying ? '暂停' : '播放'}
                            </Button>
                            <span>
                              {currentTime.toFixed(1)}s / {selectedTemplate.duration_seconds?.toFixed(1) ?? '0.0'}s
                            </span>
                            <Tag>{overlayFrames.length} 帧分析</Tag>
                            <Button size="small" type={showBoxes ? 'primary' : 'default'} onClick={() => setShowBoxes((prev) => !prev)}>
                              显示目标框
                            </Button>
                            <Button size="small" type={showPose ? 'primary' : 'default'} onClick={() => setShowPose((prev) => !prev)}>
                              显示骨骼
                            </Button>
                          </Space>
                          {currentAction?.features?.pose_summary && (
                            <Space wrap>
                              <Tag color="blue">pose: {currentAction.features.pose_summary.frames_with_pose ?? 0}</Tag>
                              <Tag>wrist_x: {currentAction.features.pose_summary.wrist_span_x ?? 0}</Tag>
                              <Tag>wrist_y: {currentAction.features.pose_summary.wrist_span_y ?? 0}</Tag>
                            </Space>
                          )}
                          <Slider
                            min={0}
                            max={selectedTemplate.duration_seconds ?? 0}
                            step={0.1}
                            value={currentTime}
                            onChange={handleSeek}
                          />
                        </Flex>
                      </>
                    ) : (
                      <div>{t('common.noData')}</div>
                    )}
                  </Card>

                  <Row gutter={16}>
                    <Col span={6}><Card size="small"><Statistic title={t('pages.videoLearning.detectedObjects')} value={latestSession.objects_detected} prefix={<AimOutlined />} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title={t('pages.videoLearning.identifiedActions')} value={latestSession.actions_identified} prefix={<VideoCameraOutlined />} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title={t('pages.videoLearning.processedFrames')} value={latestSession.processed_frames} prefix={<ClockCircleOutlined />} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title={t('common.status')} value={latestSession.status} /></Card></Col>
                  </Row>

                  {(latestSession.status === 'running' || latestSession.status === 'analyzing') && (
                    <Card size="small" style={{ marginTop: 16 }}>
                      <Progress percent={latestSession.progress ?? 0} status="active" />
                      <div style={{ textAlign: 'center', color: '#888', marginTop: 4 }}>
                        {t('pages.videoLearning.learningInProgress')}
                      </div>
                    </Card>
                  )}

                  {latestSession.status === 'failed' && latestSession.error_message && (
                    <Card size="small" style={{ marginTop: 16, borderColor: '#ffccc7' }}>
                      <div style={{ color: '#cf1322', fontWeight: 500 }}>学习失败</div>
                      <div style={{ marginTop: 8 }}>{latestSession.error_message}</div>
                    </Card>
                  )}

                  <Card title={t('pages.videoLearning.workbench')} size="small" style={{ marginTop: 16 }}>
                    <Card size="small" title={t('pages.videoLearning.workflowOverview')} style={{ marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col span={8}><Statistic title={t('pages.videoLearning.workflowStepCount')} value={workflowSummary.step_count ?? actions.length} /></Col>
                        <Col span={8}><Statistic title={t('pages.videoLearning.lowQualitySteps')} value={lowQualityCount} /></Col>
                        <Col span={8}><Statistic title={t('pages.videoLearning.pendingSuggestions')} value={pendingSuggestions} /></Col>
                      </Row>
                    </Card>

                    <Tabs
                      items={[
                        {
                          key: 'timeline',
                          label: t('pages.videoLearning.timeline'),
                          children: (
                            <Flex vertical gap={8}>
                              {actions.map((action) => (
                                <Card
                                  key={action.id}
                                  size="small"
                                  style={{
                                    backgroundColor: currentAction?.id === action.id ? 'rgba(22, 119, 255, 0.08)' : undefined,
                                    cursor: action.start_time != null ? 'pointer' : 'default',
                                  }}
                                  onClick={() => seekToAction(action)}
                                >
                                  <Flex justify="space-between" align="flex-start" gap={12}>
                                    <Flex vertical gap={4} style={{ flex: 1 }}>
                                      <strong>{`${t('pages.videoLearning.step')} ${action.step_order}: ${action.user_defined_name || action.action_name}`}</strong>
                                      <span>{action.start_time?.toFixed(1)}s - {action.end_time?.toFixed(1)}s ({action.duration?.toFixed(1)}s)</span>
                                      <span>{action.description}</span>
                                      <span>{t('pages.videoLearning.qualityScore')}: {action.features?.quality_score ?? '-'}</span>
                                      {action.features?.suggested_action_name && <span>{t('pages.videoLearning.suggestedActionName')}: {action.features?.suggested_action_name}</span>}
                                      <Space wrap>
                                        {action.objects_in_scene?.map((obj: string) => <Tag key={obj}>{obj}</Tag>)}
                                      </Space>
                                      {(action.features?.boundary_score != null || action.features?.detection_score != null || action.features?.pose_score != null || action.features?.interaction_score != null || action.features?.stability_score != null) && (
                                        <Space wrap size={[4, 4]}>
                                          {action.features?.boundary_score != null && <Tag color="purple">boundary: {typeof action.features?.boundary_score === 'number' ? action.features?.boundary_score.toFixed(2) : action.features?.boundary_score}</Tag>}
                                          {action.features?.detection_score != null && <Tag color="cyan">detection: {typeof action.features?.detection_score === 'number' ? action.features?.detection_score.toFixed(2) : action.features?.detection_score}</Tag>}
                                          {action.features?.pose_score != null && <Tag color="blue">pose: {typeof action.features?.pose_score === 'number' ? action.features?.pose_score.toFixed(2) : action.features?.pose_score}</Tag>}
                                          {action.features?.interaction_score != null && <Tag color="green">interaction: {typeof action.features?.interaction_score === 'number' ? action.features?.interaction_score.toFixed(2) : action.features?.interaction_score}</Tag>}
                                          {action.features?.stability_score != null && <Tag color="orange">stability: {typeof action.features?.stability_score === 'number' ? action.features?.stability_score.toFixed(2) : action.features?.stability_score}</Tag>}
                                        </Space>
                                      )}
                                      {action.features?.boundary_reasons?.length > 0 && (
                                        <Space wrap size={[4, 4]}>
                                          {action.features?.boundary_reasons?.map((reason: string) => (
                                            <Tag key={`reason-${reason}`} color="red">{reason}</Tag>
                                          ))}
                                        </Space>
                                      )}
                                      {action.features?.primary_objects?.length > 0 && (
                                        <span>{t('pages.videoLearning.primaryObjects')}: {(action.features?.primary_objects as string[])?.join(', ')}</span>
                                      )}
                                    </Flex>
                                    <Space>
                                      <Button size="small" icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); openActionEdit(action); }}>
                                        {t('common.edit')}
                                      </Button>
                                      <Button size="small" onClick={(event) => { event.stopPropagation(); splitAction(action); }}>
                                        {t('pages.videoLearning.split')}
                                      </Button>
                                      <Button size="small" onClick={(event) => { event.stopPropagation(); mergeAction(action); }}>
                                        {t('pages.videoLearning.mergePrev')}
                                      </Button>
                                    </Space>
                                  </Flex>
                                </Card>
                              ))}
                            </Flex>
                          ),
                        },
                        {
                          key: 'suggestions',
                          label: t('pages.videoLearning.smartSuggestions'),
                          children: (
                            <Flex vertical style={{ width: '100%', gap: 12 }}>
                              {workflowSuggestions.map((suggestion: Record<string, any>, index: number) => (
                                <Card key={`workflow-${index}`} size="small" title={t('pages.videoLearning.workflowSuggestion')}>
                                  <div>{suggestion.message}</div>
                                </Card>
                              ))}
                              {actions.map((action) => {
                                const suggestions = action.suggestions || action.features?.suggestions || [];
                                return (
                                  <Card key={action.id} size="small" title={`${t('pages.videoLearning.step')} ${action.step_order}: ${action.user_defined_name || action.action_name}`}>
                                    <Flex vertical style={{ width: '100%', gap: 12 }}>
                                      <div>{t('pages.videoLearning.qualityScore')}: {action.features?.quality_score ?? '-'}</div>
                                      {suggestions.map((suggestion: Record<string, any>, index: number) => (
                                        <Card key={`${action.id}-${index}`} size="small" type="inner" title={t('pages.videoLearning.actionSuggestion')}>
                                          <Flex vertical style={{ width: '100%', gap: 8 }}>
                                            <div>{suggestion.message}</div>
                                            <Button size="small" onClick={() => applySuggestion(action, suggestion.type || 'rename')}>
                                              {t('pages.videoLearning.applySuggestion')}
                                            </Button>
                                          </Flex>
                                        </Card>
                                      ))}
                                      {suggestions.length === 0 && <div>{t('pages.videoLearning.noSuggestions')}</div>}
                                    </Flex>
                                  </Card>
                                );
                              })}
                            </Flex>
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
                            <Flex vertical style={{ width: '100%', gap: 12 }}>
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
                            </Flex>
                          ),
                        },
                        {
                          key: 'sop',
                          label: t('pages.videoLearning.sopPreview'),
                          children: sopPreview ? (
                            <Flex vertical style={{ width: '100%', gap: 12 }}>
                              <Card size="small" title={sopPreview.title || t('pages.videoLearning.sopPreview')}>
                                <Descriptions size="small" column={1}>
                                  <Descriptions.Item label={t('pages.videoLearning.businessType')}>{sopPreview.business_type}</Descriptions.Item>
                                  <Descriptions.Item label={t('pages.videoLearning.stationId')}>{sopPreview.station_id || '-'}</Descriptions.Item>
                                  <Descriptions.Item label={t('pages.videoLearning.workflowStepCount')}>{sopPreview.workflow_summary?.step_count ?? sopPreview.steps?.length ?? 0}</Descriptions.Item>
                                </Descriptions>
                              </Card>
                              {(sopPreview.steps || []).map((step: Record<string, any>) => (
                                <Card key={step.step_order} size="small" title={`${t('pages.videoLearning.step')} ${step.step_order}: ${step.name}`}>
                                  <Flex vertical style={{ width: '100%', gap: 8 }}>
                                    <div>{step.description || '-'}</div>
                                    <Space wrap>
                                      {(step.objects || []).map((obj: string) => <Tag key={`${step.step_order}-${obj}`}>{obj}</Tag>)}
                                    </Space>
                                    {step.keyframe_path && <div>{step.keyframe_path}</div>}
                                  </Flex>
                                </Card>
                              ))}
                            </Flex>
                          ) : (
                            <div>{t('pages.videoLearning.noSopPreview')}</div>
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
          <Form.Item name="start_time" label={t('pages.videoLearning.actionStartTime')}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_time" label={t('pages.videoLearning.actionEndTime')}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
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
