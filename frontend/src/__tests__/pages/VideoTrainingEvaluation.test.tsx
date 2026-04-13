// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import '../../test/setup';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    canvas: document.createElement('canvas'),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    globalCompositeOperation: 'source-over',
  })),
});

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

import VideoTrainingEvaluation from '../../pages/VideoTrainingEvaluation';

function renderPage() {
  return render(
    <MemoryRouter>
      <VideoTrainingEvaluation />
    </MemoryRouter>
  );
}

describe('VideoTrainingEvaluation 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/video-training/models/custom_object/evaluations') {
        return Promise.resolve({
          data: [
            {
              model: { id: 101, name: 'book-detector-a', model_type: 'custom_object', accuracy: 0.91, map50: 0.89, inference_speed: 11.2, is_active: true },
              job: { id: 11, name: '对象模型A训练', log_path: '/tmp/object-a.log', metrics_json: { dataset_export: { annotation_count: 12, class_names: ['book', 'hand'] } } },
            },
            {
              model: { id: 102, name: 'book-detector-b', model_type: 'custom_object', accuracy: 0.88, map50: 0.84, inference_speed: 10.5, is_active: false },
              job: { id: 12, name: '对象模型B训练', log_path: '/tmp/object-b.log', metrics_json: { dataset_export: { annotation_count: 8, class_names: ['book'] } } },
            },
          ],
        });
      }
      if (url === '/video-training/models/custom_action/evaluations') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/video-training/models/compare/101/102') {
        return Promise.resolve({
          data: {
            model_a: { id: 101, name: 'book-detector-a', accuracy: 0.91 },
            model_b: { id: 102, name: 'book-detector-b', accuracy: 0.88 },
            dataset_diff: { annotation_count_diff: 4 },
            class_metrics_diff: {
              book: { precision_diff: 0.06, recall_diff: 0.07, sample_count_diff: 0 },
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('加载模型历史并展示基础统计', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/models/custom_object/evaluations');
    });

    expect(await screen.findByText('训练评估中心')).toBeInTheDocument();
    expect(screen.getByText('book-detector-a')).toBeInTheDocument();
    expect(screen.getByText('对象模型A训练')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('选择两个模型后可以请求 compare 并展示差异', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('book-detector-a')).toBeInTheDocument();
    await user.click((await screen.findAllByRole('button', { name: '对比所选模型' }))[0]);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/video-training/models/compare/101/102');
    });

    expect(await screen.findByText('annotation_count_diff')).toBeInTheDocument();
    expect(screen.getByText('0.06')).toBeInTheDocument();
  });
});
