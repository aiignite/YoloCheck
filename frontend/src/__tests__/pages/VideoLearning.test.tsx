// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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

import VideoLearning from '../../pages/VideoLearning';

function renderVideoLearning() {
  return render(
    <MemoryRouter>
      <VideoLearning />
    </MemoryRouter>
  );
}

const mockTemplate = {
  id: 1,
  name: '装配标准模板',
  description: '装配标准模板说明',
  video_path: '/uploads/template.mp4',
  duration_seconds: 12.5,
  fps: 10,
  frame_count: 125,
  resolution: '1920x1080',
  business_type: 'assembly',
  station_id: 'station-01',
  learning_config: {
    learning_mode: 'action_and_object',
    sample_rate: 5,
    min_confidence: 0.4,
    scene_threshold: 30,
    focus_classes: ['screwdriver', 'part', 'hand'],
    object_model_id: 11,
    action_model_id: 22,
  },
  sop_content: {
    title: '标准作业指导书',
    steps: [
      {
        step_order: 1,
        name: '拿取工件',
        keyframe_path: '/tmp/keyframe-1.jpg',
        objects: ['part', 'hand'],
      },
    ],
  },
  workflow_summary: {
    step_count: 2,
  },
  status: 'completed',
  created_at: '2026-04-01T00:00:00Z',
};

const mockSession = {
  id: 101,
  template_id: 1,
  status: 'completed',
  progress: 100,
  total_frames: 125,
  processed_frames: 125,
  objects_detected: 8,
  actions_identified: 2,
  learning_mode: 'action_and_object',
  focus_classes: ['screwdriver', 'part', 'hand'],
  sample_rate: 5,
  min_confidence: 0.4,
  scene_threshold: 30,
  error_message: null,
  analysis_result: {
    analysis: {
      object_frequency: {
        screwdriver: 3,
        part: 5,
      },
    },
    workflow_summary: {
      dominant_sequence: ['拿取工件', '拧紧螺丝'],
      quality_score_avg: 0.82,
      step_count: 2,
    },
    workflow_suggestions: [
      { type: 'quality', message: '第2步质量评分偏低，建议优先复核' },
    ],
  },
  started_at: '2026-04-01T00:00:00Z',
  completed_at: '2026-04-01T00:05:00Z',
};

const mockActions = [
  {
    id: 201,
    step_order: 1,
    action_name: 'pick_part',
    user_defined_name: null,
    note: null,
    is_kept: true,
    description: '拿起工件并定位',
    start_time: 0,
    end_time: 1.2,
    duration: 1.2,
    confidence: 0.9,
    keyframe_path: '/tmp/keyframe-1.jpg',
    objects_in_scene: ['part', 'hand'],
    suggestions: [
      { type: 'rename', message: '建议命名为拿取工件' },
    ],
    features: {
      quality_score: 0.86,
      boundary_score: 0.35,
      boundary_reasons: ['scene_jump'],
      detection_score: 0.91,
      pose_score: 0.75,
      interaction_score: 0.80,
      stability_score: 0.78,
      primary_objects: ['part'],
      suggested_action_name: '拿取工件',
      suggestions: [
        { type: 'rename', message: '建议命名为拿取工件' },
      ],
      pose_summary: {
        frames_with_pose: 3,
        wrist_span_x: 24,
        wrist_span_y: 12,
      },
    },
  },
  {
    id: 202,
    step_order: 2,
    action_name: 'tighten_screw',
    user_defined_name: null,
    note: null,
    is_kept: true,
    description: '拧紧螺丝固定',
    start_time: 1.3,
    end_time: 3.4,
    duration: 2.1,
    confidence: 0.73,
    keyframe_path: '/tmp/keyframe-2.jpg',
    objects_in_scene: ['screwdriver', 'part'],
    suggestions: [
      { type: 'quality', message: '第2步质量评分偏低，建议优先复核' },
    ],
    features: {
      quality_score: 0.64,
      boundary_score: 0.68,
      boundary_reasons: ['object_set_changed', 'interaction_changed'],
      detection_score: 0.82,
      pose_score: 0.65,
      interaction_score: 0.55,
      stability_score: 0.45,
      primary_objects: ['screwdriver'],
      suggested_action_name: '拧紧螺丝',
      suggestions: [
        { type: 'quality', message: '第2步质量评分偏低，建议优先复核' },
      ],
      pose_summary: {
        frames_with_pose: 4,
        wrist_span_x: 18,
        wrist_span_y: 10,
      },
    },
  },
];

