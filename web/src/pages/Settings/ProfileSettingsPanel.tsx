import { useState } from 'react';
import { App, Button, Form, Input, Typography } from 'antd';
import { api } from '@/api/client';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { PAGE_CARD_STYLE } from '@/utils/pageLayout';

const { Title, Text } = Typography;

export function ProfileSettingsPanel() {
  const { message } = App.useApp();
  const { status, reload } = useAuthStatus();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) => {
    if (values.new_password !== values.confirm_password) {
      message.warning('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(values.current_password, values.new_password);
      message.success('密码已更新');
      form.resetFields();
      await reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={PAGE_CARD_STYLE}>
      <Title level={5} style={{ marginTop: 0 }}>
        个人中心
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        管理账号信息。用户名由管理员分配，不可自行修改。
      </Text>

      <Form layout="vertical" style={{ maxWidth: 420 }}>
        <Form.Item label="用户名">
          <Input value={status?.username || ''} disabled />
        </Form.Item>
        {status?.role === 'admin' ? (
          <Form.Item label="角色">
            <Input value="管理员" disabled />
          </Form.Item>
        ) : null}
        {status?.yjb_bound ? (
          <Form.Item label="养基宝昵称">
            <Input value={status.yjb_nickname || '已绑定'} disabled />
          </Form.Item>
        ) : null}
      </Form>

      <Title level={5} style={{ marginTop: 8 }}>
        修改密码
      </Title>
      <Form form={form} layout="vertical" style={{ maxWidth: 420 }} onFinish={handleSubmit}>
        <Form.Item
          name="current_password"
          label="当前密码"
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password placeholder="当前密码" autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '至少 6 位' },
          ]}
        >
          <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="确认新密码"
          rules={[{ required: true, message: '请再次输入新密码' }]}
        >
          <Input.Password placeholder="再次输入新密码" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>
          保存密码
        </Button>
      </Form>
    </div>
  );
}
