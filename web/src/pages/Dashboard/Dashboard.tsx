import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Col,
  Flex,
  Layout,
  Row,
  Spin,
  Typography,
} from "antd";
import { AppHeader } from "@/components/AppHeader/AppHeader";
import { YjbBindPanel } from "@/components/YjbBindPanel/YjbBindPanel";
import { HoldingsPanel } from "@/components/HoldingsPanel/HoldingsPanel";
import { IndexBar } from "@/components/IndexBar/IndexBar";
import { SummaryCard } from "@/components/SummaryCard/SummaryCard";
import { api } from "@/api/client";
import { useNotificationSchedule } from "@/hooks/useNotificationSchedule";
import { usePortfolio } from "@/hooks/usePortfolio";
import type { AuthStatus } from "@/types/auth";
import { tryPushAfterRefresh } from "@/utils/notificationPush";
import { PAGE_CONTENT_STYLE } from "@/utils/pageLayout";

const { Content } = Layout;
const { Text } = Typography;

export function Dashboard() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [yjbBound, setYjbBound] = useState(false);

  const handleAppAuthRequired = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  const handleYjbRequired = useCallback(() => {
    setYjbBound(false);
  }, []);

  const { portfolio, loading, refreshing, error, refresh } = usePortfolio({
    enabled: yjbBound,
    onAppAuthRequired: handleAppAuthRequired,
    onYjbRequired: handleYjbRequired,
  });
  useNotificationSchedule();

  const loadAuthStatus = useCallback(async () => {
    setAuthLoading(true);
    try {
      const status = await api.getAuthStatus();
      setAuthStatus(status);
      setYjbBound(Boolean(status.yjb_bound));
    } catch {
      navigate("/login");
    } finally {
      setAuthLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadAuthStatus();
  }, [loadAuthStatus]);

  const handleRefresh = useCallback(async () => {
    const snapshot = await refresh();
    if (!snapshot) return;

    message.success("刷新成功");

    const pushResult = await tryPushAfterRefresh({
      trading: snapshot.trading,
    });
    if (pushResult?.status === "success") {
      message.success(`通知已推送：${pushResult.message}`);
    } else if (pushResult?.status === "partial") {
      message.warning(`通知部分推送：${pushResult.message}`);
    } else if (pushResult?.status === "error") {
      message.warning(`通知推送失败：${pushResult.message}`);
    }
  }, [message, refresh]);

  const handleYjbBound = useCallback(async () => {
    const status = await api.getAuthStatus();
    setAuthStatus(status);
    setYjbBound(true);
    await refresh();
  }, [refresh]);

  const headerExtra =
    yjbBound ? (
      <Button icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefresh}>
        刷新持仓
      </Button>
    ) : null;

  if (authLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" tip="正在加载..." />
      </Flex>
    );
  }

  const updatedLabel = portfolio?.updated_at
    ? portfolio.updated_at.replace("T", " ")
    : "";

  if (!yjbBound) {
    return (
      <Layout style={{ minHeight: "100vh", background: "#f5f7fb" }}>
        <AppHeader />
        <YjbBindPanel onBound={() => void handleYjbBound()} />
      </Layout>
    );
  }

  if (loading && !portfolio) {
    return (
      <Layout style={{ minHeight: "100vh", background: "#f5f7fb" }}>
        <AppHeader extra={headerExtra} />
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 400 }}>
          <Spin size="large" tip={error ? `加载失败：${error}` : "正在加载数据..."} />
        </Flex>
      </Layout>
    );
  }

  if (!portfolio) {
    return (
      <Layout style={{ minHeight: "100vh", background: "#f5f7fb" }}>
        <AppHeader extra={headerExtra} />
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 400 }}>
          <Alert
            type="error"
            message={error || "加载失败"}
            action={
              <Button size="small" onClick={handleRefresh}>
                重试
              </Button>
            }
          />
        </Flex>
      </Layout>
    );
  }

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        position: "relative",
      }}
    >
      {refreshing ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.72)",
            backdropFilter: "blur(2px)",
          }}
        >
          <Spin size="large" tip="正在刷新数据..." />
        </div>
      ) : null}
      <AppHeader extra={headerExtra} />

      <Content
        style={{
          ...PAGE_CONTENT_STYLE,
          padding: "24px 32px 48px",
        }}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
          {portfolio.user?.nickname || authStatus?.yjb_nickname || authStatus?.username}
          {portfolio.trading ? " · 交易时段" : " · 非交易时段"}
          {updatedLabel ? ` · 更新 ${updatedLabel}` : ""}
        </Text>

        {error ? (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
        ) : null}

        <IndexBar indices={portfolio.indices} />

        <Row gutter={[16, 16]} style={{ margin: "20px 0" }}>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard label="总资产" value={portfolio.total_assets} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="当日总收益"
              value={portfolio.today_income}
              sub={formatSubRate(portfolio.today_income_rate)}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="上涨 / 下跌"
              value={portfolio.rise_count - portfolio.fall_count}
              sub={`${portfolio.rise_count} 涨 / ${portfolio.fall_count} 跌`}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="账户数"
              value={portfolio.accounts.length}
              sub={portfolio.accounts.map((a) => a.title).join("、")}
            />
          </Col>
        </Row>

        <HoldingsPanel
          accounts={portfolio.accounts}
          updatedAt={portfolio.updated_at}
          onYjbRequired={handleYjbRequired}
          onAppAuthRequired={handleAppAuthRequired}
          onRefresh={handleRefresh}
        />
      </Content>
    </Layout>
  );
}

function formatSubRate(rate: number) {
  const sign = rate > 0 ? "+" : rate < 0 ? "-" : "";
  return `收益率 ${sign}${Math.abs(rate).toFixed(2)}%`;
}
