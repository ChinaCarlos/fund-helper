import type {
  AuthStatus,
  CommandErrorPayload,
  DeliveryTargetsResponse,
  FeishuCreateGroupResponse,
  IncomeLineData,
  PortfolioSnapshot,
  PushResponse,
  QrCreateResult,
  QrStateResult,
} from "@/types/portfolio";
import type { ConnectivityTestResult } from '@/utils/notificationConnectivity';
import type { NotifyChannel } from "@/utils/notificationSettings";

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeCached: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (invokeCached) return invokeCached;
  const { invoke } = await import("@tauri-apps/api/core");
  invokeCached = invoke as InvokeFn;
  return invokeCached;
}

function parseInvokeError(error: unknown): CommandErrorPayload {
  if (typeof error === "string") {
    return { message: error, status_code: 500 };
  }
  if (error && typeof error === "object" && "message" in error) {
    const payload = error as CommandErrorPayload;
    return {
      message: payload.message ?? "请求失败",
      status_code: payload.status_code ?? 500,
    };
  }
  return { message: "请求失败", status_code: 500 };
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { isTauriRuntime } = await import("@/lib/tauri");
  if (!isTauriRuntime()) {
    throw {
      message: "当前不在 Tauri 桌面环境中，请使用 pnpm tauri:dev 启动",
      status_code: 503,
    } satisfies CommandErrorPayload;
  }
  const invoke = await getInvoke();
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw parseInvokeError(error);
  }
}

export const api = {
  createQr: () => call<QrCreateResult>("create_qr"),
  pollQrState: (qrId: string) => call<QrStateResult>("poll_qr_state", { qrId }),
  completeQrLogin: (payload: {
    token: string;
    nickname: string;
    avatar: string;
  }) =>
    call<AuthStatus>("complete_qr_login", {
      token: payload.token,
      nickname: payload.nickname,
      avatar: payload.avatar,
    }),
  getAuthStatus: () => call<AuthStatus>("get_auth_status"),
  logout: () => call<void>("logout"),
  fetchPortfolio: () => call<PortfolioSnapshot>("fetch_portfolio"),
  getNotificationConfig: () => call<string>("get_notification_config"),
  saveNotificationConfig: (configJson: string) =>
    call<void>("save_notification_config", { configJson }),
  pushNotificationNow: () => call<PushResponse>("push_notification_now"),
  pushNotificationIfManual: () =>
    call<PushResponse | null>("push_notification_if_manual"),
  testNotificationChannel: (channel: NotifyChannel, configJson: string) =>
    call<ConnectivityTestResult>("test_notification_channel", {
      channel,
      configJson,
    }),
  listDeliveryTargets: (channel: NotifyChannel, configJson: string) =>
    call<DeliveryTargetsResponse>("list_delivery_targets", {
      channel,
      configJson,
    }),
  createFeishuNotificationGroup: (
    configJson: string,
    payload: { mobile: string; groupName: string },
  ) =>
    call<FeishuCreateGroupResponse>("create_feishu_notification_group_cmd", {
      configJson,
      mobile: payload.mobile,
      groupName: payload.groupName,
    }),
  getCollectIncomeLine: () => call<IncomeLineData>("get_collect_income_line"),
  getAccountIncomeLines: (accountIds: number[]) =>
    call<Record<string, IncomeLineData>>("get_account_income_lines", {
      accountIds,
    }),
};

export function isUnauthorized(error: unknown): boolean {
  const payload = parseInvokeError(error);
  return payload.status_code === 401;
}

export function warmupTauriApi(): void {
  void import("@/lib/tauri").then(({ isTauriRuntime }) => {
    if (!isTauriRuntime()) return;
    void getInvoke();
  });
}
