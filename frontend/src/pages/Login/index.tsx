import React, { useState } from 'react';
import { Form, Input, Button, Select, Checkbox, Progress } from 'antd';
import { UserOutlined, LockOutlined, GlobalOutlined, SafetyCertificateOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

function getPasswordStrength(pwd: string): { percent: number; status: 'exception' | 'active' | 'success'; text: string } {
  let score = 0;
  if (pwd.length >= 8) score += 20;
  if (/[A-Z]/.test(pwd)) score += 20;
  if (/[a-z]/.test(pwd)) score += 20;
  if (/[0-9]/.test(pwd)) score += 20;
  if (/[!@#$%^&*(),.?":{}|<>_\-]/.test(pwd)) score += 20;
  if (score < 40) return { percent: score, status: 'exception', text: '弱' };
  if (score < 80) return { percent: score, status: 'active', text: '中' };
  return { percent: score, status: 'success', text: '强' };
}

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { t, i18n } = useTranslation();

  const [captchaKey, setCaptchaKey] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const loadCaptcha = async () => {
    try {
      const res = await api.get('/auth/captcha');
      setCaptchaKey(res.data.captcha_key);
      setCaptchaSvg(res.data.svg);
    } catch {
      console.error('Failed to load captcha');
    }
  };

  React.useEffect(() => {
    loadCaptcha();
  }, []);

  const strength = getPasswordStrength(password);

  const onFinish = async (values: { username: string; password: string; captcha_code?: string }) => {
    setLoading(true);
    try {
      const payload: any = { username: values.username, password: values.password, remember_me: rememberMe };
      if (values.captcha_code) {
        payload.captcha_key = captchaKey;
        payload.captcha_code = values.captcha_code;
      }
      await login(values.username, values.password, rememberMe, payload);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || t('auth.loginFailed'));
      if (err.response?.status !== 423) {
        loadCaptcha();
      }
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
              { icon: '\uD83C\uDFAF', label: t('auth.feature1') || '\u667A\u80FD\u68C0\u6D4B' },
              { icon: '\uD83D\uDCCA', label: t('auth.feature2') || '\u5B9E\u65F6\u76D1\u63A7' },
              { icon: '\u26A1', label: t('auth.feature3') || '\u9AD8\u6548\u5206\u6790' },
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
            {t('auth.loginHint') || '\u8BF7\u8F93\u5165\u8D26\u53F7\u548C\u5BC6\u7801\u767B\u5F55\u7CFB\u7EDF'}
          </p>

          {errorMsg && (
            <div style={{
              backgroundColor: '#fff2f0', border: '1px solid #ffccc7',
              borderRadius: 8, padding: '8px 12px', marginBottom: 16,
              color: '#cf1322', fontSize: 13,
            }}>
              {errorMsg}
            </div>
          )}

          <Form form={form} onFinish={onFinish} layout="vertical" size="large" autoComplete="off">
            <Form.Item
              name="username"
              rules={[{ required: true, message: t('auth.username') || '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder={t('auth.username') || '用户名'}
                style={{ height: 46, borderRadius: 8 }}
                onChange={() => setErrorMsg('')}
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
                onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.password') || '\u8BF7\u8F93\u5165\u5BC6\u7801' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder={t('auth.password') || '\u5BC6\u7801'}
                style={{ height: 46, borderRadius: 8 }}
                onChange={e => setPassword(e.target.value)}
              />
            </Form.Item>
            {password && (
              <Form.Item style={{ marginBottom: 12 }}>
                <Progress
                  percent={strength.percent}
                  status={strength.status}
                  showInfo={false}
                  size="small"
                />
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {strength.text === '\u5F3A' && '\u5BC6\u7801\u5F3A\u5EA6\uFF1A\u5F3A'}
                  {strength.text === '\u4E2D' && '\u5BC6\u7801\u5F3A\u5EA6\uFF1A\u4E2D'}
                  {strength.text === '\u5F31' && '\u5BC6\u7801\u5F3A\u5EA6\uFF1A\u5F31'}
                </div>
              </Form.Item>
            )}
            {captchaSvg && (
              <Form.Item name="captcha_code" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    placeholder={t('auth.captcha') || '验证码'}
                    style={{ height: 46, borderRadius: 8, flex: 1 }}
                    onChange={() => setErrorMsg('')}
                  />
                  <div
                    onClick={loadCaptcha}
                    style={{
                      cursor: 'pointer', border: '1px solid #d9d9d9', borderRadius: 8,
                      padding: '4px 8px', background: '#fff', display: 'flex', alignItems: 'center',
                      height: 46,
                    }}
                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                  />
                  <ReloadOutlined onClick={loadCaptcha} style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 18 }} />
                </div>
              </Form.Item>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Checkbox checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}>
                {t('auth.rememberMe') || '记住我'}
              </Checkbox>
            </div>
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
