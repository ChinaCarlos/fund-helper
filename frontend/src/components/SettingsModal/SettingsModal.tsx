import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/api/client';
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Typography,
} from 'antd';
import { ApiOutlined, LinkOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd/es/form';
import type { NotificationConfig, NotifyChannel } from '@/utils/notificationSettings';
import {
  createDefaultNotificationConfig,
  isChannelActive,
  isChannelConfigured,
  loadNotificationSettings,
  mergeNotificationConfig,
  NOTIFY_FREQUENCY_OPTIONS,
  saveNotificationSettings,
  sanitizeNotificationConfig,
  validateNotificationSettings,
} from '@/utils/notificationSettings';
import type { ChannelConnectivityState } from '@/utils/notificationConnectivity';
import {
  connectivityStatusLabel,
  createInitialConnectivityMap,
  runChannelConnectivityTest,
} from '@/utils/notificationConnectivity';
import './SettingsModal.scss';

const { Text, Link } = Typography;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type PanelKey = 'trigger' | NotifyChannel;
type FormValues = NotificationConfig;

const NAV_ITEMS: { key: PanelKey; label: string }[] = [
  { key: 'trigger', label: '触发配置' },
  { key: 'dingtalk', label: '钉钉' },
  { key: 'feishu', label: '飞书' },
  { key: 'wecom', label: '企业微信' },
];

/** 应用模式暂未开放的平台（仅保留 Webhook，后期再开发） */
const DEFERRED_APP_CHANNELS: NotifyChannel[] = ['dingtalk', 'wecom'];

function disableDeferredAppModes(config: NotificationConfig): NotificationConfig {
  const channels = { ...config.channels };
  for (const channel of DEFERRED_APP_CHANNELS) {
    channels[channel] = {
      ...channels[channel],
      app: { ...channels[channel].app, enabled: false },
    };
  }
  return { ...config, channels };
}

const CHANNEL_INFO: Record<
  NotifyChannel,
  {
    icon: string;
    title: string;
    subtitle: string;
    guideUrl: string;
    guideText: string;
    credentialsDesc: string;
  }
> = {
  dingtalk: {
    icon: '钉',
    title: 'DingTalk',
    subtitle: '群机器人 Webhook 推送（应用模式后期开发）。',
    guideUrl: 'https://open.dingtalk.com/document/robots/custom-robot-access',
    guideText: '打开钉钉设置指南',
    credentialsDesc:
      '在群聊中添加自定义机器人，复制 Webhook 地址；若启用加签，填写 SEC 密钥后点「测试连通性」验证。',
  },
  feishu: {
    icon: '飞',
    title: 'Feishu / Lark',
    subtitle: '群机器人 Webhook 推送，或企业应用凭据 + 投递会话（参考 Hermes FEISHU_HOME_CHANNEL）。',
    guideUrl: 'https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot',
    guideText: '打开飞书设置指南',
    credentialsDesc:
      'WorkBuddy 风格：填写 App ID/Secret 后测试连通性。群通知优先用 Webhook；应用模式填写 oc_ 开头的会话 ID（群聊或单聊均可）。',
  },
  wecom: {
    icon: '企',
    title: 'WeCom',
    subtitle: '群机器人 Webhook 推送（应用模式后期开发）。',
    guideUrl: 'https://developer.work.weixin.qq.com/document/path/91770',
    guideText: '打开企业微信设置指南',
    credentialsDesc:
      '在群聊中添加自定义机器人，从 Webhook URL 中复制 key 参数，点「测试连通性」验证。',
  },
};

function FieldRow({
  name,
  label,
  hint,
  password = false,
  placeholder,
  disabled,
}: {
  name: (string | number)[];
  label: string;
  hint: string;
  password?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="field-row">
      <div className="field-label-wrap">
        <p className="field-label">{label}</p>
        <p className="field-hint">{hint}</p>
      </div>
      <div className="field-input-wrap">
        <Form.Item name={name} style={{ marginBottom: 0 }}>
          {password ? (
            <Input.Password
              placeholder={placeholder ?? label}
              disabled={disabled}
              visibilityToggle
              autoComplete="new-password"
            />
          ) : (
            <Input placeholder={placeholder ?? label} disabled={disabled} allowClear />
          )}
        </Form.Item>
      </div>
    </div>
  );
}

function ConfigSection({
  title,
  enabledName,
  disabled,
  children,
}: {
  title: string;
  enabledName: (string | number)[];
  disabled?: boolean;
  children: ReactNode;
}) {
  const enabled = Form.useWatch(enabledName);

  return (
    <section className="config-section">
      <div className="config-section-head">
        <h4 className="config-section-title">{title}</h4>
        <Form.Item name={enabledName} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Switch size="small" disabled={disabled} />
        </Form.Item>
      </div>
      {enabled ? (
        children
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          开启后可填写下方凭据
        </Text>
      )}
    </section>
  );
}

function ChannelHeader({
  channel,
  settings,
  connectivity,
  onTestConnectivity,
  testDisabled,
}: {
  channel: NotifyChannel;
  settings: NotificationConfig;
  connectivity: ChannelConnectivityState;
  onTestConnectivity: () => void;
  testDisabled?: boolean;
}) {
  const info = CHANNEL_INFO[channel];
  const active = isChannelActive(channel, settings);
  const configured = isChannelConfigured(channel, settings);
  const testing = connectivity.status === 'testing';

  return (
    <header className="channel-header">
      <div className="channel-header-actions">
        <div className="channel-title-row" style={{ marginBottom: 0 }}>
          <span className="channel-icon">{info.icon}</span>
          <h3 className="channel-title">{info.title}</h3>
        </div>
        <Button
          size="small"
          icon={<ApiOutlined />}
          loading={testing}
          disabled={testDisabled || testing}
          onClick={onTestConnectivity}
        >
          测试连通性
        </Button>
      </div>
      <p className="channel-subtitle">{info.subtitle}</p>
      <div className="channel-badges">
        <span className={`channel-badge ${active ? 'active' : ''}`}>
          <span className="dot" />
          {active ? '已启用' : '已禁用'}
        </span>
        <span className={`channel-badge ${configured ? 'ready' : active ? 'pending' : ''}`}>
          {configured ? '凭据已设置' : '需要设置'}
        </span>
        <span className={`channel-badge connectivity-${connectivity.status}`}>
          {connectivity.status !== 'idle' ? <span className="dot" /> : null}
          连通：{connectivityStatusLabel(connectivity.status)}
        </span>
      </div>
      <div className="channel-connectivity">
        {connectivity.message ? (
          <p
            className="channel-connectivity-message"
            style={{ margin: 0, color: connectivity.status === 'error' ? '#dc2626' : undefined }}
          >
            {connectivity.message}
          </p>
        ) : (
          <p className="channel-connectivity-message" style={{ margin: 0 }}>
            点击「测试连通性」将通过服务端发送测试消息或校验应用凭据。
          </p>
        )}
        {connectivity.details.length > 0 ? (
          <ul className="channel-connectivity-details">
            {connectivity.details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {connectivity.testedAt ? (
          <Text type="secondary" style={{ fontSize: 11 }}>
            上次测试 {connectivity.testedAt}
          </Text>
        ) : null}
      </div>
    </header>
  );
}

const DELIVERY_KIND_LABEL: Record<string, string> = {
  group: '群',
};

const DELIVERY_HINTS = {
  dingtalk: {
    userLabel: 'User ID（高级）',
    userPlaceholder: 'userId',
    userHint: '工作通知私信时使用；可在钉钉管理后台成员详情查看。',
  },
  wecom: {
    userLabel: 'User ID（高级）',
    userPlaceholder: 'UserId',
    userHint: '应用消息私信时使用；在企业微信管理后台查看成员 User ID。',
  },
} as const;

function DeliveryTargetPanel({
  channel,
  disabled,
  form,
  chatIdsName,
  userIdName,
}: {
  channel: 'feishu' | 'dingtalk' | 'wecom';
  disabled: boolean;
  form: FormInstance<FormValues>;
  chatIdsName: (string | number)[];
  userIdName: (string | number)[];
}) {
  const hints = DELIVERY_HINTS[channel];
  const [loading, setLoading] = useState(false);
  const [chatOptions, setChatOptions] = useState<
    Array<{ id: string; name: string; kind: string }>
  >([]);
  const [loadMessage, setLoadMessage] = useState('');

  const credentialKey = Form.useWatch([], form);

  const loadChats = useCallback(async () => {
    if (disabled) return;
    setLoading(true);
    setLoadMessage('');
    try {
      const config = mergeNotificationConfig(form.getFieldsValue(true));
      const result = await api.listDeliveryTargets(channel, config);
      setChatOptions(result.chats);
      setLoadMessage(result.message);
    } catch (err) {
      setChatOptions([]);
      setLoadMessage(err instanceof Error ? err.message : '拉取会话列表失败');
    } finally {
      setLoading(false);
    }
  }, [channel, disabled, form]);

  useEffect(() => {
    void loadChats();
  }, [loadChats, credentialKey]);

  return (
    <div className="delivery-target-panel">
      <div className="delivery-target-head">
        <p className="field-group-label" style={{ marginBottom: 0 }}>
          投递会话（可多选）
        </p>
        <Button size="small" loading={loading} disabled={disabled} onClick={loadChats}>
          刷新列表
        </Button>
      </div>
      {loadMessage ? (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          {loadMessage}
        </Text>
      ) : null}
      <Form.Item
        name={chatIdsName}
        style={{ marginBottom: 12 }}
        rules={[
          {
            validator: async (_, value) => {
              const ids = Array.isArray(value) ? value.filter(Boolean) : [];
              const userId = trim(form.getFieldValue(userIdName));
              if (ids.length > 0 || userId) return;
              throw new Error('请至少选择一个投递会话，或填写高级私信 ID');
            },
          },
        ]}
      >
        <Select
          mode="multiple"
          allowClear
          disabled={disabled}
          loading={loading}
          placeholder={loading ? '正在拉取会话…' : '选择要接收通知的群聊'}
          options={chatOptions.map((chat) => {
            const kind = DELIVERY_KIND_LABEL[chat.kind] ?? '';
            return {
              value: chat.id,
              label: kind
                ? `[${kind}] ${chat.name} (${chat.id.slice(0, 10)}…)`
                : `${chat.name} (${chat.id.slice(0, 10)}…)`,
            };
          })}
          optionFilterProp="label"
          style={{ width: '100%' }}
        />
      </Form.Item>
      <p className="field-group-label">高级 · 私信用户</p>
      <FieldRow
        name={userIdName}
        label={hints.userLabel}
        hint={hints.userHint}
        placeholder={hints.userPlaceholder}
        disabled={disabled}
      />
    </div>
  );
}

const DEFAULT_FEISHU_GROUP_NAME = '华尔街之狼';
const FEISHU_MOBILE_LOOKUP_SCOPE = 'contact:user.id:readonly';
const FEISHU_CHAT_CREATE_SCOPE = 'im:chat:create';

function feishuPermissionUrl(appId: string, scope: string) {
  const id = trim(appId);
  if (!id) return 'https://open.feishu.cn/app';
  return `https://open.feishu.cn/app/${id}/auth?q=${encodeURIComponent(scope)}&op_from=openapi&token_type=tenant`;
}

function FeishuDeliveryTargetPanel({
  disabled,
  form,
}: {
  disabled: boolean;
  form: FormInstance<FormValues>;
}) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mobileInput, setMobileInput] = useState('');
  const [groupNameInput, setGroupNameInput] = useState(DEFAULT_FEISHU_GROUP_NAME);
  const [chatOptions, setChatOptions] = useState<
    Array<{ id: string; name: string; kind: string }>
  >([]);
  const [loadMessage, setLoadMessage] = useState('');

  const credentialKey = Form.useWatch([], form);
  const appId = trim(Form.useWatch(['channels', 'feishu', 'app', 'appId'], form));
  const chatIdsName = ['channels', 'feishu', 'app', 'receiveChatIds'] as const;

  const openCreateModal = () => {
    setMobileInput('');
    setGroupNameInput(DEFAULT_FEISHU_GROUP_NAME);
    setCreateModalOpen(true);
  };

  const loadChats = useCallback(
    async (options?: { hint?: string; delayMs?: number }) => {
      if (disabled) return;
      if (options?.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      setLoading(true);
      if (options?.hint) {
        setLoadMessage(options.hint);
      } else {
        setLoadMessage('');
      }
      try {
        const config = mergeNotificationConfig(form.getFieldsValue(true));
        const result = await api.listDeliveryTargets('feishu', config);
        setChatOptions(result.chats);
        setLoadMessage(result.message);
      } catch (err) {
        setChatOptions([]);
        setLoadMessage(err instanceof Error ? err.message : '拉取会话列表失败');
      } finally {
        setLoading(false);
      }
    },
    [disabled, form],
  );

  const upsertChatOption = useCallback(
    (chat: { id: string; name: string; kind?: string }) => {
      setChatOptions((prev) => {
        const index = prev.findIndex((item) => item.id === chat.id);
        const nextItem = {
          id: chat.id,
          name: chat.name,
          kind: chat.kind ?? 'group',
        };
        if (index >= 0) {
          return prev.map((item, idx) => (idx === index ? nextItem : item));
        }
        return [nextItem, ...prev];
      });
    },
    [],
  );

  useEffect(() => {
    void loadChats();
  }, [loadChats, credentialKey]);

  const handleCreateGroup = async () => {
    const mobile = trim(mobileInput).replace(/\s+/g, '');
    const groupName = trim(groupNameInput) || DEFAULT_FEISHU_GROUP_NAME;
    if (!mobile) {
      message.warning('请填写手机号');
      return;
    }
    if (!/^1\d{10}$/.test(mobile)) {
      message.warning('请输入 11 位中国大陆手机号');
      return;
    }
    const currentAppId = trim(form.getFieldValue(['channels', 'feishu', 'app', 'appId']));
    const appSecret = trim(form.getFieldValue(['channels', 'feishu', 'app', 'appSecret']));
    if (!currentAppId || !appSecret) {
      message.warning('请先填写 App ID 与 App Secret');
      return;
    }

    setCreating(true);
    try {
      const config = mergeNotificationConfig(form.getFieldsValue(true));
      const result = await api.createFeishuNotificationGroup(config, { mobile, groupName });
      const currentIds: string[] = form.getFieldValue(chatIdsName) ?? [];
      const nextIds = currentIds.includes(result.chatId)
        ? currentIds
        : [...currentIds, result.chatId];
      form.setFieldValue(chatIdsName, nextIds);
      upsertChatOption({ id: result.chatId, name: result.chatName, kind: 'group' });
      setCreateModalOpen(false);
      setMobileInput('');
      setGroupNameInput(DEFAULT_FEISHU_GROUP_NAME);
      message.success(
        result.reused
          ? `${result.message}：${result.chatName}，正在刷新列表…`
          : `已创建「${result.chatName}」并加入投递列表，正在刷新列表…`,
      );
      await loadChats({ hint: '创建成功，正在刷新群列表…', delayMs: 600 });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建通知群失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="delivery-target-panel">
      <div className="delivery-target-head">
        <p className="field-group-label" style={{ marginBottom: 0 }}>
          投递会话（可多选）
        </p>
        <div className="delivery-target-actions">
          <Button size="small" disabled={disabled} onClick={openCreateModal}>
            创建专属通知群
          </Button>
          <Button
            size="small"
            loading={loading}
            disabled={disabled}
            onClick={() => void loadChats()}
          >
            刷新列表
          </Button>
        </div>
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        飞书无法列出单聊会话。填写手机号可一键创建「你 + 机器人」的两人通知群，创建成功后会自动刷新下方列表。
      </Text>
      {loadMessage ? (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          {loadMessage}
        </Text>
      ) : null}
      <Form.Item
        name={chatIdsName}
        style={{ marginBottom: 0 }}
        rules={[
          {
            validator: async (_, value) => {
              const ids = Array.isArray(value) ? value.filter(Boolean) : [];
              if (ids.length > 0) return;
              throw new Error('请至少选择一个投递会话，或点击「创建专属通知群」');
            },
          },
        ]}
      >
        <Select
          mode="multiple"
          allowClear
          disabled={disabled}
          loading={loading}
          placeholder={loading ? '正在拉取会话…' : '选择要接收通知的群聊'}
          options={chatOptions.map((chat) => {
            const kind = DELIVERY_KIND_LABEL[chat.kind] ?? '';
            return {
              value: chat.id,
              label: kind
                ? `[${kind}] ${chat.name} (${chat.id.slice(0, 10)}…)`
                : `${chat.name} (${chat.id.slice(0, 10)}…)`,
            };
          })}
          optionFilterProp="label"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Modal
        title="创建专属通知群"
        open={createModalOpen}
        onCancel={() => {
          if (!creating) setCreateModalOpen(false);
        }}
        onOk={() => void handleCreateGroup()}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="创建前请确认应用已开通以下权限并发布"
          description={
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
              <li>
                通过手机号或邮箱获取用户 ID（{FEISHU_MOBILE_LOOKUP_SCOPE}）
                {appId ? (
                  <>
                    {' '}
                    <Link href={feishuPermissionUrl(appId, FEISHU_MOBILE_LOOKUP_SCOPE)} target="_blank">
                      去开通
                    </Link>
                  </>
                ) : (
                  '（请先填写 App ID）'
                )}
              </li>
              <li>
                创建群（{FEISHU_CHAT_CREATE_SCOPE}）
                {appId ? (
                  <>
                    {' '}
                    <Link href={feishuPermissionUrl(appId, FEISHU_CHAT_CREATE_SCOPE)} target="_blank">
                      去开通
                    </Link>
                  </>
                ) : (
                  '（请先填写 App ID）'
                )}
              </li>
              <li>你的手机号需已在企业通讯录登记，且应用在通讯录权限范围内</li>
            </ul>
          }
        />
        <label className="field-group-label" htmlFor="feishu-create-mobile">
          你的手机号
        </label>
        <Input
          id="feishu-create-mobile"
          value={mobileInput}
          onChange={(event) => setMobileInput(event.target.value)}
          placeholder="132xxxxxxxx"
          disabled={creating}
          style={{ marginBottom: 12 }}
        />
        <label className="field-group-label" htmlFor="feishu-create-group-name">
          群名称
        </label>
        <Input
          id="feishu-create-group-name"
          value={groupNameInput}
          onChange={(event) => setGroupNameInput(event.target.value)}
          placeholder={DEFAULT_FEISHU_GROUP_NAME}
          disabled={creating}
          maxLength={60}
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          将用该手机号查询你的飞书身份并建群，手机号不会保存到配置。
        </Text>
      </Modal>
    </div>
  );
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function CredentialsHelp({ channel }: { channel: NotifyChannel }) {
  const info = CHANNEL_INFO[channel];
  return (
    <div className="credentials-block">
      <p className="credentials-title">获取你的凭据</p>
      <p className="credentials-desc">{info.credentialsDesc}</p>
      <Link href={info.guideUrl} target="_blank" style={{ fontSize: 13 }}>
        {info.guideText} <LinkOutlined />
      </Link>
    </div>
  );
}

function DingTalkFields({ disabled }: { disabled: boolean }) {
  return (
    <>
      <CredentialsHelp channel="dingtalk" />
      <ConfigSection
        title="群机器人（Webhook）"
        enabledName={['channels', 'dingtalk', 'webhook', 'enabled']}
        disabled={disabled}
      >
        <p className="field-group-label">必填</p>
        <FieldRow
          name={['channels', 'dingtalk', 'webhook', 'url']}
          label="Webhook 地址"
          hint="钉钉自定义机器人 Webhook URL"
          placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
          disabled={disabled}
        />
        <p className="field-group-label">推荐</p>
        <FieldRow
          name={['channels', 'dingtalk', 'webhook', 'signingSecret']}
          label="加签密钥"
          hint="安全设置启用加签时填写 SEC 密钥"
          password
          disabled={disabled}
        />
      </ConfigSection>
      {/* 钉钉应用模式后期开发
      <ConfigSection
        title="应用（App）"
        enabledName={['channels', 'dingtalk', 'app', 'enabled']}
        disabled={disabled}
      >
        ...
      </ConfigSection>
      */}
    </>
  );
}

function FeishuFields({
  disabled,
  form,
}: {
  disabled: boolean;
  form: FormInstance<FormValues>;
}) {
  return (
    <>
      <CredentialsHelp channel="feishu" />
      <ConfigSection
        title="群机器人（Webhook）"
        enabledName={['channels', 'feishu', 'webhook', 'enabled']}
        disabled={disabled}
      >
        <p className="field-group-label">必填</p>
        <FieldRow
          name={['channels', 'feishu', 'webhook', 'url']}
          label="Webhook 地址"
          hint="飞书自定义机器人 Webhook URL"
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          disabled={disabled}
        />
        <p className="field-group-label">推荐</p>
        <FieldRow
          name={['channels', 'feishu', 'webhook', 'signingSecret']}
          label="签名校验密钥"
          hint="启用签名校验时填写"
          password
          disabled={disabled}
        />
      </ConfigSection>
      <ConfigSection
        title="应用（App）"
        enabledName={['channels', 'feishu', 'app', 'enabled']}
        disabled={disabled}
      >
        <p className="field-group-label">必填</p>
        <FieldRow
          name={['channels', 'feishu', 'app', 'appId']}
          label="App ID"
          hint="飞书 / Lark 应用 ID"
          disabled={disabled}
        />
        <FieldRow
          name={['channels', 'feishu', 'app', 'appSecret']}
          label="App Secret"
          hint="飞书 / Lark 应用密钥"
          password
          disabled={disabled}
        />
        <FeishuDeliveryTargetPanel disabled={disabled} form={form} />
        <p className="field-group-label">推荐</p>
        <FieldRow
          name={['channels', 'feishu', 'app', 'encryptKey']}
          label="Encrypt Key"
          hint="事件订阅加密密钥"
          password
          disabled={disabled}
        />
        <FieldRow
          name={['channels', 'feishu', 'app', 'verificationToken']}
          label="Verification Token"
          hint="事件订阅校验 Token"
          password
          disabled={disabled}
        />
      </ConfigSection>
    </>
  );
}

function WecomFields({ disabled }: { disabled: boolean }) {
  return (
    <>
      <CredentialsHelp channel="wecom" />
      <ConfigSection
        title="群机器人（Webhook）"
        enabledName={['channels', 'wecom', 'webhook', 'enabled']}
        disabled={disabled}
      >
        <p className="field-group-label">必填</p>
        <FieldRow
          name={['channels', 'wecom', 'webhook', 'webhookKey']}
          label="Webhook Key"
          hint="企业微信群机器人 Webhook URL 中的 key 参数"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          disabled={disabled}
        />
        <p className="field-group-label">推荐</p>
        <FieldRow
          name={['channels', 'wecom', 'webhook', 'remark']}
          label="备注"
          hint="可选，填写群名或用途便于识别"
          disabled={disabled}
        />
      </ConfigSection>
      {/* 企业微信应用模式后期开发
      <ConfigSection
        title="应用（App）"
        enabledName={['channels', 'wecom', 'app', 'enabled']}
        disabled={disabled}
      >
        ...
      </ConfigSection>
      */}
    </>
  );
}

const NOTIFY_CHANNELS: NotifyChannel[] = ['dingtalk', 'feishu', 'wecom'];

function ChannelPanel({
  channel,
  masterEnabled,
  form,
  connectivity,
  onTestConnectivity,
}: {
  channel: NotifyChannel;
  masterEnabled: boolean;
  form: FormInstance<FormValues>;
  connectivity: ChannelConnectivityState;
  onTestConnectivity: (channel: NotifyChannel) => void;
}) {
  const watched = Form.useWatch([], form);
  const settings = mergeNotificationConfig(watched ?? form.getFieldsValue(true));
  const disabled = !masterEnabled;

  return (
    <div>
      <ChannelHeader
        channel={channel}
        settings={settings}
        connectivity={connectivity}
        testDisabled={disabled}
        onTestConnectivity={() => onTestConnectivity(channel)}
      />
      {channel === 'dingtalk' ? (
        <DingTalkFields disabled={disabled} />
      ) : channel === 'feishu' ? (
        <FeishuFields disabled={disabled} form={form} />
      ) : (
        <WecomFields disabled={disabled} />
      )}
    </div>
  );
}

function TriggerPanel({ masterEnabled }: { masterEnabled: boolean }) {
  return (
    <div>
      <header className="channel-header">
        <div className="channel-title-row">
          <span className="channel-icon">触</span>
          <h3 className="channel-title">触发配置</h3>
        </div>
        <p className="channel-subtitle">控制通知发送的时机与频率，避免非交易时段打扰。</p>
      </header>

      <div className="trigger-row">
        <div className="trigger-label">
          <p className="field-label">推送频次</p>
          <p className="field-hint">选择自动推送的时间间隔；选手动则仅在点击刷新后推送</p>
        </div>
        <div className="trigger-control">
          <Form.Item name={['trigger', 'frequency']} style={{ marginBottom: 0 }}>
            <Select
              options={NOTIFY_FREQUENCY_OPTIONS}
              disabled={!masterEnabled}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </div>
      </div>

      <div className="trigger-row">
        <div className="trigger-label">
          <p className="field-label">仅交易时段</p>
          <p className="field-hint">开启后，非 A 股交易时段（9:30–11:30、13:00–15:00）不发送通知</p>
        </div>
        <div className="trigger-control">
          <Form.Item
            name={['trigger', 'tradingHoursOnly']}
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch disabled={!masterEnabled} />
          </Form.Item>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 16 }}
        message="推送说明"
        description="选手动模式时，仅在点击刷新后推送；选择定时频率（含每 1 分钟）后，Dashboard 打开期间将按间隔自动推送。钉钉 / 企业微信暂仅支持群机器人 Webhook；飞书支持 Webhook 与应用模式。"
      />
    </div>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelKey>('trigger');
  const [connectivityMap, setConnectivityMap] = useState(createInitialConnectivityMap);
  const masterEnabled = Form.useWatch('enabled', form);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const load = async () => {
      const local = loadNotificationSettings();
      try {
        const remote = await api.getNotificationConfig();
        if (!cancelled) {
          const merged = disableDeferredAppModes(
            remote.config
              ? mergeNotificationConfig({ ...local, ...remote.config })
              : local,
          );
          form.setFieldsValue(merged);
        }
      } catch {
        if (!cancelled) form.setFieldsValue(disableDeferredAppModes(local));
      }
      if (!cancelled) {
        setActivePanel('trigger');
        setConnectivityMap(createInitialConnectivityMap());
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, form]);

  const handleTestConnectivity = useCallback(
    async (channel: NotifyChannel) => {
      setConnectivityMap((prev) => ({
        ...prev,
        [channel]: {
          ...prev[channel],
          status: 'testing',
          message: '正在校验配置…',
          details: [],
        },
      }));

      const config = disableDeferredAppModes(mergeNotificationConfig(form.getFieldsValue(true)));
      const result = await runChannelConnectivityTest(channel, config);

      setConnectivityMap((prev) => ({
        ...prev,
        [channel]: {
          status: result.status,
          message: result.message,
          details: result.details,
          testedAt: new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
      }));
    },
    [form],
  );

  const handleSave = async () => {
    const settings = disableDeferredAppModes(
      sanitizeNotificationConfig(form.getFieldsValue(true)),
    );
    const err = validateNotificationSettings(settings);
    if (err) {
      message.warning(err);
      return;
    }
    setSaving(true);
    try {
      saveNotificationSettings(settings);
      await api.saveNotificationConfig(settings);
      message.success('通知配置已保存（本地 + 服务端）');
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存到服务端失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="通知设置"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={720}
      destroyOnClose
      className="settings-modal"
      styles={{ body: { paddingTop: 4 } }}
    >
      <Form
        form={form}
        layout="vertical"
        preserve
        initialValues={createDefaultNotificationConfig()}
      >
        <Form.Item name="version" hidden>
          <Input />
        </Form.Item>
        <div className="settings-master">
          <div>
            <Text strong>启用消息通知</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                支持钉钉、飞书、企业微信群机器人；飞书另支持应用模式
              </Text>
            </div>
          </div>
          <Form.Item name="enabled" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`settings-nav-item${activePanel === item.key ? ' active' : ''}`}
                onClick={() => setActivePanel(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="settings-panel">
            <div
              className={`settings-panel-section${activePanel === 'trigger' ? ' active' : ''}`}
            >
              <TriggerPanel masterEnabled={Boolean(masterEnabled)} />
            </div>
            {NOTIFY_CHANNELS.map((channel) => (
              <div
                key={channel}
                className={`settings-panel-section${activePanel === channel ? ' active' : ''}`}
              >
                <ChannelPanel
                  channel={channel}
                  masterEnabled={Boolean(masterEnabled)}
                  form={form}
                  connectivity={connectivityMap[channel]}
                  onTestConnectivity={handleTestConnectivity}
                />
              </div>
            ))}
          </div>
        </div>
      </Form>
    </Modal>
  );
}