const mockFrameOverlays = [
  {
    frame_number: 1,
    timestamp: 0.1,
    image_path: '/tmp/frame-1.jpg',
    objects: [
      { class_name: 'part', confidence: 0.92, bbox: [0.1, 0.1, 0.3, 0.4] },
    ],
    pose_keypoints: [
      {
        person_index: 0,
        points: [
          { index: 5, x: 120, y: 220, conf: 0.9 },
          { index: 6, x: 180, y: 250, conf: 0.88 },
        ],
      },
    ],
    interaction_summary: { interaction_count: 1 },
    scene_change_score: 2,
    is_action_boundary: false,
  },
];

describe('VideoLearning 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/video-learning/templates') {
        return Promise.resolve({ data: [mockTemplate] });
      }
      if (url === '/models') {
        return Promise.resolve({
          data: [
            { id: 11, name: 'custom-object-v1', version: 'v1', model_type: 'custom_object', is_active: true, status: 'deployed', description: '', model_path: '/tmp/object.pt', file_size: 100, accuracy: 0.9, precision: 0.9, recall: 0.9, map50: 0.9, map50_95: 0.8, inference_speed: 10, deployed_at: null, created_at: '2026-04-02T00:00:00Z' },
            { id: 22, name: 'custom-action-v1', version: 'v1', model_type: 'custom_action', is_active: true, status: 'deployed', description: '', model_path: '/tmp/action.json', file_size: 100, accuracy: 0.8, precision: 0.8, recall: 0.8, map50: null, map50_95: null, inference_speed: 5, deployed_at: null, created_at: '2026-04-02T00:00:00Z' },
          ],
        });
      }
      if (url === '/video-learning/templates/1/sessions') {
        return Promise.resolve({ data: [mockSession] });
      }
      if (url === '/video-learning/sessions/101/actions') {
        return Promise.resolve({ data: mockActions });
      }
      if (url === '/video-learning/sessions/101/frame-overlays') {
        return Promise.resolve({ data: mockFrameOverlays });
      }
      return Promise.resolve({ data: [] });
    });
    mockApi.post.mockImplementation((url: string) => {
      if (url === '/video-learning/templates/1/sop-preview') {
        return Promise.resolve({
          data: {
            template_id: 1,
            title: '标准作业指导书',
            business_type: 'assembly',
            station_id: 'station-01',
            workflow_summary: { step_count: 1 },
            steps: [
              {
                step_order: 1,
                name: '拿取工件',
                description: '拿起工件并定位',
                keyframe_path: '/tmp/keyframe-1.jpg',
                objects: ['part', 'hand'],
              },
            ],
          },
        });
      }
      if (url === '/video-learning/actions/201/apply-suggestion') {
        return Promise.resolve({
          data: {
            ...mockActions[0],
            user_defined_name: '拿取工件',
          },
        });
      }
      if (url === '/video-learning/actions/202/apply-suggestion') {
        return Promise.resolve({
          data: {
            ...mockActions[1],
            user_defined_name: '拧紧螺丝',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    mockApi.put.mockResolvedValue({ data: mockTemplate });
  });

  it('展示智能建议、流程概览和 SOP 预览', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates/1/sessions');
    expect(mockApi.get).toHaveBeenCalledWith('/video-learning/sessions/101/actions');
    });

    expect(screen.getByText(/流程概览|pages\.videoLearning\.workflowOverview/)).toBeInTheDocument();
    expect(screen.getByText(/智能建议|pages\.videoLearning\.smartSuggestions/)).toBeInTheDocument();
    expect(screen.getByText(/SOP 预览|pages\.videoLearning\.sopPreview/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /智能建议|pages\.videoLearning\.smartSuggestions/ }));
    expect(screen.getAllByText('第2步质量评分偏低，建议优先复核').length).toBeGreaterThan(0);
    expect(screen.getAllByText('建议命名为拿取工件').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /采纳建议|pages\.videoLearning\.applySuggestion/ }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: /SOP 预览|pages\.videoLearning\.sopPreview/ }));
    expect(screen.getByText(/标准作业指导书/)).toBeInTheDocument();
    expect(screen.getAllByText(/拿取工件/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/part/).length).toBeGreaterThan(0);
  }, 15000);

  it('展示自定义物体模型和动作模型选择器', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    expect(await screen.findByText('物体模型')).toBeInTheDocument();
    expect(screen.getByText('动作模型')).toBeInTheDocument();
  });

  it('打开工作台时请求 overlay 数据并显示视频回放区域', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/sessions/101/frame-overlays', { params: { limit: 100000 } });
    });

    expect(screen.getByText(/视频回放|视频分析回放|pages\.videoLearning\.videoPlayback/)).toBeInTheDocument();
    expect(screen.getByText(/显示目标框|pages\.videoLearning\.showBoxes/)).toBeInTheDocument();
  });

  it('展示分段参数字段', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    expect(await screen.findByText('最短动作时长（秒）')).toBeInTheDocument();
    expect(screen.getByText('对象切换敏感度')).toBeInTheDocument();
  });

  it('编辑动作时提交起止时间字段', async () => {
    const user = userEvent.setup();
    mockApi.put.mockResolvedValueOnce({
      data: {
        ...mockActions[0],
        user_defined_name: 'pick_part',
        start_time: 0,
        end_time: 1.2,
        duration: 1.2,
      },
    });

    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    fireEvent.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/sessions/101/actions');
    });

    const actionLabels = await screen.findAllByText(/步骤 1:/);
    expect(actionLabels.length).toBeGreaterThan(0);

    const editTexts = await screen.findAllByText(/编辑|common\.edit/);
    const firstEditButton = editTexts[0].closest('button');
    expect(firstEditButton).not.toBeNull();
    await user.click(firstEditButton as HTMLButtonElement);

    const dialogs = await screen.findAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1];
    const spinbuttons = within(dialog).getAllByRole('spinbutton');
    expect(within(dialog).getByDisplayValue('pick_part')).toBeInTheDocument();
    expect(spinbuttons[0]).toHaveValue('0.0');
    expect(spinbuttons[1]).toHaveValue('1.2');

    fireEvent.click(within(dialog).getByRole('button', { name: /OK|common\.ok/ }));

    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith('/video-learning/actions/201', expect.objectContaining({
        user_defined_name: 'pick_part',
        start_time: 0,
        end_time: 1.2,
      }));
    });
  }, 15000);

  it('展示动作段的分项评分和质量分', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/sessions/101/actions');
    });

    await user.click(screen.getByRole('tab', { name: /时间轴|pages\.videoLearning\.timeline|步骤时间轴/ }));

    const stepCards = await screen.findAllByText(/步骤 1:/);
    expect(stepCards.length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/qualityScore|质量评分|质量分/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/detection:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pose:/i).length).toBeGreaterThan(0);
  }, 15000);

  it('展示动作段的边界原因标签', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/sessions/101/actions');
    });

    await user.click(screen.getByRole('tab', { name: /时间轴|pages\.videoLearning\.timeline|步骤时间轴/ }));

    expect(await screen.findByText(/scene_jump/i)).toBeInTheDocument();
    expect(screen.getByText(/object_set_changed/i)).toBeInTheDocument();
    expect(screen.getByText(/interaction_changed/i)).toBeInTheDocument();
  }, 15000);

  it('展示动作段的主对象和模型来源摘要', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/sessions/101/actions');
    });

    await user.click(screen.getByRole('tab', { name: /时间轴|pages\.videoLearning\.timeline|步骤时间轴/ }));

    const primaryObjects = await screen.findAllByText(/primaryObjects|主要对象/i);
    expect(primaryObjects.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/part/).length).toBeGreaterThan(0);
  }, 15000);

  it('时间轴 tab 点击可跳转视频播放位置', async () => {
    const user = userEvent.setup();
    renderVideoLearning();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/templates');
    });

    await user.click(screen.getAllByRole('button', { name: /学习工作台/ })[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-learning/sessions/101/actions');
    });

    await user.click(screen.getByRole('tab', { name: /时间轴|pages\.videoLearning\.timeline|步骤时间轴/ }));

    const firstEditButton = (await screen.findAllByRole('button', { name: /编辑|common\.edit/ }))[0];
    const firstTimelineCard = firstEditButton.closest('.ant-card');
    expect(firstTimelineCard).not.toBeNull();
    await user.click(firstTimelineCard as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText(/0\.0s \/ 12\.5s|1\.2s \/ 12\.5s/)).toBeInTheDocument();
    });
  }, 15000);

});
