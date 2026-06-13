import { useCallback, useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Flex,
  Form,
  Input,
  Layout,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import { AppHeader } from '@/components/AppHeader/AppHeader';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import type { AdminUserItem } from '@/types/auth';
import { PAGE_CARD_STYLE, PAGE_CONTENT_STYLE } from '@/utils/pageLayout';

const { Content } = Layout;
const { Title, Text } = Typography;

export function UserManagement() {
  const { isAdmin, loading: authLoading } = useAuthStatus();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await api.listAdminUsers();
      setItems(data.items);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载用户失败');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void load();
    }
  }, [isAdmin, load]);

  const columns: ColumnsType<AdminUserItem> = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) =>
        role === 'admin' ? <Tag color="red">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (active ? '启用' : '禁用'),
    },
    {
      title: '养基宝',
      key: 'yjb',
      render: (_, row) =>
        row.yjb_bound ? row.yjb_nickname || '已绑定' : <Text type="secondary">未绑定</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => setEditUser(row)}>
            编辑
          </Button>
          {row.role === 'admin' ? null : (
            <Button size="small" danger onClick={() => void handleDelete(row)}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    try {
      await api.createAdminUser({
        username: values.username,
        password: values.password,
      });
      message.success('用户已创建');
      setCreateOpen(false);
      createForm.resetFields();
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    const values = await editForm.validateFields();
    try {
      await api.updateAdminUser(editUser.user_id, {
        password: values.password || undefined,
        role: editUser.role,
        is_active: editUser.role === 'admin' ? true : values.is_active,
      });
      message.success('用户已更新');
      setEditUser(null);
      editForm.resetFields();
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleDelete = async (row: AdminUserItem) => {
    Modal.confirm({
      title: `删除用户「${row.username}」？`,
      content: '删除后该用户的会话、通知配置将被清除。',
      okType: 'danger',
      onOk: async () => {
        await api.deleteAdminUser(row.user_id);
        message.success('已删除');
        await load();
      },
    });
  };

  useEffect(() => {
    if (!editUser) return;
    editForm.setFieldsValue({
      is_active: editUser.is_active,
      password: '',
    });
  }, [editUser, editForm]);

  if (authLoading || !isAdmin) {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <AppHeader
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            添加用户
          </Button>
        }
      />
      <Content style={PAGE_CONTENT_STYLE}>
        <Flex align="center" justify="space-between" style={{ marginBottom: 20 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              用户管理
            </Title>
            <Text type="secondary">添加、编辑或禁用系统用户</Text>
          </div>
        </Flex>
        <div style={PAGE_CARD_STYLE}>
          <Table rowKey="user_id" loading={loading} columns={columns} dataSource={items} pagination={false} />
        </div>
      </Content>

      <Modal title="添加用户" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void handleCreate()}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editUser ? `编辑用户：${editUser.username}` : '编辑用户'}
        open={Boolean(editUser)}
        onCancel={() => setEditUser(null)}
        onOk={() => void handleUpdate()}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="password" label="新密码" extra="留空则不修改">
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          {editUser?.role === 'admin' ? null : (
            <Form.Item name="is_active" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Layout>
  );
}
