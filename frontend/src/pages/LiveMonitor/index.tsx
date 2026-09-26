import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Select,
  Space,
  Tag,
  Badge,
  Slider,
  Tooltip,
  Empty,
  notification,
  Statistic,
  Switch,
} from 'antd';
import {
  CameraOutlined,
  ReloadOutlined,
  PictureOutlined,
  EyeOutlined,
  ExpandOutlined,
  CompressOutlined,
  BellOutlined,
  VideoCameraOutlined,
  ThunderboltOutlined,
  ScanOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { DetectionOverlay } from '../../components/DetectionOverlay';

const getApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined') return `${window.location.origin}/api`;
  return '/api';
};
const getWsBase = () => {
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:3000';
};
const API_BASE = getApiBase();
const WS_BASE = getWsBase();

interface LocalCamera {
  index: number;
  device_id: string;
  name: string;
  resolution: string;
  fps: number;
}

interface Detection {
  class_name: string;
  confidence: number;
  bbox: number[];
  keypoints?: { name: string; x: number; y: number; conf: number }[];
}

interface WsDetectionMsg {
  type: string;
  detections: Detection[];
  inference_ms: number;
  fps: number;
  frame_count: number;
  timestamp: number;
}

interface CameraFeed {
  id: string;
  source: string;
  name: string;
  active: boolean;
  mode: 'pose' | 'detect';
  confidence: number;
  iou: number;
  fps: number;
  isLocal: boolean;
  streamRef?: MediaStream | null;
}

