// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import '../../test/setup';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  defaults: { baseURL: 'http://localhost:8000/api' },
}));

vi.mock('../../utils/api', () => ({
  default: mockApi,
}));

import VideoTraining from '../../pages/VideoTraining';

function renderVideoTraining() {
  return render(
    <MemoryRouter>
      <VideoTraining />
    </MemoryRouter>
  );
}

describe('VideoTraining 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/video-training/object-categories') {
        return Promise.resolve({
          data: [{ id: 1, name: 'book', display_name: '书本', description: '书本类别', color: '#1677ff', icon: null, is_builtin: false, is_active: true, created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-training/action-categories') {
        return Promise.resolve({
          data: [{ id: 2, name: 'read_book', display_name: '阅读书本', description: '阅读动作', is_active: true, created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-training/object-annotation-sets') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/video-training/action-sample-sets') {
        return Promise.resolve({ data: [{ id: 3, name: '会话样本集', description: '从会话导入', source_type: 'video_pose_extract', status: 'draft', created_by: 1, created_at: '2026-04-02T00:00:00Z' }] });
      }
      if (url === '/video-training/training-jobs') {
        return Promise.resolve({
          data: [{ id: 10, name: '书本检测训练', job_type: 'object_detection', dataset_type: 'object_annotation_set', dataset_id: 3, model_id: 91, status: 'completed', progress: 100, config_json: {}, metrics_json: { dataset_export: { annotation_count: 1 } }, log_path: null, error_message: null, started_at: '2026-04-02T00:00:00Z', completed_at: '2026-04-02T00:05:00Z', created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-learning/templates') {
        return Promise.resolve({
          data: [{ id: 7, name: '学习模板A', description: '已完成会话', business_type: 'assembly', video_path: '/uploads/a.mp4', duration_seconds: 10, fps: 10, frame_count: 100, resolution: '1280x720', station_id: null, learning_config: {}, sop_content: null, workflow_summary: null, status: 'completed', created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-learning/templates/7/sessions') {
        return Promise.resolve({
          data: [{ id: 101, template_id: 7, status: 'completed', progress: 100, total_frames: 100, processed_frames: 100, objects_detected: 4, actions_identified: 1, learning_mode: 'action_and_object', focus_classes: [], sample_rate: 5, min_confidence: 0.4, scene_threshold: 30, object_model_id: null, action_model_id: null, error_message: null, analysis_result: {}, started_at: '2026-04-02T00:00:00Z', completed_at: '2026-04-02T00:01:00Z', created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-learning/sessions/101/actions') {
        return Promise.resolve({
          data: [{ id: 500, step_order: 1, action_name: 'read_book', description: '阅读书本', start_frame: 10, end_frame: 20, start_time: 1.0, end_time: 2.0, duration: 1.0, confidence: 0.9, keyframe_path: null, objects_in_scene: ['book'], suggestions: [], features: { skeleton_summary: { format: 'coco17', frames: [{ frame_number: 10, timestamp: 1.0, keypoints: [] }] } }, user_defined_name: null, note: null, is_kept: true, created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    mockApi.post.mockResolvedValue({ data: { id: 99 } });
  });

  it('加载类别和训练任务', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/object-categories');
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/training-jobs');
    });

    expect(await screen.findByText('书本')).toBeInTheDocument();
    await user.click((await screen.findAllByRole('tab', { name: '训练任务' })).at(0)!);
    expect(screen.getByText('书本检测训练')).toBeInTheDocument();
  });

  it('可以创建物体类别', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    await user.click((await screen.findAllByRole('button', { name: '新建物体类别' })).at(-1)!);
    await user.type(screen.getByLabelText('类别编码'), 'tv');
    await user.type(screen.getByLabelText('显示名称'), '电视');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/video-training/object-categories', expect.objectContaining({ name: 'tv', display_name: '电视' }));
    });
  });

  it('可以创建动作样本集', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    await user.click((await screen.findAllByRole('tab', { name: '动作样本' }))[0]);
    const panel = await screen.findByRole('tabpanel', { name: '动作样本' });
    await user.click(within(panel).getByRole('button', { name: '新建动作样本集' }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1)!;
    await user.type(within(dialog).getAllByRole('textbox')[0], '阅读样本集');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/video-training/action-sample-sets', expect.objectContaining({ name: '阅读样本集' }));
    });
  });

  it('展示会话导入区和训练任务激活按钮', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    await user.click((await screen.findAllByRole('tab', { name: '动作样本' }))[0]);
    expect(await screen.findByText('从学习会话导入')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入会话动作' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '载入默认会话' })).toBeInTheDocument();

    await user.click((await screen.findAllByRole('tab', { name: '训练任务' })).at(0)!);
    expect(screen.getByRole('button', { name: '激活模型' })).toBeInTheDocument();
  });
});
