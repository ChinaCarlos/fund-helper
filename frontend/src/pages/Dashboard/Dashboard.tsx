import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogoutOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Avatar,
  Button,
  Col,
  Flex,
  Layout,
  Row,
  Spin,
  Typography,
} from "antd";
import { HoldingsPanel } from "@/components/HoldingsPanel/HoldingsPanel";
import { IndexBar } from "@/components/IndexBar/IndexBar";
import { SettingsModal } from "@/components/SettingsModal/SettingsModal";
import { SummaryCard } from "@/components/SummaryCard/SummaryCard";
import { api } from "@/api/client";
import { usePortfolio } from "@/hooks/usePortfolio";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export function Dashboard() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [avatarError, setAvatarError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const handleAuthRequired = useCallback(() => {
    navigate("/login");
  }, [navigate]);
  const { portfolio, loading, refreshing, error, refresh } = usePortfolio({
    onAuthRequired: handleAuthRequired,
  });

  const handleRefresh = useCallback(async () => {
    const ok = await refresh();
    if (ok) {
      message.success("刷新成功");
    }
  }, [message, refresh]);

  useEffect(() => {
    setAvatarError(false);
  }, [portfolio?.user?.avatar]);

  const handleLogout = async () => {
    await api.logout();
    navigate("/login");
  };

  if (loading && !portfolio) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin
          size="large"
          tip={error ? `加载失败：${error}` : "正在加载数据..."}
        />
      </Flex>
    );
  }

  if (!portfolio) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
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
    );
  }

  const showAvatar = Boolean(portfolio.user?.avatar && !avatarError);
  const updatedLabel = portfolio.updated_at
    ? portfolio.updated_at.replace("T", " ")
    : "";

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
      <Header
        style={{
          background: "#fff",
          color: "#1e293b",
          borderBottom: "1px solid #eef1f6",
          padding: "12px 24px",
          height: "auto",
          lineHeight: "normal",
        }}
      >
        <Flex
          align="center"
          justify="space-between"
          gap={16}
          wrap="wrap"
          style={{ width: "100%" }}
        >
          <Flex
            align="center"
            gap={12}
            style={{ minWidth: 0, flex: "1 1 auto" }}
          >
            {showAvatar ? (
              <Avatar
                size={40}
                src="/api/auth/avatar"
                style={{ flexShrink: 0 }}
                onError={() => {
                  setAvatarError(true);
                  return false;
                }}
              />
            ) : (
              <Avatar
                size={40}
                style={{ background: "#fc4e50", flexShrink: 0 }}
              >
                {portfolio.user?.nickname?.charAt(0) || "基"}
              </Avatar>
            )}
            <div style={{ minWidth: 0 }}>
              <Title
                level={5}
                style={{ margin: 0, color: "#1e293b", lineHeight: 1.4 }}
              >
                养基宝实时监控
              </Title>
              <Text style={{ fontSize: 13, color: "#8b95a8", lineHeight: 1.4 }}>
                {portfolio.user?.nickname || "已登录"}
                {portfolio.trading ? " · 交易时段" : " · 非交易时段"}
                {updatedLabel ? ` · 更新 ${updatedLabel}` : ""}
              </Text>
            </div>
          </Flex>
          <Flex align="center" gap={12} style={{ flexShrink: 0 }}>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsOpen(true)}
            >
              设置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={handleRefresh}
            >
              刷新
            </Button>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
            </Button>
          </Flex>
        </Flex>
      </Header>

      <Content
        style={{
          maxWidth: 1200,
          width: "100%",
          margin: "0 auto",
          padding: "24px 20px 48px",
        }}
      >
        {error ? (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
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
          onAuthRequired={handleAuthRequired}
          onRefresh={handleRefresh}
        />
      </Content>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Layout>
  );
}

function formatSubRate(rate: number) {
  const sign = rate > 0 ? "+" : rate < 0 ? "-" : "";
  return `收益率 ${sign}${Math.abs(rate).toFixed(2)}%`;
}
