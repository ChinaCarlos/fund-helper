import { Card, Col, Row, Space, Tag, Typography } from "antd";
import {
  AccountIcon,
  FallIcon,
  RiseIcon,
} from "@/components/AccountIcon/AccountIcon";
import { IncomeSparkline } from "@/components/IncomeSparkline/IncomeSparkline";
import type { AccountItem, IncomeLinePoint } from "@/types/portfolio";
import {
  formatMoney,
  formatPercent,
  formatSigned,
  incomeAmountStyle,
  trendColor,
} from "@/utils/format";

const { Text, Title } = Typography;

interface AccountSummaryCardProps {
  account: AccountItem;
  updated?: boolean;
  linePoints?: IncomeLinePoint[];
  onClick?: () => void;
}

export function AccountSummaryCard({
  account,
  updated = true,
  linePoints,
  onClick,
}: AccountSummaryCardProps) {
  return (
    <Card
      hoverable={Boolean(onClick)}
      onClick={onClick}
      bordered={false}
      style={{ height: "100%", cursor: onClick ? "pointer" : "default" }}
    >
      <FlexHeader account={account} updated={updated} />

      <Text type="secondary" style={{ fontSize: 12 }}>
        账户资产
      </Text>
      <Title level={4} style={{ margin: "4px 0 16px" }}>
        {formatMoney(account.account_assets)}
      </Title>

      <Row gutter={16}>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            持有收益
          </Text>
          <div>
            <Text strong style={{ color: trendColor(account.hold_income) }}>
              {formatSigned(account.hold_income)}
            </Text>
          </div>
          <Text
            style={{
              color: trendColor(account.hold_income_rate),
              fontSize: 12,
            }}
          >
            {formatPercent(account.hold_income_rate)}
          </Text>
        </Col>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            当日收益
          </Text>
          <div>
            <span
              className="mono"
              style={incomeAmountStyle(account.today_income)}
            >
              {formatSigned(account.today_income)}
            </span>
          </div>
          <Text
            strong
            style={{
              color: trendColor(account.today_income_rate),
              fontSize: 13,
            }}
          >
            {formatPercent(account.today_income_rate)}
          </Text>
        </Col>
      </Row>

      {linePoints && linePoints.length > 1 ? (
        <div style={{ marginTop: 12 }}>
          <IncomeSparkline
            points={linePoints}
            todayIncome={account.today_income}
            todayIncomeRate={account.today_income_rate}
          />
        </div>
      ) : null}
    </Card>
  );
}

function FlexHeader({
  account,
  updated,
}: {
  account: AccountItem;
  updated: boolean;
}) {
  return (
    <Space
      style={{
        width: "100%",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <Space>
        <AccountIcon title={account.title} />
        <Text strong>{account.title}</Text>
        {updated ? <Tag color="processing">已更新</Tag> : null}
      </Space>
      <Space size={12}>
        <Space size={4}>
          <RiseIcon />
          <Text style={{ color: "#fc4e50" }}>{account.up}</Text>
        </Space>
        <Space size={4}>
          <FallIcon />
          <Text style={{ color: "#07b360" }}>{account.down}</Text>
        </Space>
      </Space>
    </Space>
  );
}
