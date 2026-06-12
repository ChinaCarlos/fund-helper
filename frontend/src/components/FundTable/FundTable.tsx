import { useCallback, useMemo, useState } from "react";
import { SettingOutlined } from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Divider,
  Flex,
  Modal,
  Popover,
  Table,
  Typography,
} from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import { api } from "@/api/client";
import type { FundItem } from "@/types/portfolio";
import {
  formatMoney,
  formatPercent,
  formatSigned,
  trendColor,
} from "@/utils/format";
import {
  DEFAULT_COLUMN_ORDER,
  DEFAULT_VISIBLE_COLUMNS,
  FUND_COLUMN_LABELS,
  type FundColumnKey,
  fundColumnSorter,
  loadVisibleColumns,
  saveVisibleColumns,
} from "@/utils/fundTableColumns";

const { Text } = Typography;

interface FundTableProps {
  funds: FundItem[];
  updatedAt?: string;
  onAuthRequired?: () => void;
  onRefresh?: () => void;
  embedded?: boolean;
}

export function FundTable({
  funds,
  updatedAt,
  onAuthRequired,
  onRefresh,
  embedded = false,
}: FundTableProps) {
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<FundItem | null>(null);
  const [error, setError] = useState("");
  const [visibleKeys, setVisibleKeys] =
    useState<FundColumnKey[]>(loadVisibleColumns);

  const handleVisibleChange = useCallback((checked: FundColumnKey[]) => {
    const ordered = DEFAULT_COLUMN_ORDER.filter((key) => checked.includes(key));
    setVisibleKeys(ordered.length > 0 ? ordered : ["day_earn"]);
    saveVisibleColumns(ordered.length > 0 ? ordered : ["day_earn"]);
  }, []);

  const handleResetColumns = useCallback(() => {
    setVisibleKeys(DEFAULT_VISIBLE_COLUMNS);
    saveVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
  }, []);

  const handleConfirmRemove = async () => {
    if (!confirming?.account_id) return;

    setRemovingId(confirming.fund_id);
    setError("");
    try {
      await api.removeFundHold(confirming.account_id, [confirming.fund_id]);
      setConfirming(null);
      onRefresh?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "删除失败";
      if (message.includes("未登录") || message.includes("401")) {
        onAuthRequired?.();
        return;
      }
      setError(message);
    } finally {
      setRemovingId(null);
    }
  };

  const dataColumnDefs = useMemo((): Record<
    FundColumnKey,
    ColumnType<FundItem>
  > => {
    return {
      hold_sum: {
        title: FUND_COLUMN_LABELS.hold_sum,
        key: "hold_sum",
        align: "right",
        width: 100,
        sorter: fundColumnSorter("hold_sum"),
        render: (_, fund) => (
          <Text className="mono">{formatMoney(fund.hold_sum)}</Text>
        ),
      },
      day_earn: {
        title: FUND_COLUMN_LABELS.day_earn,
        key: "day_earn",
        align: "right",
        width: 120,
        sorter: fundColumnSorter("day_earn"),
        defaultSortOrder: "descend",
        render: (_, fund) => (
          <div>
            <Text className="mono" style={{ color: trendColor(fund.day_earn) }}>
              {formatSigned(fund.day_earn)}
            </Text>
            <br />
            <Text
              className="mono"
              style={{ color: trendColor(fund.day_rate), fontSize: 12 }}
            >
              {formatPercent(fund.day_rate)}
            </Text>
          </div>
        ),
      },
      gzjz: {
        title: FUND_COLUMN_LABELS.gzjz,
        key: "gzjz",
        align: "right",
        width: 90,
        sorter: fundColumnSorter("gzjz"),
        render: (_, fund) => (
          <Text className="mono">
            {fund.nv_info?.gzjz ? formatMoney(fund.nv_info.gzjz, 4) : "-"}
          </Text>
        ),
      },
      dwjz: {
        title: FUND_COLUMN_LABELS.dwjz,
        key: "dwjz",
        align: "right",
        width: 90,
        sorter: fundColumnSorter("dwjz"),
        render: (_, fund) => (
          <Text className="mono">
            {fund.nv_info?.dwjz ? formatMoney(fund.nv_info.dwjz, 4) : "-"}
          </Text>
        ),
      },
      money: {
        title: FUND_COLUMN_LABELS.money,
        key: "money",
        align: "right",
        width: 100,
        sorter: fundColumnSorter("money"),
        render: (_, fund) => (
          <Text className="mono">{formatMoney(fund.money)}</Text>
        ),
      },
      hold_share: {
        title: FUND_COLUMN_LABELS.hold_share,
        key: "hold_share",
        align: "right",
        width: 100,
        sorter: fundColumnSorter("hold_share"),
        render: (_, fund) => (
          <Text className="mono">{formatMoney(fund.hold_share, 4)}</Text>
        ),
      },
      hold_cost: {
        title: FUND_COLUMN_LABELS.hold_cost,
        key: "hold_cost",
        align: "right",
        width: 90,
        sorter: fundColumnSorter("hold_cost"),
        render: (_, fund) => (
          <Text className="mono">{formatMoney(fund.hold_cost, 4)}</Text>
        ),
      },
      gszzl: {
        title: FUND_COLUMN_LABELS.gszzl,
        key: "gszzl",
        align: "right",
        width: 90,
        sorter: fundColumnSorter("gszzl"),
        render: (_, fund) => (
          <Text
            className="mono"
            style={{ color: trendColor(fund.nv_info?.gszzl ?? 0) }}
          >
            {fund.nv_info?.gszzl ? formatPercent(fund.nv_info.gszzl) : "-"}
          </Text>
        ),
      },
      jzzzl: {
        title: FUND_COLUMN_LABELS.jzzzl,
        key: "jzzzl",
        align: "right",
        width: 90,
        sorter: fundColumnSorter("jzzzl"),
        render: (_, fund) => (
          <Text
            className="mono"
            style={{ color: trendColor(fund.nv_info?.jzzzl ?? 0) }}
          >
            {fund.nv_info?.jzzzl ? formatPercent(fund.nv_info.jzzzl) : "-"}
          </Text>
        ),
      },
      hold_earn: {
        title: FUND_COLUMN_LABELS.hold_earn,
        key: "hold_earn",
        align: "right",
        width: 100,
        sorter: fundColumnSorter("hold_earn"),
        render: (_, fund) => (
          <Text className="mono" style={{ color: trendColor(fund.hold_earn) }}>
            {formatSigned(fund.hold_earn)}
          </Text>
        ),
      },
    };
  }, []);

  const columns: ColumnsType<FundItem> = useMemo(() => {
    const cols: ColumnsType<FundItem> = [
      {
        title: "基金",
        key: "name",
        fixed: "left",
        width: 180,
        render: (_, fund) => (
          <div>
            <Text strong>{fund.short_name}</Text>
            <br />
            <Text type="secondary" className="mono" style={{ fontSize: 12 }}>
              {fund.code}
            </Text>
            {fund.sector ? (
              <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                {fund.sector}
              </Text>
            ) : null}
          </div>
        ),
      },
    ];

    if (!embedded) {
      cols.push({
        title: "账户",
        key: "account",
        width: 120,
        render: (_, fund) => (
          <div>
            <Text>{fund.account_title || "-"}</Text>
            {fund.account_id ? (
              <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                ID {fund.account_id}
              </Text>
            ) : null}
          </div>
        ),
      });
    }

    for (const key of visibleKeys) {
      cols.push(dataColumnDefs[key]);
    }

    cols.push({
      title: "操作",
      key: "action",
      align: "center",
      fixed: "right",
      width: 80,
      render: (_, fund) => (
        <Button
          danger
          size="small"
          loading={removingId === fund.fund_id}
          onClick={() => {
            if (!fund.account_id) {
              setError("缺少账户信息，无法删除");
              return;
            }
            setError("");
            setConfirming(fund);
          }}
        >
          删除
        </Button>
      ),
    });

    return cols;
  }, [dataColumnDefs, embedded, removingId, visibleKeys]);

  const columnConfigContent = (
    <div style={{ width: 168 }}>
      <Checkbox.Group
        value={visibleKeys}
        onChange={(checked) => handleVisibleChange(checked as FundColumnKey[])}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {DEFAULT_COLUMN_ORDER.map((key) => (
          <Checkbox key={key} value={key}>
            {FUND_COLUMN_LABELS[key]}
          </Checkbox>
        ))}
      </Checkbox.Group>
      <Divider style={{ margin: "10px 0" }} />
      <Button
        type="link"
        size="small"
        onClick={handleResetColumns}
        style={{ padding: 0 }}
      >
        恢复默认列
      </Button>
    </div>
  );

  return (
    <>
      <Flex
        justify="space-between"
        align="center"
        gap={12}
        style={{ marginBottom: 8 }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {funds.length} 只
          {updatedAt ? ` · 更新 ${updatedAt.replace("T", " ")}` : ""}
          {" · 点击列头可排序"}
        </Text>
        <Popover
          title="表格列配置"
          trigger="click"
          placement="bottomRight"
          content={columnConfigContent}
        >
          <Button size="small" icon={<SettingOutlined />}>
            列配置
          </Button>
        </Popover>
      </Flex>

      <Table
        rowKey={(fund) => `${fund.account_id}-${fund.fund_id}`}
        columns={columns}
        dataSource={funds}
        pagination={false}
        scroll={{ x: Math.max(640, 180 + visibleKeys.length * 95 + 80) }}
        size="small"
        locale={{ emptyText: "该分组暂无持仓基金" }}
      />

      <Modal
        title="确认删除"
        open={Boolean(confirming)}
        onCancel={() => removingId == null && setConfirming(null)}
        onOk={handleConfirmRemove}
        okText="确认删除"
        okButtonProps={{ danger: true, loading: removingId != null }}
        cancelButtonProps={{ disabled: removingId != null }}
      >
        <Text>
          确定从「{confirming?.account_title || "账户"}
          」删除以下基金吗？此操作不可撤销。
        </Text>
        {confirming ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "#fafbfc",
              borderRadius: 8,
            }}
          >
            <Text strong>{confirming.short_name}</Text>
            <br />
            <Text type="secondary" className="mono">
              {confirming.code}
            </Text>
          </div>
        ) : null}
        {error ? (
          <Text type="danger" style={{ display: "block", marginTop: 12 }}>
            {error}
          </Text>
        ) : null}
      </Modal>
    </>
  );
}
