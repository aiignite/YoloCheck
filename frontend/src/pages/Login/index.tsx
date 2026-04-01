import React, { useState } from 'react';
import { Form, Input, Button, message, Select } from 'antd';
import { UserOutlined, LockOutlined, GlobalOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();

  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success(t('auth.loginSuccess'));
    } catch (err: any) {
      message.error(err.response?.data?.detail || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      width: '100%',
    }}>
      {/* Left: Brand */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px',
        background: 'linear-gradient(135deg, #0a1628 0%, #16213e 40%, #0f3460 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,210,255,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-30%', right: '-15%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(58,123,213,0.06) 0%, transparent 70%)',
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(0,210,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 480 }}>
          <img src="/favicon.svg" alt="YoloCheck" style={{ width: 80, height: 80, marginBottom: 24 }} />
          <h1 style={{
            color: '#fff', fontSize: 36, fontWeight: 700, margin: '0 0 12px',
            letterSpacing: '1px',
          }}>
            YoloCheck
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 16, margin: '0 0 48px', lineHeight: 1.6,
          }}>
            {t('auth.loginSubtitle')}
          </p>
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
            {[
              { icon: '🎯', label: t('auth.feature1') || '智能检测' },
              { icon: '📊', label: t('auth.feature2') || '实时监控' },
              { icon: '⚡', label: t('auth.feature3') || '高效分析' },
            ].map(item => (
              <div key={item.icon} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, margin: '0 auto 8px',
                  background: 'rgba(0,210,255,0.1)', border: '1px solid rgba(0,210,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {item.icon}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div style={{
        flex: '0 0 480px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px',
        background: '#f8fafc',
      }}>
        <div style={{
          position: 'absolute', top: 20, right: 20,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <GlobalOutlined style={{ color: '#666', fontSize: 14 }} />
          <Select
            size="small"
            variant="borderless"
            value={i18n.language?.startsWith('zh') ? 'zh' : 'en'}
            onChange={(val) => i18n.changeLanguage(val)}
            options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]}
            style={{ width: 80 }}
          />
        </div>

        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ marginBottom: 8 }}>
            <SafetyCertificateOutlined style={{ fontSize: 32, color: '#0f3460' }} />
          </div>
          <h2 style={{
            color: '#1a1a2e', fontSize: 26, fontWeight: 700, margin: '0 0 4px',
          }}>
            {t('auth.loginTitle')}
          </h2>
          <p style={{ color: '#94a3b8', margin: '0 0 32px', fontSize: 14 }}>
            {t('auth.loginHint') || '请输入账号和密码登录系统'}
          </p>

          <Form onFinish={onFinish} layout="vertical" size="large" autoComplete="off">
            <Form.Item
              name="username"
              rules={[{ required: true, message: t('auth.username') || '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder={t('auth.username') || '用户名'}
                style={{ height: 46, borderRadius: 8 }}
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.password') || '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder={t('auth.password') || '密码'}
                style={{ height: 46, borderRadius: 8 }}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 46,
                  borderRadius: 8,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #0f3460, #1a5276)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(15,52,96,0.3)',
                }}
              >
                {t('auth.loginButton')}
              </Button>
            </Form.Item>
          </Form>

          <p style={{
            textAlign: 'center', color: '#94a3b8', fontSize: 12,
            borderTop: '1px solid #e2e8f0', paddingTop: 16, margin: 0,
          }}>
            Default admin: admin / admin123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
