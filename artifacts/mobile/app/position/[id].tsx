import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useGetPositions,
  useClosePosition,
  useReducePosition,
  useGetTriggers,
  useCreateTrigger,
  useDeleteTrigger,
  getGetPositionsQueryKey,
  getGetTriggersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

type CloseType = "market" | "limit" | "stop_market" | "stop_limit" | "trailing_stop";
type TriggerType = "price_target" | "pnl_percent" | "trailing_stop" | "time_based";

const CLOSE_OPTIONS: { type: CloseType; label: string; icon: string; desc: string }[] = [
  { type: "market", label: "Market", icon: "zap", desc: "Immediate fill at best price" },
  { type: "limit", label: "Limit", icon: "target", desc: "Fill only at your specified price" },
  { type: "stop_market", label: "Stop Market", icon: "shield", desc: "Trigger then market close" },
  { type: "stop_limit", label: "Stop Limit", icon: "shield-off", desc: "Trigger then limit close" },
  { type: "trailing_stop", label: "Trailing Stop", icon: "trending-down", desc: "Follow price with offset" },
];

const REDUCE_OPTIONS = [25, 50, 75];

const TRIGGER_TYPES: { type: TriggerType; label: string; icon: string }[] = [
  { type: "price_target", label: "Price Target", icon: "target" },
  { type: "pnl_percent", label: "PnL %", icon: "percent" },
  { type: "trailing_stop", label: "Trailing Stop", icon: "trending-down" },
];

