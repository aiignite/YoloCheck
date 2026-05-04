import React from 'react';
import { Layout, Menu, Button, Space, Tag, Select } from 'antd';
import {
  DashboardOutlined,
  CameraOutlined,
  AlertOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  ScheduleOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  BellOutlined,
  SettingOutlined,
  MonitorOutlined,
  AuditOutlined,
  LogoutOutlined,
  UserOutlined,
  GlobalOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const { Header, Sider, Content } = Layout;

const roleColors: Record<string, string> = { admin: 'red', manager: 'blue', operator: 'green' };

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: t('menu.dashboard') },
    { key: '/live-monitor', icon: <MonitorOutlined />, label: t('menu.liveMonitor') },
    { key: '/cameras', icon: <CameraOutlined />, label: t('menu.cameras') },
    { key: '/alerts', icon: <AlertOutlined />, label: t('menu.alerts') },
    { key: '/statistics', icon: <BarChartOutlined />, label: t('menu.statistics') },
    { key: '/video-learning', icon: <VideoCameraOutlined />, label: t('menu.videoLearning') },
    { key: '/video-training', icon: <AppstoreOutlined />, label: t('menu.videoTraining') },
    { key: '/video-training/evaluation', icon: <BarChartOutlined />, label: t('menu.videoTrainingEvaluation') },
    { key: '/mes', icon: <ScheduleOutlined />, label: t('menu.mes') },
    { key: '/models', icon: <AppstoreOutlined />, label: t('menu.models') },
    { key: '/batch-analysis', icon: <CloudServerOutlined />, label: t('menu.batchAnalysis') },
    { key: '/alert-workflow', icon: <BellOutlined />, label: t('menu.alertWorkflow') },
    { key: '/storage', icon: <DatabaseOutlined />, label: t('menu.storage') },
    { key: '/users', icon: <TeamOutlined />, label: t('menu.users') },
    { key: '/sessions', icon: <MonitorOutlined />, label: t('menu.sessions') || '会话管理' },
    { key: '/login-history', icon: <AuditOutlined />, label: t('menu.loginHistory') || '登录历史' },
    ...(user?.role === 'admin' ? [{ key: '/audit-logs', icon: <AuditOutlined />, label: t('menu.auditLogs') }] : []),
    { key: '/settings', icon: <SettingOutlined />, label: t('menu.settings') },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <img src="/favicon.svg" alt="" style={{ width: 28, height: 28 }} />
            <h2 style={{ color: '#fff', margin: 0, fontSize: 16 }}>{t('app.title')}</h2>
          </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0 }}>{t('app.subtitle')}</h3>
          <Space>
            <GlobalOutlined />
            <Select
              size="small"
              value={i18n.language?.startsWith('zh') ? 'zh' : 'en'}
              onChange={(val) => i18n.changeLanguage(val)}
              options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]}
              style={{ width: 90 }}
            />
            {user && (
              <>
                <UserOutlined />
                <span>{user.display_name || user.username}</span>
                <Tag color={roleColors[user.role]}>{t(`role.${user.role}`, user.role)}</Tag>
                <Button size="small" icon={<LogoutOutlined />} onClick={logout}>{t('auth.logout')}</Button>
              </>
            )}
          </Space>
        </Header>
        <Content style={{ margin: 0, padding: 16, background: '#f5f5f5', flex: 1, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
