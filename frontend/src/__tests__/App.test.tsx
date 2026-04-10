import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock api before importing components
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 1, username: 'manager', display_name: 'Manager', role: 'manager' },
    token: 'test-token',
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { Routes, Route } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Dashboard from '../pages/Dashboard';
import Cameras from '../pages/Cameras';
import Alerts from '../pages/Alerts';
import Statistics from '../pages/Statistics';
import Settings from '../pages/Settings';
import App from '../App';

function TestApp({ initialEntry = '/' }: { initialEntry?: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="cameras" element={<Cameras />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('App路由', () => {
  it('渲染主布局', () => {
    render(<TestApp />);
    expect(screen.getByText('YoloCheck 监控')).toBeInTheDocument();
    expect(screen.getByText('YOLO生产过程学习监控系统')).toBeInTheDocument();
  });

  it('渲染侧边栏菜单', () => {
    render(<TestApp />);
    expect(screen.getAllByText('实时看板').length).toBeGreaterThan(0);
    expect(screen.getAllByText('摄像头管理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('告警管理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('统计分析').length).toBeGreaterThan(0);
    expect(screen.getAllByText('系统设置').length).toBeGreaterThan(0);
  });

  it('默认路由显示看板页', () => {
    render(<TestApp />);
    expect(screen.getAllByText('今日产量').length).toBeGreaterThan(0);
  });

  it('导航到摄像头管理页', () => {
    render(<TestApp initialEntry="/cameras" />);
    expect(screen.getByText('添加摄像头')).toBeInTheDocument();
  });

  it('导航到设置页', () => {
    render(<TestApp initialEntry="/settings" />);
    expect(screen.getByText('系统配置')).toBeInTheDocument();
  });

  it('真实App访问重页面路由时先显示统一加载态', async () => {
    window.history.pushState({}, '', '/video-training');

    render(<App />);

    expect(screen.getByText('页面加载中...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('自定义训练工作台')).toBeInTheDocument();
    });
  });
});