export default function PositionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"close" | "reduce" | "triggers">("close");
  const [selectedClose, setSelectedClose] = useState<CloseType>("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [trailingOffset, setTrailingOffset] = useState("");
  const [reducePercent, setReducePercent] = useState(50);
  const [reduceCloseType, setReduceCloseType] = useState<"market" | "limit">("market");
  const [reduceLimitPrice, setReduceLimitPrice] = useState("");

  const [triggerType, setTriggerType] = useState<TriggerType>("price_target");
  const [triggerCondition, setTriggerCondition] = useState<"above" | "below">("below");
  const [triggerValue, setTriggerValue] = useState("");
  const [triggerCloseType, setTriggerCloseType] = useState<"market" | "limit">("market");

  const { data: positions } = useGetPositions({ query: { queryKey: getGetPositionsQueryKey() } });
  const position = positions?.find(p => p.id === id);

  const { data: triggers } = useGetTriggers({ query: { queryKey: getGetTriggersQueryKey() } });
  const positionTriggers = triggers?.filter(t => t.positionId === id) ?? [];

  const { mutate: closePosition, isPending: closing } = useClosePosition({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPositionsQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message ?? "Failed to close position");
      },
    },
  });

  const { mutate: reducePosition, isPending: reducing } = useReducePosition({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPositionsQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message ?? "Failed to reduce position");
      },
    },
  });

  const { mutate: createTrigger, isPending: creatingTrigger } = useCreateTrigger({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTriggersQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTriggerValue("");
      },
    },
  });

  const { mutate: deleteTrigger } = useDeleteTrigger({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTriggersQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      },
    },
  });

  if (!position) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  const isLong = position.side === "long";
  const isProfitable = position.unrealizedPnl >= 0;

  const handleClose = () => {
    const body: any = { closeType: selectedClose };
    if (selectedClose === "limit" && limitPrice) body.price = parseFloat(limitPrice);
    if (selectedClose === "stop_market" && stopPrice) body.stopPrice = parseFloat(stopPrice);
    if (selectedClose === "stop_limit") {
      if (stopPrice) body.stopPrice = parseFloat(stopPrice);
      if (limitPrice) body.price = parseFloat(limitPrice);
    }
    if (selectedClose === "trailing_stop" && trailingOffset) body.trailingOffset = parseFloat(trailingOffset);

    Alert.alert(
      "Confirm Close",
      `Close ${position.symbol} ${position.side.toUpperCase()} position via ${selectedClose.replace("_", " ")}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Close",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            closePosition({ positionId: id, data: body });
          },
        },
      ]
    );
  };

  const handleReduce = () => {
    const body: any = { reducePercent, closeType: reduceCloseType };
    if (reduceCloseType === "limit" && reduceLimitPrice) body.price = parseFloat(reduceLimitPrice);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reducePosition({ positionId: id, data: body });
  };

  const handleAddTrigger = () => {
    if (!triggerValue) return;
    createTrigger({
      data: {
        positionId: id,
        symbol: position.symbol,
        triggerType,
        condition: triggerCondition,
        value: parseFloat(triggerValue),
        closeType: triggerCloseType,
      },
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.symbol, { color: colors.foreground }]}>{position.symbol}</Text>
          <View style={[styles.sideBadge, { backgroundColor: isLong ? colors.profit + "22" : colors.loss + "22" }]}>
            <Text style={[styles.sideText, { color: isLong ? colors.profit : colors.loss }]}>
              {position.side.toUpperCase()} {position.leverage}x
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.pnlHeader,
            { color: isProfitable ? colors.profit : colors.loss },
          ]}
        >
          {isProfitable ? "+" : ""}${position.unrealizedPnl.toFixed(2)}
        </Text>
      </View>

      <View style={[styles.positionSummary, { backgroundColor: colors.surface1 }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Size</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{position.size.toFixed(4)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Entry</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>${position.entryPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Mark</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>${position.markPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Liq.</Text>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>${position.liquidationPrice.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["close", "reduce", "triggers"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t === "close" ? "Close" : t === "reduce" ? "Reduce" : `Triggers (${positionTriggers.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {tab === "close" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CLOSE METHOD</Text>
            <View style={styles.closeGrid}>
              {CLOSE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  onPress={() => setSelectedClose(opt.type)}
                  style={[
                    styles.closeOption,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedClose === opt.type && { borderColor: colors.primary, backgroundColor: colors.primary + "11" },
                  ]}
                >
                  <Feather
                    name={opt.icon as any}
                    size={18}
                    color={selectedClose === opt.type ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.closeOptionLabel,
                      { color: selectedClose === opt.type ? colors.primary : colors.foreground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={[styles.closeOptionDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(selectedClose === "limit" || selectedClose === "stop_limit") && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Limit Price</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface2, borderColor: colors.border }]}
                  value={limitPrice}
                  onChangeText={setLimitPrice}
                  placeholder={`e.g. ${position.markPrice.toFixed(2)}`}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            )}

            {(selectedClose === "stop_market" || selectedClose === "stop_limit") && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Stop Trigger Price</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface2, borderColor: colors.border }]}
                  value={stopPrice}
                  onChangeText={setStopPrice}
                  placeholder={`e.g. ${(position.markPrice * 0.99).toFixed(2)}`}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            )}

            {selectedClose === "trailing_stop" && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Trailing Offset (%)</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface2, borderColor: colors.border }]}
                  value={trailingOffset}
                  onChangeText={setTrailingOffset}
                  placeholder="e.g. 1.5"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            )}

            <TouchableOpacity
              onPress={handleClose}
              disabled={closing}
              style={[styles.actionBtn, { backgroundColor: colors.loss }]}
            >
              {closing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="x-circle" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    Close {position.symbol} ({selectedClose.replace(/_/g, " ")})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {tab === "reduce" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>REDUCE BY</Text>
            <View style={styles.reduceRow}>
              {REDUCE_OPTIONS.map((pct) => (
                <TouchableOpacity
                  key={pct}
                  onPress={() => setReducePercent(pct)}
                  style={[
                    styles.reducePill,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    reducePercent === pct && { borderColor: colors.primary, backgroundColor: colors.primary + "11" },
                  ]}
                >
                  <Text style={[styles.reducePillText, { color: reducePercent === pct ? colors.primary : colors.foreground }]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.reduceRow}>
              {(["market", "limit"] as const).map((ct) => (
                <TouchableOpacity
                  key={ct}
                  onPress={() => setReduceCloseType(ct)}
                  style={[
                    styles.reducePill,
                    { backgroundColor: colors.card, borderColor: colors.border, flex: 1 },
                    reduceCloseType === ct && { borderColor: colors.primary, backgroundColor: colors.primary + "11" },
                  ]}
                >
                  <Text style={[styles.reducePillText, { color: reduceCloseType === ct ? colors.primary : colors.foreground }]}>
                    {ct.charAt(0).toUpperCase() + ct.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {reduceCloseType === "limit" && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Limit Price</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface2, borderColor: colors.border }]}
                  value={reduceLimitPrice}
                  onChangeText={setReduceLimitPrice}
                  placeholder={`e.g. ${position.markPrice.toFixed(2)}`}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={[styles.reducePreview, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.reducePreviewLabel, { color: colors.mutedForeground }]}>Closing</Text>
              <Text style={[styles.reducePreviewValue, { color: colors.foreground }]}>
                {(position.size * reducePercent / 100).toFixed(4)} / {position.size.toFixed(4)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleReduce}
              disabled={reducing}
              style={[styles.actionBtn, { backgroundColor: colors.warning }]}
            >
              {reducing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="minus-circle" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Reduce {reducePercent}% ({reduceCloseType})</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {tab === "triggers" && (
          <View style={styles.section}>
            {positionTriggers.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACTIVE TRIGGERS</Text>
                {positionTriggers.map((trigger) => (
                  <View key={trigger.id} style={[styles.triggerCard, { backgroundColor: colors.card, borderColor: colors.primary + "33" }]}>
                    <View style={styles.triggerInfo}>
                      <View style={[styles.triggerBadge, { backgroundColor: colors.primary + "22" }]}>
                        <Text style={[styles.triggerBadgeText, { color: colors.primary }]}>
                          {trigger.triggerType.replace(/_/g, " ")}
                        </Text>
                      </View>
                      <Text style={[styles.triggerDesc, { color: colors.foreground }]}>
                        {trigger.condition === "above" ? "Price >" : "Price <"} {trigger.value} → {trigger.closeType}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteTrigger({ triggerId: trigger.id })}
                      style={styles.deleteTriggerBtn}
                    >
                      <Feather name="trash-2" size={14} color={colors.loss} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 16 }]}>ADD TRIGGER NINJA</Text>

            <View style={styles.triggerTypeRow}>
              {TRIGGER_TYPES.map((tt) => (
                <TouchableOpacity
                  key={tt.type}
                  onPress={() => setTriggerType(tt.type)}
                  style={[
                    styles.triggerTypeBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    triggerType === tt.type && { borderColor: colors.primary, backgroundColor: colors.primary + "11" },
                  ]}
                >
                  <Feather
                    name={tt.icon as any}
                    size={14}
                    color={triggerType === tt.type ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.triggerTypeBtnText, { color: triggerType === tt.type ? colors.primary : colors.foreground }]}>
                    {tt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.conditionRow}>
              {(["above", "below"] as const).map((cond) => (
                <TouchableOpacity
                  key={cond}
                  onPress={() => setTriggerCondition(cond)}
                  style={[
                    styles.reducePill,
                    { backgroundColor: colors.card, borderColor: colors.border, flex: 1 },
                    triggerCondition === cond && {
                      borderColor: cond === "above" ? colors.profit : colors.loss,
                      backgroundColor: (cond === "above" ? colors.profit : colors.loss) + "11",
                    },
                  ]}
                >
                  <Feather
                    name={cond === "above" ? "arrow-up" : "arrow-down"}
                    size={12}
                    color={triggerCondition === cond ? (cond === "above" ? colors.profit : colors.loss) : colors.mutedForeground}
                  />
                  <Text style={[styles.reducePillText, {
                    color: triggerCondition === cond ? (cond === "above" ? colors.profit : colors.loss) : colors.foreground
                  }]}>
                    {cond === "above" ? "Above" : "Below"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                {triggerType === "pnl_percent" ? "PnL Threshold (%)" : "Price Value"}
              </Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface2, borderColor: colors.border }]}
                value={triggerValue}
                onChangeText={setTriggerValue}
                placeholder={triggerType === "pnl_percent" ? "e.g. -5 or 10" : `e.g. ${position.markPrice.toFixed(2)}`}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.reduceRow}>
              {(["market", "limit"] as const).map((ct) => (
                <TouchableOpacity
                  key={ct}
                  onPress={() => setTriggerCloseType(ct)}
                  style={[
                    styles.reducePill,
                    { backgroundColor: colors.card, borderColor: colors.border, flex: 1 },
                    triggerCloseType === ct && { borderColor: colors.primary, backgroundColor: colors.primary + "11" },
                  ]}
                >
                  <Text style={[styles.reducePillText, { color: triggerCloseType === ct ? colors.primary : colors.foreground }]}>
                    {ct === "market" ? "Market Close" : "Limit Close"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleAddTrigger}
              disabled={creatingTrigger || !triggerValue}
              style={[
                styles.actionBtn,
                { backgroundColor: triggerValue ? colors.primary : colors.surface3 },
              ]}
            >
              {creatingTrigger ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="plus-circle" size={18} color={triggerValue ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.actionBtnText, { color: triggerValue ? colors.primaryForeground : colors.mutedForeground }]}>
                    Add Trigger
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerInfo: { alignItems: "center", gap: 4 },
  symbol: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sideBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  sideText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  pnlHeader: { fontSize: 18, fontFamily: "Inter_700Bold" },
  positionSummary: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 2 },
  summaryValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },
  section: { paddingTop: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  closeGrid: { gap: 8, marginBottom: 16 },
  closeOption: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  closeOptionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  closeOptionDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  reduceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  reducePill: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  reducePillText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reducePreview: { borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reducePreviewLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  reducePreviewValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  triggerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  triggerInfo: { flex: 1, gap: 4 },
  triggerBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  triggerBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  triggerDesc: { fontSize: 13, fontFamily: "Inter_500Medium" },
  deleteTriggerBtn: { padding: 8 },
  triggerTypeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  triggerTypeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  triggerTypeBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  conditionRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
});
