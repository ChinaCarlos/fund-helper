import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
    subtitle: '通过钉钉群机器人或企业应用发送持仓收益通知。',
    guideUrl: 'https://open.dingtalk.com/document/robots/custom-robot-access',
    guideText: '打开钉钉设置指南',
    credentialsDesc:
      '群机器人：在群设置中添加自定义机器人并复制 Webhook。应用：在开发者后台创建应用，复制 Client ID 与 Client Secret。',
  },
  feishu: {
    icon: '飞',
    title: 'Feishu / Lark',
    subtitle: '通过飞书群机器人或企业应用发送持仓收益通知。',
    guideUrl: 'https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot',
    guideText: '打开飞书设置指南',
    credentialsDesc:
      '群机器人：在群设置中添加自定义机器人并复制 Webhook。应用：创建飞书应用并配置机器人能力，复制 App ID 与 App Secret。',
  },
  wecom: {
    icon: '企',
    title: 'WeCom',
    subtitle: '通过企业微信群机器人（仅发送）或自建应用（双向）推送通知。',
    guideUrl: 'https://developer.work.weixin.qq.com/document/path/91770',
    guideText: '打开企业微信设置指南',
    credentialsDesc:
      '群机器人：在群聊中添加机器人，复制 Webhook URL 中的 key 参数。应用：创建自建应用并配置回调，填写 Corp ID、Secret 与 Agent ID。',
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
            点击「测试连通性」校验当前配置；真实推送连通性待服务端接入后验证。
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
      <ConfigSection
        title="应用（App）"
        enabledName={['channels', 'dingtalk', 'app', 'enabled']}
        disabled={disabled}
      >
        <p className="field-group-label">必填</p>
        <FieldRow
          name={['channels', 'dingtalk', 'app', 'clientId']}
          label="Client ID"
          hint="钉钉应用 AppKey / Client ID"
          disabled={disabled}
        />
        <FieldRow
          name={['channels', 'dingtalk', 'app', 'clientSecret']}
          label="Client Secret"
          hint="钉钉应用 AppSecret / Client Secret"
          password
          disabled={disabled}
        />
      </ConfigSection>
    </>
  );
}

function FeishuFields({ disabled }: { disabled: boolean }) {
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
      <ConfigSection
        title="应用（App）"
        enabledName={['channels', 'wecom', 'app', 'enabled']}
        disabled={disabled}
      >
        <p className="field-group-label">必填</p>
        <FieldRow
          name={['channels', 'wecom', 'app', 'corpId']}
          label="Corp ID"
          hint="企业微信企业 ID"
          disabled={disabled}
        />
        <FieldRow
          name={['channels', 'wecom', 'app', 'corpSecret']}
          label="Corp Secret"
          hint="自建应用 Secret"
          password
          disabled={disabled}
        />
        <FieldRow
          name={['channels', 'wecom', 'app', 'agentId']}
          label="Agent ID"
          hint="自建应用 AgentId"
          disabled={disabled}
        />
        <p className="field-group-label">推荐</p>
        <FieldRow
          name={['channels', 'wecom', 'app', 'callbackToken']}
          label="Callback Token"
          hint="回调 URL 校验 Token"
          password
          disabled={disabled}
        />
        <FieldRow
          name={['channels', 'wecom', 'app', 'callbackAesKey']}
          label="Callback AES Key"
          hint="回调消息加解密 EncodingAESKey"
          password
          disabled={disabled}
        />
      </ConfigSection>
    </>
  );
}

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
        <FeishuFields disabled={disabled} />
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
        message="推送发送功能即将上线"
        description="当前配置仅保存在浏览器本地。后续版本将通过后端安全转发消息，群机器人与应用模式均可使用。"
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
    if (open) {
      form.setFieldsValue(loadNotificationSettings());
      setActivePanel('trigger');
      setConnectivityMap(createInitialConnectivityMap());
    }
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

      const config = mergeNotificationConfig(form.getFieldsValue(true));
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
    try {
      const values = await form.validateFields();
      const settings = sanitizeNotificationConfig(values);
      const err = validateNotificationSettings(settings);
      if (err) {
        message.warning(err);
        return;
      }
      setSaving(true);
      saveNotificationSettings(settings);
      message.success('通知配置已保存到本地');
      onClose();
    } catch {
      // 表单校验失败
    } finally {
      setSaving(false);
    }
  };

  const panelContent = useMemo(() => {
    if (activePanel === 'trigger') {
      return <TriggerPanel masterEnabled={Boolean(masterEnabled)} />;
    }
    return (
      <ChannelPanel
        channel={activePanel}
        masterEnabled={Boolean(masterEnabled)}
        form={form}
        connectivity={connectivityMap[activePanel]}
        onTestConnectivity={handleTestConnectivity}
      />
    );
  }, [activePanel, masterEnabled, form, connectivityMap, handleTestConnectivity]);

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
      <Form form={form} layout="vertical" initialValues={createDefaultNotificationConfig()}>
        <div className="settings-master">
          <div>
            <Text strong>启用消息通知</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                支持钉钉、飞书、企业微信的群机器人与应用两种接入方式
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
          <div className="settings-panel">{panelContent}</div>
        </div>
      </Form>
    </Modal>
  );
}
