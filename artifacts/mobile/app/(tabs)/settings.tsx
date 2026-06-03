import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function SettingRow({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={styles.settingLabel}>
        <Text style={[styles.settingTitle, { color: colors.foreground }]}>{label}</Text>
        {sublabel && <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>{sublabel}</Text>}
      </View>
      <View style={styles.settingControl}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: serverSettings, isLoading } = useGetSettings();
  const { mutate: updateSettings, isPending: saving } = useUpdateSettings();

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://fapi.bitunix.com");
  const [coolifyEndpoint, setCoolifyEndpoint] = useState("");
  const [refreshInterval, setRefreshInterval] = useState("5");
  const [confirmCloses, setConfirmCloses] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (serverSettings) {
      setApiKey(serverSettings.apiKey ?? "");
      setApiSecret(serverSettings.apiSecret ?? "");
      setBaseUrl(serverSettings.baseUrl ?? "https://fapi.bitunix.com");
      setCoolifyEndpoint(serverSettings.coolifyEndpoint ?? "");
      setRefreshInterval(String(serverSettings.refreshInterval ?? 5));
      setConfirmCloses(serverSettings.confirmCloses ?? true);
      setHapticFeedback(serverSettings.hapticFeedback ?? true);
    }
  }, [serverSettings]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSettings(
      {
        data: {
          apiKey,
          apiSecret,
          baseUrl,
          coolifyEndpoint,
          refreshInterval: parseInt(refreshInterval) || 5,
          confirmCloses,
          hapticFeedback,
        },
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Saved", "Settings updated successfully.");
        },
        onError: () => {
          Alert.alert("Error", "Failed to save settings.");
        },
      }
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 114 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BITUNIX API</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingRow label="API Key" sublabel="From Bitunix account settings">
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface3 }]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Enter API key"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </SettingRow>
          <SettingRow label="API Secret" sublabel="Keep this private">
            <View style={styles.secretRow}>
              <TextInput
                style={[styles.input, styles.secretInput, { color: colors.foreground, backgroundColor: colors.surface3 }]}
                value={apiSecret}
                onChangeText={setApiSecret}
                placeholder="Enter secret"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowSecret(s => !s)} style={styles.eyeBtn}>
                <Feather name={showSecret ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </SettingRow>
          <SettingRow label="Base URL" sublabel="Bitunix futures endpoint">
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface3 }]}
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://fapi.bitunix.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </SettingRow>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>COOLIFY / HETZNER</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingRow label="Server Endpoint" sublabel="Your Coolify server URL">
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface3 }]}
              value={coolifyEndpoint}
              onChangeText={setCoolifyEndpoint}
              placeholder="https://your-server.example.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </SettingRow>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BEHAVIOR</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingRow label="Refresh Interval" sublabel="Seconds between data refreshes">
            <TextInput
              style={[styles.input, styles.smallInput, { color: colors.foreground, backgroundColor: colors.surface3 }]}
              value={refreshInterval}
              onChangeText={setRefreshInterval}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor={colors.mutedForeground}
            />
          </SettingRow>
          <SettingRow label="Confirm Closes" sublabel="Show confirmation dialog before closing positions">
            <Switch
              value={confirmCloses}
              onValueChange={setConfirmCloses}
              trackColor={{ false: colors.surface3, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </SettingRow>
          <SettingRow label="Haptic Feedback" sublabel="Vibrate on actions">
            <Switch
              value={hapticFeedback}
              onValueChange={setHapticFeedback}
              trackColor={{ false: colors.surface3, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </SettingRow>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Settings</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  section: { borderRadius: 16, overflow: "hidden", marginBottom: 4 },
  settingRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  settingLabel: { marginBottom: 4 },
  settingTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  settingSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  settingControl: { width: "100%" },
  input: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    width: "100%",
  },
  smallInput: { width: 80 },
  secretRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  secretInput: { flex: 1 },
  eyeBtn: { padding: 8 },
  saveBtn: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
