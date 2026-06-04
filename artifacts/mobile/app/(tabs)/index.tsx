import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  useGetPositions,
  useGetAccount,
  useCloseAllPositions,
  getGetPositionsQueryKey,
  getGetAccountQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type Position = {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  leverage: number;
  margin: number;
  createdAt: string;
};

function SetupBanner() {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={[styles.setupBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
      <Feather name="key" size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.setupTitle, { color: colors.foreground }]}>API Key Required</Text>
        <Text style={[styles.setupText, { color: colors.mutedForeground }]}>
          Add your Bitunix API key and secret in Settings to start trading.
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/settings" as any)}
        style={[styles.setupBtn, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.setupBtnText, { color: colors.primaryForeground }]}>Setup</Text>
      </TouchableOpacity>
    </View>
  );
}

function AccountHeader({ account }: { account: any }) {
  const colors = useColors();
  return (
    <View style={[styles.accountCard, { backgroundColor: colors.surface1 }]}>
      <View style={styles.accountRow}>
        <View style={styles.accountItem}>
          <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>Equity</Text>
          <Text style={[styles.accountValue, { color: colors.foreground }]}>
            ${(account?.equity ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={styles.accountItem}>
          <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>Available</Text>
          <Text style={[styles.accountValue, { color: colors.foreground }]}>
            ${(account?.availableBalance ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={styles.accountItem}>
          <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>Total PnL</Text>
          <Text
            style={[
              styles.accountValue,
              { color: (account?.unrealizedPnl ?? 0) >= 0 ? colors.profit : colors.loss },
            ]}
          >
            {(account?.unrealizedPnl ?? 0) >= 0 ? "+" : ""}
            ${(account?.unrealizedPnl ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>
      <View style={[styles.marginBar, { backgroundColor: colors.surface3 }]}>
        <View
          style={[
            styles.marginFill,
            {
              width: `${Math.min(account?.marginRatio ?? 0, 100)}%`,
              backgroundColor:
                (account?.marginRatio ?? 0) > 80
                  ? colors.loss
                  : (account?.marginRatio ?? 0) > 50
                  ? colors.warning
                  : colors.profit,
            },
          ]}
        />
      </View>
      <Text style={[styles.marginLabel, { color: colors.mutedForeground }]}>
        Margin ratio {(account?.marginRatio ?? 0).toFixed(1)}%
      </Text>
    </View>
  );
}

function PositionCard({ position, onPress }: { position: Position; onPress: () => void }) {
  const colors = useColors();
  const isLong = position.side === "long";
  const isProfitable = position.unrealizedPnl >= 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.card, { backgroundColor: colors.card }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.symbolRow}>
          <View
            style={[
              styles.sideBadge,
              { backgroundColor: isLong ? colors.profit + "22" : colors.loss + "22" },
            ]}
          >
            <Text
              style={[styles.sideText, { color: isLong ? colors.profit : colors.loss }]}
            >
              {isLong ? "LONG" : "SHORT"}
            </Text>
          </View>
          <Text style={[styles.symbol, { color: colors.foreground }]}>{position.symbol}</Text>
          <View style={[styles.leverageBadge, { backgroundColor: colors.surface3 }]}>
            <Text style={[styles.leverageText, { color: colors.mutedForeground }]}>
              {position.leverage}x
            </Text>
          </View>
        </View>
        <View style={styles.pnlContainer}>
          <Text
            style={[
              styles.pnlMain,
              { color: isProfitable ? colors.profit : colors.loss },
            ]}
          >
            {isProfitable ? "+" : ""}${position.unrealizedPnl.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.pnlPct,
              { color: isProfitable ? colors.profit : colors.loss },
            ]}
          >
            ({isProfitable ? "+" : ""}{position.unrealizedPnlPct.toFixed(2)}%)
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Size</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {position.size.toFixed(4)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Entry</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              ${position.entryPrice.toFixed(2)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Mark</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              ${position.markPrice.toFixed(2)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Liq.</Text>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              ${position.liquidationPrice.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Margin</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            ${position.margin.toFixed(2)}
          </Text>
        </View>
        <View style={styles.actionHint}>
          <Text style={[styles.actionHintText, { color: colors.mutedForeground }]}>Tap to manage</Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PositionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/status`)
      .then(r => r.json())
      .then((s: any) => setConfigured(!!s.configured))
      .catch(() => setConfigured(false));
  }, []);

  const { data: positions, isLoading: posLoading, error: posError, refetch: refetchPositions } = useGetPositions({
    query: { queryKey: getGetPositionsQueryKey(), refetchInterval: configured ? 5000 : false },
  });

  const { data: account } = useGetAccount({
    query: { queryKey: getGetAccountQueryKey(), refetchInterval: configured ? 5000 : false },
  });

  const { mutate: closeAll, isPending: closingAll } = useCloseAllPositions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPositionsQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const s = await fetch(`${BASE_URL}/api/status`).then(r => r.json()).catch(() => ({ configured: false }));
    setConfigured(!!s.configured);
    await refetchPositions();
    setRefreshing(false);
  }, [refetchPositions]);

  const handleCloseAll = () => {
    Alert.alert(
      "Close All Positions",
      "This will market-close ALL open positions immediately. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close All",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            closeAll();
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Positions</Text>
        {(positions?.length ?? 0) > 0 && (
          <TouchableOpacity
            onPress={handleCloseAll}
            style={[styles.closeAllBtn, { backgroundColor: colors.loss + "22", borderColor: colors.loss + "44" }]}
            disabled={closingAll}
          >
            {closingAll ? (
              <ActivityIndicator size="small" color={colors.loss} />
            ) : (
              <Text style={[styles.closeAllText, { color: colors.loss }]}>Close All</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {configured === false && <SetupBanner />}

      {configured && account && <AccountHeader account={account} />}

      {posLoading && !refreshing && configured && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {posError && configured && (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 12 }]}>
            Connection Error
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Check API settings and connection
          </Text>
          <TouchableOpacity onPress={() => refetchPositions()} style={[styles.retryBtn, { backgroundColor: colors.surface2 }]}>
            <Text style={[styles.retryText, { color: colors.foreground }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!posLoading && !posError && (
        <FlatList
          data={positions ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PositionCard
              position={item}
              onPress={() => router.push(`/position/${item.id}`)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad + 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              {configured === false ? (
                <>
                  <Feather name="key" size={48} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Not Connected</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Add your API key in Settings to see positions
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="activity" size={48} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Open Positions</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Your positions will appear here
                  </Text>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  closeAllBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeAllText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  setupBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  setupTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  setupText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  setupBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  setupBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  accountCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  accountItem: { alignItems: "center" },
  accountLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  accountValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  marginBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  marginFill: { height: "100%", borderRadius: 2 },
  marginLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "right" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    paddingBottom: 10,
  },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sideBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sideText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  symbol: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  leverageBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  leverageText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  pnlContainer: { alignItems: "flex-end" },
  pnlMain: { fontSize: 18, fontFamily: "Inter_700Bold" },
  pnlPct: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardBody: { paddingHorizontal: 14, paddingBottom: 10 },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  stat: { alignItems: "center" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 2 },
  statValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionHintText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
