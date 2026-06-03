import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useGetTradeHistory, getGetTradeHistoryQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type Trade = {
  id: string;
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  closedAt: string;
};

function TradeCard({ trade }: { trade: Trade }) {
  const colors = useColors();
  const isProfitable = trade.realizedPnl >= 0;
  const isLong = trade.side.toLowerCase().includes("long") || trade.side.toLowerCase() === "buy";
  const closedDate = new Date(trade.closedAt).toLocaleDateString();
  const closedTime = new Date(trade.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View style={styles.leftCol}>
          <View style={styles.symbolRow}>
            <View style={[styles.sideBadge, { backgroundColor: isLong ? colors.profit + "22" : colors.loss + "22" }]}>
              <Text style={[styles.sideText, { color: isLong ? colors.profit : colors.loss }]}>
                {isLong ? "LONG" : "SHORT"}
              </Text>
            </View>
            <Text style={[styles.symbol, { color: colors.foreground }]}>{trade.symbol}</Text>
          </View>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{closedDate} {closedTime}</Text>
        </View>
        <Text style={[styles.pnl, { color: isProfitable ? colors.profit : colors.loss }]}>
          {isProfitable ? "+" : ""}${trade.realizedPnl.toFixed(2)}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Size</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{trade.size.toFixed(4)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Entry</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>${trade.entryPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Exit</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>${trade.exitPrice.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: trades, isLoading, refetch } = useGetTradeHistory(
    { limit: 50 },
    { query: { queryKey: getGetTradeHistoryQueryKey({ limit: 50 }), refetchInterval: 30000 } }
  );

  const totalPnl = (trades ?? []).reduce((sum, t) => sum + t.realizedPnl, 0);
  const wins = (trades ?? []).filter(t => t.realizedPnl > 0).length;
  const losses = (trades ?? []).filter(t => t.realizedPnl <= 0).length;
  const winRate = trades && trades.length > 0 ? (wins / trades.length) * 100 : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Trade History</Text>
      </View>

      {(trades?.length ?? 0) > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.surface1 }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Realized PnL</Text>
              <Text style={[styles.summaryValue, { color: totalPnl >= 0 ? colors.profit : colors.loss }]}>
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Win Rate</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{winRate.toFixed(0)}%</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>W / L</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{wins} / {losses}</Text>
            </View>
          </View>
        </View>
      )}

      {isLoading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {!isLoading && (
        <FlatList
          data={trades ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TradeCard trade={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 114 : 80 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="clock" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Trade History</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Closed trades will appear here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  summaryCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  summaryValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: { borderRadius: 16, marginBottom: 10, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  leftCol: { gap: 4 },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sideBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  sideText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  symbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  time: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pnl: { fontSize: 17, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  stat: { alignItems: "center" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 2 },
  statValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
