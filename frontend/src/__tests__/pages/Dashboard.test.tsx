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

import Dashboard from '../../pages/Dashboard';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard看板', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: [] });
  });

  it('渲染4个统计卡片', () => {
    renderDashboard();
    expect(screen.getByText('今日产量')).toBeInTheDocument();
    expect(screen.getByText('良率')).toBeInTheDocument();
    expect(screen.getByText('活跃摄像头')).toBeInTheDocument();
    expect(screen.getByText('未处理告警')).toBeInTheDocument();
  });

  it('渲染事件表格和告警列表', () => {
    renderDashboard();
    expect(screen.getByText('最新检测事件')).toBeInTheDocument();
    expect(screen.getByText('告警通知')).toBeInTheDocument();
  });

  it('调用API加载数据', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/stats/dashboard') {
        return Promise.resolve({
          data: {
            total_production: 1500,
            total_defects: 20,
            yield_rate: 98.7,
            oee: 85.0,
            active_cameras: 3,
            total_cameras: 5,
            unacknowledged_alerts: 2,
            critical_alerts: 1,
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderDashboard();

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/stats/dashboard');
      expect(mockApi.get).toHaveBeenCalledWith('/events', { params: { limit: 10 } });
      expect(mockApi.get).toHaveBeenCalledWith('/alerts', { params: { limit: 10, acknowledged: false } });
    });
  });
});
