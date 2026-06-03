import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useGetOrders,
  useCancelOrder,
  getGetOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

type Order = {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  size: number;
  filled: number;
  status: string;
  createdAt: string;
};

function OrderCard({ order, onCancel }: { order: Order; onCancel: () => void }) {
  const colors = useColors();
  const isBuy = order.side.toLowerCase().includes("buy");
  const fillPct = order.size > 0 ? (order.filled / order.size) * 100 : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View style={styles.leftCol}>
          <View style={styles.symbolRow}>
            <View style={[styles.sideBadge, { backgroundColor: isBuy ? colors.profit + "22" : colors.loss + "22" }]}>
              <Text style={[styles.sideText, { color: isBuy ? colors.profit : colors.loss }]}>
                {order.side.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.symbol, { color: colors.foreground }]}>{order.symbol}</Text>
          </View>
          <Text style={[styles.orderType, { color: colors.mutedForeground }]}>{order.type}</Text>
        </View>
        <TouchableOpacity
          onPress={onCancel}
          style={[styles.cancelBtn, { borderColor: colors.border }]}
        >
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Price</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>${order.price.toFixed(2)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Size</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{order.size.toFixed(4)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Filled</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{order.filled.toFixed(4)}</Text>
        </View>
      </View>

      <View style={[styles.fillBar, { backgroundColor: colors.surface3 }]}>
        <View style={[styles.fillFill, { width: `${fillPct}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[styles.fillLabel, { color: colors.mutedForeground }]}>{fillPct.toFixed(0)}% filled</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: orders, isLoading, refetch } = useGetOrders({
    query: { queryKey: getGetOrdersQueryKey(), refetchInterval: 5000 },
  });

  const { mutate: cancelOrder } = useCancelOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCancel = (order: Order) => {
    Alert.alert("Cancel Order", `Cancel ${order.side} ${order.symbol} order?`, [
      { text: "No", style: "cancel" },
      {
        text: "Cancel Order",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          cancelOrder({ orderId: order.id });
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Open Orders</Text>
      </View>

      {isLoading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {!isLoading && (
        <FlatList
          data={orders ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard order={item} onCancel={() => handleCancel(item)} />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 114 : 80 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="list" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Open Orders</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your open orders will appear here</Text>
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
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: { borderRadius: 16, marginBottom: 12, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  leftCol: { gap: 4 },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sideBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  sideText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  symbol: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  orderType: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cancelBtn: { borderWidth: 1, borderRadius: 8, padding: 8 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  stat: { alignItems: "center" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 2 },
  statValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fillBar: { height: 3, borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  fillFill: { height: "100%", borderRadius: 2 },
  fillLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
