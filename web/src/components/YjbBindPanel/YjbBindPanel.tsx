import { useCallback, useEffect, useRef, useState } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Spin, Typography } from 'antd';
import { api } from '@/api/client';

const { Title, Paragraph } = Typography;

type BindState = 'loading' | 'waiting' | 'success' | 'expired' | 'error';

interface YjbBindPanelProps {
  onBound?: () => void;
}

export function YjbBindPanel({ onBound }: YjbBindPanelProps) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [status, setStatus] = useState<BindState>('loading');
  const [message, setMessage] = useState('正在获取二维码...');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (expireRef.current) clearTimeout(expireRef.current);
    pollRef.current = null;
    expireRef.current = null;
  }, []);

  const startBind = useCallback(async () => {
    clearTimers();
    setStatus('loading');
    setMessage('正在获取二维码...');
    setQrImage(null);

    try {
      const qr = await api.createYjbQrcode();
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
          const result = await api.getYjbQrcodeStatus(qr.id);
          if (result.state === '2') {
            clearTimers();
            setStatus('success');
            setMessage(`绑定成功，欢迎 ${result.nickname || result.yjb_nickname || ''}`);
            setTimeout(() => onBound?.(), 600);
          } else if (result.state === '3') {
            clearTimers();
            setStatus('expired');
            setMessage('二维码已失效，请刷新');
          }
        } catch {
          setStatus('error');
          setMessage('绑定状态查询失败');
        }
      }, 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : '获取二维码失败');
    }
  }, [clearTimers, onBound]);

  useEffect(() => {
    void startBind();
    return clearTimers;
  }, [startBind, clearTimers]);

  return (
    <Flex align="center" justify="center" style={{ minHeight: 'calc(100vh - 120px)', padding: 20 }}>
      <Card style={{ width: '100%', maxWidth: 520 }} bordered={false}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
          绑定养基宝账号
        </Title>
        <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 16 }}>
          持仓数据来自养基宝，需完成以下步骤后再扫码
        </Paragraph>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="绑定前请确认"
          description={
            <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>已关注微信公众号「养基宝」</li>
              <li>已在养基宝小程序或 App 完成注册并登录</li>
              <li>使用微信扫一扫下方二维码，并在手机上确认授权</li>
            </ol>
          }
        />

        <Flex
          align="center"
          justify="center"
          style={{
            width: 240,
            height: 240,
            margin: '0 auto 24px',
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
              alt="养基宝绑定二维码"
              style={{ width: 220, height: 220, borderRadius: 8 }}
            />
          )}
        </Flex>

        <Paragraph style={{ textAlign: 'center', marginBottom: 16 }}>{message}</Paragraph>

        {(status === 'expired' || status === 'error') && (
          <Flex justify="center" style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={startBind}>
              刷新二维码
            </Button>
          </Flex>
        )}

        {qrId ? (
          <Paragraph type="secondary" style={{ fontSize: 13, textAlign: 'center', marginBottom: 0 }}>
            二维码有效期约 4 分钟
          </Paragraph>
        ) : null}
      </Card>
    </Flex>
  );
}
