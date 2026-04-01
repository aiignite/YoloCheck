import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../utils/api';

interface AuthUser {
  id: number;
  username: string;
  display_name: string | null;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  // 设置 axios 拦截器
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use((config) => {
      const t = localStorage.getItem('access_token');
      if (t) {
        config.headers.Authorization = `Bearer ${t}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  // 初始化：检查已保存的 token
  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem('access_token');
      if (savedToken) {
        try {
          const res = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          setUser(res.data);
          setToken(savedToken);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    const { access_token, refresh_token, user: userData } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setToken(access_token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    const t = localStorage.getItem('access_token');
    if (t) {
      api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
