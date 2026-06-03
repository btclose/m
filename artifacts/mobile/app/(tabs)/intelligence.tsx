import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

type RiskLabel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Analysis {
  riskScore: number;
  riskLabel: RiskLabel;
  summary: string;
  suggestions: string[];
  macrodroidTips: string[];
  portfolioRisk: string;
  generatedAt: string;
}

interface Macro {
  name: string;
  description: string;
  trigger: string;
  action: string;
  webhookUrl: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
}

const RISK_COLORS: Record<RiskLabel, string> = {
  LOW: "#00d4aa",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#00d4aa",
};

const CATEGORY_ICONS: Record<string, string> = {
  safety: "shield",
  "profit-taking": "trending-up",
  "risk-management": "alert-triangle",
  notifications: "bell",
  automation: "zap",
  intelligence: "cpu",
};

function RiskGauge({ score, label }: { score: number; label: RiskLabel }) {
  const colors = useColors();
  const color = RISK_COLORS[label];
  const pct = Math.min(score, 100);

  return (
    <View style={[styles.gaugeCard, { backgroundColor: colors.card }]}>
      <View style={styles.gaugeHeader}>
        <Text style={[styles.gaugeTitle, { color: colors.mutedForeground }]}>RISK SCORE</Text>
        <View style={[styles.riskBadge, { backgroundColor: color + "22" }]}>
          <Text style={[styles.riskBadgeText, { color }]}>{label}</Text>
        </View>
      </View>
      <Text style={[styles.gaugeScore, { color }]}>{score}</Text>
      <View style={[styles.gaugeTrack, { backgroundColor: colors.surface3 }]}>
        <View style={[styles.gaugeFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.gaugeLabels}>
        <Text style={[styles.gaugeLabel, { color: colors.mutedForeground }]}>Safe</Text>
        <Text style={[styles.gaugeLabel, { color: colors.mutedForeground }]}>Liquidation</Text>
      </View>
    </View>
  );
}

function MacroCard({ macro, index }: { macro: Macro; index: number }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const priorityColor = PRIORITY_COLORS[macro.priority] ?? colors.primary;
  const icon = CATEGORY_ICONS[macro.category] ?? "zap";

  const copyWebhook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Webhook URL",
      macro.webhookUrl,
      [{ text: "OK" }]
    );
  };

  return (
    <TouchableOpacity
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
      style={[styles.macroCard, { backgroundColor: colors.card, borderLeftColor: priorityColor }]}
    >
      <View style={styles.macroHeader}>
        <View style={styles.macroLeft}>
          <View style={[styles.macroIconBg, { backgroundColor: priorityColor + "22" }]}>
            <Feather name={icon as any} size={14} color={priorityColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.macroName, { color: colors.foreground }]}>
              {index + 1}. {macro.name}
            </Text>
            <Text style={[styles.macroCat, { color: colors.mutedForeground }]}>
              {macro.category} · {macro.priority}
            </Text>
          </View>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </View>

      {expanded && (
        <View style={styles.macroBody}>
          <Text style={[styles.macroDesc, { color: colors.foreground }]}>{macro.description}</Text>

          <View style={[styles.macroSection, { backgroundColor: colors.surface3 }]}>
            <Text style={[styles.macroSectionTitle, { color: colors.mutedForeground }]}>⚡ TRIGGER</Text>
            <Text style={[styles.macroSectionText, { color: colors.foreground }]}>{macro.trigger}</Text>
          </View>

          <View style={[styles.macroSection, { backgroundColor: colors.surface3 }]}>
            <Text style={[styles.macroSectionTitle, { color: colors.mutedForeground }]}>🔧 ACTION</Text>
            <Text style={[styles.macroSectionText, { color: colors.foreground }]}>{macro.action}</Text>
          </View>

          <TouchableOpacity
            onPress={copyWebhook}
            style={[styles.webhookRow, { backgroundColor: colors.primary + "11", borderColor: colors.primary + "44" }]}
          >
            <Feather name="link" size={12} color={colors.primary} />
            <Text style={[styles.webhookText, { color: colors.primary }]} numberOfLines={1}>
              {macro.webhookUrl}
            </Text>
            <Feather name="copy" size={12} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function IntelligenceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingMacros, setLoadingMacros] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"analysis" | "macros">("analysis");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const fetchAnalysis = useCallback(async () => {
    setLoadingAnalysis(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/api/ai/analysis`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as Analysis;
      setAnalysis(data);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to load analysis");
    } finally {
      setLoadingAnalysis(false);
    }
  }, [baseUrl]);

  const fetchMacros = useCallback(async () => {
    setLoadingMacros(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/api/ai/macros`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as Macro[];
      setMacros(data);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to generate macros");
    } finally {
      setLoadingMacros(false);
    }
  }, [baseUrl]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === "analysis") await fetchAnalysis();
    else await fetchMacros();
    setRefreshing(false);
  }, [activeTab, fetchAnalysis, fetchMacros]);

  const handleExport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = `${baseUrl}/api/ai/macros/export`;
    Alert.alert(
      "Export MacroDroid Macros",
      `Open this URL in your browser or MacroDroid to download the macro pack:\n\n${url}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open", onPress: () => Linking.openURL(url) },
      ]
    );
  };

  const isLoading = activeTab === "analysis" ? loadingAnalysis : loadingMacros;
  const hasData = activeTab === "analysis" ? !!analysis : macros.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Intelligence</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>AI · MacroDroid</Text>
        </View>
        {activeTab === "macros" && macros.length > 0 && (
          <TouchableOpacity
            onPress={handleExport}
            style={[styles.exportBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}
          >
            <Feather name="download" size={14} color={colors.primary} />
            <Text style={[styles.exportBtnText, { color: colors.primary }]}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["analysis", "macros"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setActiveTab(t)}
            style={[styles.tab, activeTab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Feather
              name={t === "analysis" ? "activity" : "cpu"}
              size={14}
              color={activeTab === t ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.tabText, { color: activeTab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "analysis" ? "Risk Analysis" : `MacroDroid${macros.length ? ` (${macros.length})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 114 : 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {errorMsg && (
          <View style={[styles.errorBox, { backgroundColor: colors.loss + "22", borderColor: colors.loss + "44" }]}>
            <Feather name="alert-circle" size={16} color={colors.loss} />
            <Text style={[styles.errorText, { color: colors.loss }]}>{errorMsg}</Text>
          </View>
        )}

        {activeTab === "analysis" && (
          <>
            {!analysis && !loadingAnalysis && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "11" }]}>
                  <Feather name="activity" size={36} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>AI Risk Analysis</Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                  Get an instant AI breakdown of your portfolio risk, danger zones, and specific trade management suggestions based on your live positions.
                </Text>
                <TouchableOpacity
                  onPress={fetchAnalysis}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="zap" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Analyze Now</Text>
                </TouchableOpacity>
              </View>
            )}

            {loadingAnalysis && (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Analyzing your positions...
                </Text>
              </View>
            )}

            {analysis && !loadingAnalysis && (
              <View style={{ gap: 12 }}>
                <RiskGauge score={analysis.riskScore} label={analysis.riskLabel} />

                <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
                  <View style={styles.infoCardHeader}>
                    <Feather name="shield" size={14} color={colors.accent} />
                    <Text style={[styles.infoCardTitle, { color: colors.mutedForeground }]}>PORTFOLIO RISK</Text>
                  </View>
                  <Text style={[styles.infoCardText, { color: colors.loss }]}>{analysis.portfolioRisk}</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
                  <View style={styles.infoCardHeader}>
                    <Feather name="eye" size={14} color={colors.accent} />
                    <Text style={[styles.infoCardTitle, { color: colors.mutedForeground }]}>SUMMARY</Text>
                  </View>
                  <Text style={[styles.infoCardText, { color: colors.foreground }]}>{analysis.summary}</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
                  <View style={styles.infoCardHeader}>
                    <Feather name="check-circle" size={14} color={colors.profit} />
                    <Text style={[styles.infoCardTitle, { color: colors.mutedForeground }]}>ACTIONS TO TAKE NOW</Text>
                  </View>
                  {analysis.suggestions.map((s, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color: colors.primary }]}>›</Text>
                      <Text style={[styles.bulletText, { color: colors.foreground }]}>{s}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
                  <View style={styles.infoCardHeader}>
                    <Feather name="cpu" size={14} color={colors.warning} />
                    <Text style={[styles.infoCardTitle, { color: colors.mutedForeground }]}>MACRODROID IDEAS FROM YOUR DATA</Text>
                  </View>
                  {analysis.macrodroidTips.map((tip, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color: colors.warning }]}>›</Text>
                      <Text style={[styles.bulletText, { color: colors.foreground }]}>{tip}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.refreshRow}>
                  <Text style={[styles.generatedAt, { color: colors.mutedForeground }]}>
                    Generated {new Date(analysis.generatedAt).toLocaleTimeString()}
                  </Text>
                  <TouchableOpacity onPress={fetchAnalysis} style={[styles.refreshBtn, { borderColor: colors.border }]}>
                    <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.refreshBtnText, { color: colors.mutedForeground }]}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {activeTab === "macros" && (
          <>
            {!macros.length && !loadingMacros && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "11" }]}>
                  <Feather name="cpu" size={36} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>MacroDroid Pack</Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                  AI generates 15 MacroDroid macros tailored to your exact positions, risk levels, and trading style — including automation ideas you'd never think of.
                </Text>
                <TouchableOpacity
                  onPress={fetchMacros}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="cpu" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Generate Macros</Text>
                </TouchableOpacity>
              </View>
            )}

            {loadingMacros && (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Generating your macro pack...
                </Text>
                <Text style={[styles.loadingSubText, { color: colors.mutedForeground }]}>
                  AI is reading your positions and crafting 15 tailored macros
                </Text>
              </View>
            )}

            {macros.length > 0 && !loadingMacros && (
              <View style={{ gap: 8 }}>
                <View style={[styles.macroSummaryCard, { backgroundColor: colors.surface1 }]}>
                  <View style={styles.macroSummaryRow}>
                    {(["critical", "high", "medium", "low"] as const).map((p) => {
                      const count = macros.filter(m => m.priority === p).length;
                      return count > 0 ? (
                        <View key={p} style={styles.macroSummaryItem}>
                          <Text style={[styles.macroSummaryCount, { color: PRIORITY_COLORS[p] }]}>{count}</Text>
                          <Text style={[styles.macroSummaryLabel, { color: colors.mutedForeground }]}>{p}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                  <Text style={[styles.macroSummaryNote, { color: colors.mutedForeground }]}>
                    Tap each macro to see trigger + action details, then set up in MacroDroid
                  </Text>
                </View>

                {macros.map((macro, i) => (
                  <MacroCard key={i} macro={macro} index={i} />
                ))}

                <TouchableOpacity
                  onPress={handleExport}
                  style={[styles.exportBigBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="download" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.exportBigBtnText, { color: colors.primaryForeground }]}>Export All to File</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={fetchMacros}
                  style={[styles.regenBtn, { borderColor: colors.border }]}
                >
                  <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.regenBtnText, { color: colors.mutedForeground }]}>Regenerate with latest data</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exportBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  emptyState: { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loadingState: { alignItems: "center", paddingTop: 60, gap: 16 },
  loadingText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  loadingSubText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  gaugeCard: { borderRadius: 16, padding: 16, marginBottom: 4 },
  gaugeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  gaugeTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  riskBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  riskBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  gaugeScore: { fontSize: 48, fontFamily: "Inter_700Bold", letterSpacing: -2, marginBottom: 8 },
  gaugeTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  gaugeFill: { height: "100%", borderRadius: 4 },
  gaugeLabels: { flexDirection: "row", justifyContent: "space-between" },
  gaugeLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  infoCard: { borderRadius: 16, padding: 14, gap: 8 },
  infoCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  infoCardTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  infoCardText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 20 },
  bulletText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  refreshRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  generatedAt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  macroSummaryCard: { borderRadius: 16, padding: 14, gap: 10 },
  macroSummaryRow: { flexDirection: "row", justifyContent: "space-around" },
  macroSummaryItem: { alignItems: "center" },
  macroSummaryCount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  macroSummaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  macroSummaryNote: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  macroCard: {
    borderRadius: 12,
    borderLeftWidth: 3,
    overflow: "hidden",
  },
  macroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  macroLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  macroIconBg: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  macroName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  macroCat: { fontSize: 11, fontFamily: "Inter_400Regular" },
  macroBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  macroDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  macroSection: { borderRadius: 8, padding: 10, gap: 4 },
  macroSectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  macroSectionText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  webhookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  webhookText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  exportBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  exportBigBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 4,
  },
  regenBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
