import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Table, Button, Space, Tag, Upload, message, Progress, Row, Col,
  Statistic, Modal, Descriptions, Popconfirm, Empty,
} from 'antd';
import {
  UploadOutlined, CloseCircleOutlined, DeleteOutlined,
  VideoCameraOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../../utils/api';

interface TaskItem {
  id: string;
  filename: string;
  status: string;
  progress: number;
  current_step: string;
  total_frames: number;
  processed_frames: number;
  detections_count: number;
  result_summary: any;
  error_message: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '排队中' },
  running: { color: 'processing', text: '分析中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
  cancelled: { color: 'warning', text: '已取消' },
};

const BatchAnalysis: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/batch');
      setTasks(data.tasks);
      setQueueSize(data.queue_size);
      setRunningCount(data.running_count);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setLoading(true);
    fetchTasks().finally(() => setLoading(false));
    // Auto-refresh when tasks are in progress
    timerRef.current = setInterval(fetchTasks, 2000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/batch/upload', formData);
      message.success(`${file.name} 已加入分析队列`);
      fetchTasks();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '上传失败');
    }
    return false;
  };

  const handleCancel = async (id: string) => {
    try { await api.post(`/batch/${id}/cancel`); message.success('已取消'); fetchTasks(); }
    catch { message.error('取消失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/batch/${id}`); message.success('已删除'); fetchTasks(); }
    catch { message.error('删除失败'); }
  };

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const totalDetections = tasks.reduce((s, t) => s + t.detections_count, 0);

  const columns: ColumnsType<TaskItem> = [
    { title: '文件名', dataIndex: 'filename', width: 200, ellipsis: true, render: v => (
      <Space><VideoCameraOutlined />{v}</Space>
    )},
    { title: '状态', dataIndex: 'status', width: 100, render: v => {
      const s = statusMap[v] || { color: 'default', text: v };
      return <Tag color={s.color}>{s.text}</Tag>;
    }},
    { title: '进度', width: 200, render: (_, r) => (
      <div>
        <Progress
          percent={r.progress}
          size="small"
          status={r.status === 'failed' ? 'exception' : r.status === 'completed' ? 'success' : 'active'}
        />
        <div style={{ fontSize: 12, color: '#999' }}>{r.current_step}</div>
      </div>
    )},
    { title: '帧数', width: 120, render: (_, r) => r.total_frames > 0 ? `${r.processed_frames}/${r.total_frames}` : '-' },
    { title: '检测数', dataIndex: 'detections_count', width: 80 },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: v => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '耗时', width: 100, render: (_, r) => {
      if (!r.started_at) return '-';
      const end = r.completed_at ? new Date(r.completed_at) : new Date();
      const sec = Math.round((end.getTime() - new Date(r.started_at).getTime()) / 1000);
      return sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`;
    }},
    { title: '操作', fixed: 'right', width: 180, render: (_, r) => (
      <Space size="small">
        {r.status === 'completed' && (
          <Button size="small" onClick={() => { setSelectedTask(r); setDetailOpen(true); }}>详情</Button>
        )}
        {r.status === 'pending' && (
          <Button size="small" onClick={() => handleCancel(r.id)} icon={<CloseCircleOutlined />}>取消</Button>
        )}
        {['completed', 'failed', 'cancelled'].includes(r.status) && (
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
        {r.status === 'failed' && r.error_message && (
          <Button size="small" danger onClick={() => { setSelectedTask(r); setDetailOpen(true); }}>查看错误</Button>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总任务数" value={tasks.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="正在分析" value={runningCount} styles={{ content: { color: '#1890ff' } }} suffix={queueSize > 0 ? `(+${queueSize}排队)` : ''} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已完成" value={completedTasks.length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总检测数" value={totalDetections} /></Card></Col>
      </Row>

      <Card
        title="批量视频分析"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchTasks}>刷新</Button>
            <Upload
              beforeUpload={handleUpload}
              showUploadList={false}
              accept=".mp4,.avi,.mov,.mkv,.flv,.wmv"
              multiple
            >
              <Button type="primary" icon={<UploadOutlined />}>上传视频</Button>
            </Upload>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无分析任务，请上传视频文件" /> }}
        />
      </Card>

      {/* 详情 Modal */}
      <Modal
        title={selectedTask?.status === 'failed' ? '错误信息' : `分析结果 - ${selectedTask?.filename}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={700}
      >
        {selectedTask?.status === 'failed' ? (
          <div style={{ color: '#ff4d4f', padding: 16 }}>{selectedTask.error_message}</div>
        ) : selectedTask?.result_summary ? (
          <div>
            <Card size="small" title="视频信息" style={{ marginBottom: 12 }}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="分辨率">{selectedTask.result_summary.video_info?.resolution}</Descriptions.Item>
                <Descriptions.Item label="帧率">{selectedTask.result_summary.video_info?.fps} fps</Descriptions.Item>
                <Descriptions.Item label="时长">{selectedTask.result_summary.video_info?.duration_seconds}秒</Descriptions.Item>
                <Descriptions.Item label="总帧数">{selectedTask.result_summary.video_info?.total_frames}</Descriptions.Item>
                <Descriptions.Item label="采样帧">{selectedTask.result_summary.video_info?.sampled_frames}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="检测结果" style={{ marginBottom: 12 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="总检测数">{selectedTask.result_summary.detection_summary?.total_detections}</Descriptions.Item>
              </Descriptions>
              {selectedTask.result_summary.detection_summary?.class_counts && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {Object.entries(selectedTask.result_summary.detection_summary.class_counts).map(([k, v]) => (
                    <Tag key={k} color="blue">{k}: {v as number}</Tag>
                  ))}
                </div>
              )}
            </Card>

            <Card size="small" title="场景分析">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="场景变化数">{selectedTask.result_summary.scene_analysis?.scene_changes}</Descriptions.Item>
                <Descriptions.Item label="平均变化分">{selectedTask.result_summary.scene_analysis?.avg_change_score}</Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        ) : (
          <Empty description="暂无结果数据" />
        )}
      </Modal>
    </div>
  );
};

export default BatchAnalysis;
