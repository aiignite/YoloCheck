import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [
      { id: 1, jti: 'abc', ip_address: '192.168.1.1', user_agent: 'Mozilla/5.0', device_info: 'Desktop', created_at: '2026-05-04T10:00:00Z', last_accessed_at: '2026-05-04T11:00:00Z', is_current: true },
    ] }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'test', display_name: 'Test', role: 'manager' },
    token: 'test-token',
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import Sessions from '../../pages/Sessions';

describe('Sessions Page', () => {
  it('renders sessions table with data', async () => {
    render(
      <MemoryRouter>
        <Sessions />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('当前会话')).toBeInTheDocument();
    });
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });
});
