import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  default: mockApi,
}));

import Cameras from '../../pages/Cameras';

function renderCameras() {
  return render(
    <MemoryRouter>
      <Cameras />
    </MemoryRouter>
  );
}

const mockCamera = {
  id: 1,
  camera_id: 'CAM001',
  name: '车间1号摄像头',
  location: 'A区',
  type: 'quality',
  stream_url: 'rtsp://192.168.1.100:554',
  status: 'online',
};

describe('Cameras页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: [] });
  });

  it('渲染添加按钮', () => {
    renderCameras();
    expect(screen.getByText('添加摄像头')).toBeInTheDocument();
  });

  it('加载摄像头列表', async () => {
    mockApi.get.mockResolvedValue({ data: [mockCamera] });
    renderCameras();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/cameras');
    });
  });

  it('展示摄像头数据', async () => {
    mockApi.get.mockResolvedValue({ data: [mockCamera] });
    renderCameras();

    await waitFor(() => {
      expect(screen.getByText('CAM001')).toBeInTheDocument();
    });
  });
});