const LiveMonitor: React.FC = () => {
  const [localCameras, setLocalCameras] = useState<LocalCamera[]>([]);
  const [dbCameras, setDbCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feeds, setFeeds] = useState<CameraFeed[]>([]);
  const [expandedFeed, setExpandedFeed] = useState<string | null>(null);
  const [wsStats, setWsStats] = useState<Record<string, WsDetectionMsg>>({});
  const [enableNotify, setEnableNotify] = useState(true);
  const [gridCols, setGridCols] = useState(2);
  const wsRefs = useRef<Record<string, WebSocket>>({});
  const notifyRef = useRef(enableNotify);
  const { t } = useTranslation();

  useEffect(() => { notifyRef.current = enableNotify; }, [enableNotify]);

  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const [localRes, dbRes] = await Promise.all([
        api.get('/live/local-cameras', { timeout: 30000 }).catch(() => ({ data: { cameras: [] } })),
        api.get('/cameras', { timeout: 15000 }).catch(() => ({ data: [] })),
      ]);
      setLocalCameras(localRes.data.cameras || []);
      const dbList = Array.isArray(dbRes.data) ? dbRes.data : (dbRes.data.items || []);
      setDbCameras(dbList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCameras(); }, [loadCameras]);

  useEffect(() => {
    return () => {
      Object.values(wsRefs.current).forEach(ws => ws.close());
      feeds.forEach(f => {
        if (f.streamRef) {
          f.streamRef.getTracks().forEach(track => track.stop());
        }
      });
    };
  }, []);

  const requestLocalCameraPermission = async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        notification.warning({
          message: t('pages.liveMonitor.permissionDenied'),
          description: t('pages.liveMonitor.permissionDeniedDesc'),
          duration: 5,
        });
      } else if (err.name === 'NotFoundError') {
        notification.error({
          message: t('pages.liveMonitor.cameraNotFound'),
          description: t('pages.liveMonitor.cameraNotFoundDesc'),
        });
      } else {
        notification.error({
          message: t('pages.liveMonitor.cameraOpenFailed'),
          description: err.message,
        });
      }
      return null;
    }
  };

  const addFeed = async (source: string, name: string, isLocal: boolean = false) => {
    if (feeds.find(f => f.source === source)) return;

    let stream: MediaStream | null = null;
    if (isLocal) {
      stream = await requestLocalCameraPermission();
      if (!stream) return;
    }

    const feed: CameraFeed = {
      id: `feed_${Date.now()}`,
      source,
      name,
      active: true,
      mode: 'detect',
      confidence: 0.5,
      iou: 0.7,
      fps: 8,
      isLocal,
      streamRef: stream,
    };
    setFeeds(prev => [...prev, feed]);

    if (!isLocal) {
      connectWs(feed);
    }
  };

  const connectWs = (feed: CameraFeed) => {
    const token = localStorage.getItem('access_token');
    const wsUrl = `${WS_BASE}/api/live/ws/${encodeURIComponent(feed.source)}${token ? `?token=${token}` : ''}`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'config', mode: feed.mode, confidence: feed.confidence, iou: feed.iou, fps: 3 }));
    };
    ws.onmessage = (evt) => {
      try {
        const msg: WsDetectionMsg = JSON.parse(evt.data);
        if (msg.type === 'frame_detection') {
          setWsStats(prev => ({ ...prev, [feed.id]: msg }));
          if (notifyRef.current && msg.detections.length > 0) {
            const critical = msg.detections.filter(d => d.confidence > 0.8);
            if (critical.length > 0 && msg.frame_count % 50 === 1) {
              notification.info({
                message: `${t('pages.liveMonitor.detectionEvent')} - ${feed.name}`,
                description: critical.map(d => `${d.class_name} (${(d.confidence * 100).toFixed(0)}%)`).join(', '),
                duration: 4,
                placement: 'topRight',
              });
            }
          }
        }
      } catch { /* ignore parse errors */ }
    };
    ws.onclose = () => {
      delete wsRefs.current[feed.id];
    };
    wsRefs.current[feed.id] = ws;
  };

  const removeFeed = (feedId: string) => {
    const feed = feeds.find(f => f.id === feedId);
    if (feed?.streamRef) {
      feed.streamRef.getTracks().forEach(track => track.stop());
    }
    const ws = wsRefs.current[feedId];
    if (ws) { ws.close(); delete wsRefs.current[feedId]; }
    setFeeds(prev => prev.filter(f => f.id !== feedId));
    setWsStats(prev => { const n = { ...prev }; delete n[feedId]; return n; });
    if (expandedFeed === feedId) setExpandedFeed(null);
  };

  const takeSnapshot = async (feed: CameraFeed) => {
    if (feed.isLocal && feed.streamRef) {
      const video = document.getElementById(`video_${feed.id}`) as HTMLVideoElement;
      if (!video) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append('snapshot', blob, `${feed.name}_${Date.now()}.jpg`);
        try {
          await api.post('/live/upload-snapshot', formData);
          notification.success({
            message: t('pages.liveMonitor.snapshotSaved'),
            duration: 3,
          });
        } catch {
          notification.error({ message: t('pages.liveMonitor.snapshotFailed') });
        }
      }, 'image/jpeg', 0.9);
      return;
    }
    try {
      const res = await api.get(`/live/snapshot/${feed.source}`, {
        params: { mode: feed.mode, conf: feed.confidence, iou: feed.iou },
      });
      if (res.data.snapshot_url) {
        notification.success({
          message: t('pages.liveMonitor.snapshotSaved'),
          description: `${t('pages.liveMonitor.detectedTargets', { count: res.data.detections?.length || 0 })}, ${t('pages.liveMonitor.inferenceTime', { ms: res.data.inference_ms })}`,
          duration: 5,
        });
      }
    } catch {
      notification.error({ message: t('pages.liveMonitor.snapshotFailed') });
    }
  };

  const updateFeed = (feedId: string, updates: Partial<CameraFeed>) => {
    setFeeds(prev => prev.map(f => {
      if (f.id !== feedId) return f;
      const updated = { ...f, ...updates };
      if (!f.isLocal) {
        const ws = wsRefs.current[feedId];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'config', mode: updated.mode, confidence: updated.confidence, iou: updated.iou, fps: 3 }));
        }
      }
      return updated;
    }));
  };

  const renderFeedCard = (feed: CameraFeed, isExpanded: boolean) => {
    const stats = wsStats[feed.id];

    return (
      <Card
        key={feed.id}
        size="small"
        title={
          <Space>
            <Badge status={feed.active ? "processing" : "default"} />
            <span>{feed.name}</span>
            {feed.isLocal && <Tag color="cyan">{t('pages.liveMonitor.localCamera')}</Tag>}
            {stats && <Tag color="blue">{stats.fps} FPS</Tag>}
            {stats && <Tag color="green">{stats.inference_ms}ms</Tag>}
          </Space>
        }
        extra={
          <Space size="small">
            <Tooltip title={feed.mode === 'pose' ? t('pages.liveMonitor.poseDetection') : t('pages.liveMonitor.objectDetection')}>
              <Select
                size="small" value={feed.mode} style={{ width: 90 }}
                onChange={v => updateFeed(feed.id, { mode: v })}
                options={[
                  { value: 'pose', label: t('pages.liveMonitor.poseDetection') },
                  { value: 'detect', label: t('pages.liveMonitor.objectDetection') },
                ]}
              />
            </Tooltip>
            <Tooltip title={t('pages.liveMonitor.snapshot')}>
              <Button size="small" icon={<PictureOutlined />} onClick={() => takeSnapshot(feed)} />
            </Tooltip>
            <Tooltip title={isExpanded ? t('pages.liveMonitor.collapse') : t('pages.liveMonitor.expand')}>
              <Button
                size="small"
                icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={() => setExpandedFeed(isExpanded ? null : feed.id)}
              />
            </Tooltip>
            <Button size="small" danger onClick={() => removeFeed(feed.id)}>{t('pages.liveMonitor.close')}</Button>
          </Space>
        }
        styles={{ body: { padding: 0, position: 'relative', background: '#000' } }}
      >
        <div style={{ position: 'relative', width: '100%', aspectRatio: isExpanded ? '16/9' : '4/3' }}>
          {feed.isLocal ? (
            <video
              id={`video_${feed.id}`}
              autoPlay
              playsInline
              muted
              ref={(el) => {
                if (el && feed.streamRef && el.srcObject !== feed.streamRef) {
                  el.srcObject = feed.streamRef;
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <img
              src={`${API_BASE}/live/stream/${feed.source}?mode=${feed.mode}&conf=${feed.confidence}&iou=${feed.iou}&fps=${feed.fps}`}
              alt={feed.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          {stats && stats.detections && stats.detections.length > 0 && (
            <DetectionOverlay detections={stats.detections} width={640} height={480} />
          )}
          {stats && stats.detections.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.6)', padding: '4px 8px', color: '#fff', fontSize: 12,
            }}>
              {stats.detections.slice(0, 5).map((d, i) => (
                <Tag key={i} color={d.confidence > 0.7 ? 'green' : 'orange'} style={{ margin: '2px' }}>
                  {d.class_name} {(d.confidence * 100).toFixed(0)}%
                  {d.keypoints && d.keypoints.length > 0 && ` (${d.keypoints.length}${t('pages.liveMonitor.points')})`}
                </Tag>
              ))}
              {stats.detections.length > 5 && <Tag>+{stats.detections.length - 5}</Tag>}
            </div>
          )}
        </div>
        <div style={{ padding: '4px 12px', background: '#fafafa' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12 }}>{t('pages.liveMonitor.confidence')}: {(feed.confidence * 100).toFixed(0)}%</span>
            <Slider
              min={10} max={95} value={feed.confidence * 100}
              onChange={v => updateFeed(feed.id, { confidence: v / 100 })}
              style={{ flex: 1, margin: '0 8px', minWidth: 80 }}
            />
            <span style={{ fontSize: 12 }}>IoU: {(feed.iou * 100).toFixed(0)}%</span>
            <Slider
              min={10} max={90} value={feed.iou * 100}
              onChange={v => updateFeed(feed.id, { iou: v / 100 })}
              style={{ flex: 1, margin: '0 8px', minWidth: 80 }}
            />
            <span style={{ fontSize: 12 }}>{t('pages.liveMonitor.fps')}: </span>
            <Select
              size="small" value={feed.fps} style={{ width: 60 }}
              onChange={v => updateFeed(feed.id, { fps: v })}
              options={[4, 8, 12, 15].map(n => ({ value: n, label: `${n}` }))}
            />
          </Space>
        </div>
      </Card>
    );
  };

  const colSpan = expandedFeed ? 24 : (24 / gridCols);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space wrap>
              <span style={{ fontWeight: 600 }}>{t('pages.liveMonitor.addCamera')}:</span>
              {localCameras.map(cam => (
                <Button
                  key={cam.device_id}
                  type="primary"
                  icon={<CameraOutlined />}
                  onClick={() => addFeed(cam.device_id, cam.name, true)}
                  disabled={feeds.some(f => f.source === cam.device_id)}
                >
                  {cam.name} ({cam.resolution})
                </Button>
              ))}
              {dbCameras.map((cam: any) => (
                <Button
                  key={cam.camera_id}
                  icon={<VideoCameraOutlined />}
                  onClick={() => addFeed(cam.stream_url || cam.camera_id, cam.name, false)}
                  disabled={feeds.some(f => f.source === (cam.stream_url || cam.camera_id))}
                >
                  {cam.name}
                </Button>
              ))}
              {localCameras.length === 0 && dbCameras.length === 0 && !loading && (
                <span style={{ color: '#999' }}>{t('pages.liveMonitor.noCameraFound')}</span>
              )}
              <Button icon={<ReloadOutlined />} onClick={loadCameras} loading={loading}>
                {t('common.refresh')}
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                style={{ background: '#f6ffed', borderColor: '#b7eb8f', color: '#52c41a' }}
                icon={<ThunderboltOutlined />}
                onClick={() => window.location.href = '/model-optimizer'}
              >
                ⚡ 推理加速：INT8 Turbo (18ms)
              </Button>
              <Button
                style={{ background: '#e6f7ff', borderColor: '#91d5ff', color: '#1890ff' }}
                icon={<ScanOutlined />}
                onClick={() => window.location.href = '/image-lab'}
              >
                🔬 SAHI切片
              </Button>
              <Button
                style={{ background: '#f9f0ff', borderColor: '#d3adf7', color: '#722ed1' }}
                icon={<SafetyCertificateOutlined />}
                onClick={() => window.location.href = '/supervision-lab'}
              >
                🛡️ Supervision业务流
              </Button>
              <Button
                style={{ background: '#fff7e6', borderColor: '#ffd591', color: '#fa8c16' }}
                icon={<ExperimentOutlined />}
                onClick={() => window.location.href = '/solder-lab'}
              >
                🛠️ SMT焊接质检
              </Button>
              <Button
                style={{ background: '#e6f7ff', borderColor: '#91d5ff', color: '#096dd9' }}
                icon={<SafetyCertificateOutlined />}
                onClick={() => window.location.href = '/wave-solder-lab'}
              >
                🌊 波峰焊评价
              </Button>
              <Tooltip title={t('pages.liveMonitor.detectionNotify')}>
                <Switch
                  checkedChildren={<BellOutlined />}
                  unCheckedChildren={<BellOutlined />}
                  checked={enableNotify}
                  onChange={setEnableNotify}
                />
              </Tooltip>
              <Select
                value={gridCols}
                onChange={setGridCols}
                style={{ width: 100 }}
                options={[
                  { value: 1, label: t('pages.liveMonitor.col1') },
                  { value: 2, label: t('pages.liveMonitor.col2') },
                  { value: 3, label: t('pages.liveMonitor.col3') },
                  { value: 4, label: t('pages.liveMonitor.col4') },
                ]}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {feeds.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title={t('pages.liveMonitor.activeCameras')} value={feeds.length} prefix={<CameraOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('pages.liveMonitor.totalDetected')}
                value={Object.values(wsStats).reduce((sum, s) => sum + (s?.detections?.length || 0), 0)}
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('pages.liveMonitor.avgInferenceTime')}
                value={(() => {
                  const vals = Object.values(wsStats).filter(s => s?.inference_ms);
                  return vals.length ? (vals.reduce((s, v) => s + v.inference_ms, 0) / vals.length).toFixed(0) : 0;
                })()}
                suffix="ms"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('pages.liveMonitor.avgFps')}
                value={(() => {
                  const vals = Object.values(wsStats).filter(s => s?.fps);
                  return vals.length ? (vals.reduce((s, v) => s + v.fps, 0) / vals.length).toFixed(1) : 0;
                })()}
                suffix="FPS"
              />
            </Card>
          </Col>
        </Row>
      )}

      {feeds.length === 0 ? (
        <Card>
          <Empty
            description={t('pages.liveMonitor.emptyHint')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <p style={{ color: '#999' }}>
              {t('pages.liveMonitor.emptyDesc')}
            </p>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          {expandedFeed ? (
            <Col span={24}>
              {feeds.filter(f => f.id === expandedFeed).map(f => renderFeedCard(f, true))}
            </Col>
          ) : (
            feeds.map(feed => (
              <Col key={feed.id} span={colSpan}>
                {renderFeedCard(feed, false)}
              </Col>
            ))
          )}
        </Row>
      )}
    </div>
  );
};

export default LiveMonitor;
