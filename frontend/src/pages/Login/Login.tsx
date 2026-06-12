import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Spin, Typography } from 'antd';
import { api } from '@/api/client';

const { Title, Paragraph, Text } = Typography;

type LoginState = 'loading' | 'waiting' | 'scanning' | 'success' | 'expired' | 'error';

export function Login() {
  const navigate = useNavigate();
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [status, setStatus] = useState<LoginState>('loading');
  const [message, setMessage] = useState('正在获取二维码...');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (expireRef.current) clearTimeout(expireRef.current);
    pollRef.current = null;
    expireRef.current = null;
  }, []);

  const startLogin = useCallback(async () => {
    clearTimers();
    setStatus('loading');
    setMessage('正在获取二维码...');
    setQrImage(null);

    try {
      const auth = await api.getAuthStatus();
      if (auth.logged_in) {
        navigate('/', { replace: true });
        return;
      }

      const qr = await api.createQrcode();
      setQrId(qr.id);
      setQrImage(`data:image/png;base64,${qr.image_base64}`);
      setStatus('waiting');
      setMessage('请使用微信扫一扫');

      expireRef.current = setTimeout(() => {
        clearTimers();
        setStatus('expired');
        setMessage('二维码已过期，请刷新');
      }, 240000);

      pollRef.current = setInterval(async () => {
        if (!qr.id) return;
        try {
          const result = await api.getQrcodeStatus(qr.id);
          if (result.state === '1') {
            setStatus('scanning');
            setMessage('已扫码，请在手机上确认登录');
          } else if (result.state === '2') {
            clearTimers();
            setStatus('success');
            setMessage(`登录成功，欢迎 ${result.nickname || ''}`);
            setTimeout(() => navigate('/', { replace: true }), 800);
          } else if (result.state === '3') {
            clearTimers();
            setStatus('expired');
            setMessage('二维码已失效，请刷新');
          }
        } catch {
          setStatus('error');
          setMessage('登录状态查询失败');
        }
      }, 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : '获取二维码失败');
    }
  }, [clearTimers, navigate]);

  useEffect(() => {
    startLogin();
    return clearTimers;
  }, [startLogin, clearTimers]);

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 20 }}>
      <Card style={{ width: '100%', maxWidth: 420 }} bordered={false}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
          微信扫码登录
        </Title>
        <Paragraph type="secondary" style={{ textAlign: 'center' }}>
          Token 失效或未登录时，请使用
          <Text type="danger"> 微信扫一扫 </Text>
          完成授权
        </Paragraph>

        <Flex
          align="center"
          justify="center"
          style={{
            width: 240,
            height: 240,
            margin: '24px auto',
            background: '#fafbfc',
            borderRadius: 12,
            border: '1px solid #eef1f6',
          }}
        >
          {status === 'loading' || !qrImage ? (
            <Spin size="large" />
          ) : (
            <img
              src={qrImage}
              alt="微信登录二维码"
              style={{ width: 220, height: 220, borderRadius: 8 }}
            />
          )}
        </Flex>

        <Paragraph style={{ textAlign: 'center', marginBottom: 16 }}>{message}</Paragraph>

        {(status === 'expired' || status === 'error') && (
          <Flex justify="center" style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={startLogin}>
              刷新二维码
            </Button>
          </Flex>
        )}

        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
          1. 打开微信 → 右上角 + → 扫一扫
          <br />
          2. 扫描上方二维码并确认登录
          <br />
          3. 二维码有效期约 4 分钟
          {qrId ? (
            <>
              <br />
              ID: {qrId}
            </>
          ) : null}
        </Paragraph>
      </Card>
    </Flex>
  );
}
