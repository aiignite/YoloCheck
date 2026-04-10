// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock-download'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      writable: true,
      value: vi.fn(),
    });
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
        return Promise.resolve({
          data: [{ id: 5, name: '书本标注集', description: '从视频导入', source_type: 'video_frame', status: 'draft', created_by: 1, created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-training/action-sample-sets') {
        return Promise.resolve({
          data: [{ id: 3, name: '会话样本集', description: '从会话导入', source_type: 'video_pose_extract', status: 'draft', created_by: 1, created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-training/training-jobs') {
        return Promise.resolve({
          data: [{ id: 10, name: '书本检测训练', job_type: 'object_detection', dataset_type: 'object_annotation_set', dataset_id: 5, model_id: 91, status: 'completed', progress: 100, config_json: {}, metrics_json: { dataset_export: { annotation_count: 1 } }, log_path: 'training_logs/object_job_10.log', error_message: null, started_at: '2026-04-02T00:00:00Z', completed_at: '2026-04-02T00:05:00Z', created_at: '2026-04-02T00:00:00Z' }],
        });
      }
      if (url === '/video-training/training-jobs/10') {
        return Promise.resolve({
          data: {
            job: { id: 10, name: '书本检测训练', job_type: 'object_detection', dataset_type: 'object_annotation_set', dataset_id: 5, model_id: 91, status: 'completed', progress: 100, config_json: { epochs: 3, image_size: 640 }, metrics_json: { accuracy: 0.91, training_summary: { artifact_path: 'training_runs/object_job_10/weights/best.pt' } }, log_path: 'training_logs/object_job_10.log', error_message: null, started_at: '2026-04-02T00:00:00Z', completed_at: '2026-04-02T00:05:00Z', created_at: '2026-04-02T00:00:00Z' },
            model: { id: 91, name: '书本检测训练', model_type: 'custom_object', status: 'ready', is_active: false },
            runtime_summary: { epochs: 3, image_size: 640, class_count: 2, accuracy: 0.91, precision: 0.87, recall: 0.85, map50: 0.9, map50_95: 0.74, inference_speed: 12.4 },
            dataset_summary: { dataset_export: { annotation_count: 12, class_names: ['book', 'hand'] }, sample_summary: {}, prototype_summary: {}, class_metrics: {} },
            artifact_summary: { file_name: 'best.pt', file_path: 'training_runs/object_job_10/weights/best.pt', relative_path: 'training_runs/object_job_10/weights/best.pt', file_size: 128, exists: true, download_url: '/api/video-training/training-jobs/10/artifact' },
            log_summary: { file_path: 'training_logs/object_job_10.log', relative_path: 'training_logs/object_job_10.log', exists: true, line_count: 3, tail_lines: ['line1', 'line2', 'line3'], view_url: '/api/video-training/training-jobs/10/log' },
            status_timeline: [
              { status: 'created', label: '任务创建', timestamp: '2026-04-02T00:00:00Z' },
              { status: 'running', label: '开始训练', timestamp: '2026-04-02T00:00:10Z' },
              { status: 'completed', label: '任务完成', timestamp: '2026-04-02T00:05:00Z' },
            ],
          },
        });
      }
      if (url === '/video-training/training-jobs/10/log') {
        return Promise.resolve({ data: 'full log content\nline2' });
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
      return Promise.resolve({ data: [] });
    });
    mockApi.post.mockResolvedValue({ data: { id: 99 } });
  });

  it('加载类别、标注集和训练任务', async () => {
    renderVideoTraining();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/object-categories');
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/object-annotation-sets');
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/training-jobs');
    });

    expect(await screen.findByText('书本')).toBeInTheDocument();
    expect(screen.getByText('书本标注集')).toBeInTheDocument();
  });

  it('可以创建物体类别', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const buttons = await screen.findAllByRole('button', { name: '新建物体类别' });
    await user.click(buttons[buttons.length - 1]);
    await user.type(screen.getByLabelText('类别编码'), 'tv');
    await user.type(screen.getByLabelText('显示名称'), '电视');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/video-training/object-categories', expect.objectContaining({ name: 'tv', display_name: '电视' }));
    });
  });

  it('可以创建标注集', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const buttons = await screen.findAllByRole('button', { name: '新建标注集' });
    await user.click(buttons[buttons.length - 1]);
    const dialog = (await screen.findAllByRole('dialog')).at(-1)!;
    const textboxes = within(dialog).getAllByRole('textbox');
    await user.type(textboxes[0], '口罩标注集');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/video-training/object-annotation-sets', expect.objectContaining({ name: '口罩标注集', source_type: 'video_frame' }));
    });
  });

  it('标注集列表有开始训练按钮', async () => {
    renderVideoTraining();
    const buttons = await screen.findAllByText('开始训练');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('点击开始训练打开训练配置 Modal', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const buttons = await screen.findAllByText('开始训练');
    await user.click(buttons[0]);
    expect(await screen.findByText(/创建训练任务/)).toBeInTheDocument();
    expect(screen.getByLabelText('训练轮数 (epochs)')).toBeInTheDocument();
    expect(screen.getByLabelText('图片尺寸')).toBeInTheDocument();
  });

  it('可以提交训练任务', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const buttons = await screen.findAllByText('开始训练');
    await user.click(buttons[0]);
    await screen.findByText(/创建训练任务/);

    const dialog = (await screen.findAllByRole('dialog')).at(-1)!;
    const inputs = within(dialog).getAllByRole('textbox');
    await user.click(inputs[0]);
    await user.type(inputs[0], '口罩检测训练');

    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/video-training/training-jobs/object-detection', expect.objectContaining({
        name: '口罩检测训练',
        epochs: 10,
        image_size: 640,
      }));
    });
  });

  it('物体检测训练 tab 有从学习会话导入卡片', async () => {
    renderVideoTraining();
    const buttons = await screen.findAllByText('导入物体标注');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('训练任务 tab 状态用 Tag 颜色区分', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    expect(await screen.findByText('completed')).toBeInTheDocument();
  });

  it('可以打开训练任务详情抽屉查看日志和产物摘要', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '查看详情' }))[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/training-jobs/10');
    }, { timeout: 10000 });

    expect(await screen.findByText('训练任务详情')).toBeInTheDocument();
    expect(screen.getByText('best.pt')).toBeInTheDocument();
    expect(screen.getByText('book, hand')).toBeInTheDocument();
  }, 15000);

  it('可以查看训练任务完整日志', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '查看详情' }))[0]);
    await screen.findByText('best.pt', undefined, { timeout: 10000 });
    const detailDrawer = await screen.findByText('训练任务详情');
    expect(detailDrawer).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '查看完整日志' }));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/training-jobs/10/log');
    }, { timeout: 10000 });
    expect(await screen.findByText((content) => content.includes('full log content'))).toBeInTheDocument();
  }, 20000);

  it('可以从训练任务详情触发产物下载', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    const detailButtons = await screen.findAllByRole('button', { name: '查看详情' });
    await user.click(detailButtons[0]);
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/training-jobs/10');
    }, { timeout: 15000 });
    await waitFor(() => {
      expect(screen.getByText('best.pt')).toBeInTheDocument();
    }, { timeout: 15000 });
    mockApi.get.mockClear();
    const downloadButtons = await screen.findAllByRole('button', { name: '下载产物' });
    fireEvent.click(downloadButtons[0]);
    await Promise.resolve();

    expect(mockApi.get).toHaveBeenCalledWith('/video-training/training-jobs/10/artifact', expect.objectContaining({ responseType: 'blob' }));
  }, 30000);

  it('可以创建动作样本集', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '动作样本' });
    await user.click(tabs[0]);
    const panel = await screen.findByRole('tabpanel', { name: '动作样本' });
    await user.click(within(panel).getByRole('button', { name: '新建动作样本集' }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1)!;
    await user.type(within(dialog).getAllByRole('textbox')[0], '阅读样本集');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/video-training/action-sample-sets', expect.objectContaining({ name: '阅读样本集' }));
    }, { timeout: 10000 });
  }, 15000);

  it('动作样本 tab 有导入会话动作按钮', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '动作样本' });
    await user.click(tabs[0]);
    expect((await screen.findAllByText('从学习会话导入')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '导入会话动作' })).toBeInTheDocument();
  }, 15000);

  it('可以激活训练模型', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '激活模型' }))[0]);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/video-training/training-jobs/10/activate-model');
    }, { timeout: 10000 });
  }, 15000);

  it('训练任务详情展示训练流程视图', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '查看详情' }))[0]);

    await waitFor(() => {
      expect(screen.getByText('训练任务详情')).toBeInTheDocument();
    }, { timeout: 10000 });

    expect(await screen.findByText('训练流程')).toBeInTheDocument();
    expect(screen.getByText('1. 数据准备')).toBeInTheDocument();
    expect(screen.getByText('2. 模型训练')).toBeInTheDocument();
  }, 15000);

  it('训练任务详情展示数据集摘要和类别分布', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '查看详情' }))[0]);

    await waitFor(() => {
      expect(screen.getByText('训练任务详情')).toBeInTheDocument();
    }, { timeout: 10000 });

    expect(await screen.findByText('数据集摘要')).toBeInTheDocument();
    expect(screen.getByText('标注数量')).toBeInTheDocument();
    expect(screen.getByText('类别列表')).toBeInTheDocument();
  }, 15000);

  it('训练任务详情展示关键指标卡', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '查看详情' }))[0]);

    await waitFor(() => {
      expect(screen.getByText('训练任务详情')).toBeInTheDocument();
    }, { timeout: 10000 });

    expect(await screen.findByText('关键指标')).toBeInTheDocument();
    expect(screen.getByText('mAP50')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Precision')).toBeInTheDocument();
  }, 15000);

  it('训练任务详情展示模型激活状态', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '查看详情' }))[0]);

    await waitFor(() => {
      expect(screen.getByText('训练任务详情')).toBeInTheDocument();
    }, { timeout: 10000 });

    const drawer = screen.getByRole('dialog', { name: '训练任务详情' });
    expect(within(drawer).getByText('模型')).toBeInTheDocument();
    expect(within(drawer).getAllByText('书本检测训练').length).toBeGreaterThan(0);
  }, 15000);

  it('训练任务详情展示状态时间线', async () => {
    const user = userEvent.setup();
    renderVideoTraining();

    const tabs = await screen.findAllByRole('tab', { name: '训练任务' });
    await user.click(tabs[0]);
    await user.click((await screen.findAllByRole('button', { name: '查看详情' }))[0]);

    await waitFor(() => {
      expect(screen.getByText('训练任务详情')).toBeInTheDocument();
    }, { timeout: 10000 });

    expect(await screen.findByText('状态时间线')).toBeInTheDocument();
    expect(screen.getByText('任务创建')).toBeInTheDocument();
    expect(screen.getByText('任务完成')).toBeInTheDocument();
  }, 15000);

});
