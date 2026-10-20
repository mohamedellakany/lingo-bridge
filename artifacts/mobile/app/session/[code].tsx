import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/context/SessionContext";
import { useColors } from "@/hooks/useColors";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { getSession } = useSession();
  const [copied, setCopied] = useState(false);

  const session = useMemo(
    () => (code ? getSession(code) : undefined),
    [code, getSession]
  );

  // Build the plain-text transcript in the ORIGINAL (speaker) language only.
  const transcriptText = useMemo(() => {
    if (!session) return "";
    const header = `LingoBridge transcript — ${session.code}\n${session.fromLangName}\n${formatDate(session.createdAt)}\n\n`;
    const body = session.translations
      .map((t) => `[${formatTime(t.timestamp)}] ${t.original}`)
      .join("\n");
    return header + body;
  }, [session]);

  const handleShare = async () => {
    if (!transcriptText) return;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(transcriptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      await Share.share({ message: transcriptText });
    } catch {
      // user cancelled or sharing unavailable — ignore
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 20 : 12);
  const bottomPad = insets.bottom + 24;

  if (!session) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Transcript
          </Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Session not found
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            This conversation may have been removed.
          </Text>
        </View>
      </View>
    );
  }

  const durationMin =
    session.endedAt && session.createdAt
      ? Math.round((session.endedAt - session.createdAt) / 1000 / 60)
      : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Transcript
        </Text>
        <TouchableOpacity onPress={handleShare} style={styles.backBtn} disabled={session.translations.length === 0}>
          <Ionicons
            name={copied ? "checkmark" : Platform.OS === "web" ? "copy-outline" : "share-outline"}
            size={20}
            color={session.translations.length === 0 ? colors.mutedForeground : colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <LinearGradient
          colors={["#1A2E6B", "#0E1F52", "#0B1840"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.summary, { borderColor: colors.primary + "44" }]}
        >
          <View style={styles.summaryTop}>
            <Text style={[styles.summaryCode, { fontFamily: "Inter_700Bold" }]}>{session.code}</Text>
            {session.isActive && (
              <View style={[styles.liveTag, { backgroundColor: "#22C55E22" }]}>
                <View style={styles.liveDot} />
                <Text style={[styles.liveTagText, { fontFamily: "Inter_600SemiBold" }]}>LIVE</Text>
              </View>
            )}
          </View>

          <Text style={[styles.summaryLang, { fontFamily: "Inter_500Medium" }]}>
            Original language: {session.fromLangName}
          </Text>
          <Text style={[styles.summaryDate, { fontFamily: "Inter_400Regular" }]}>
            {formatDate(session.createdAt)}
          </Text>

          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Ionicons name="chatbubble-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={[styles.summaryStatText, { fontFamily: "Inter_400Regular" }]}>
                {session.translations.length} phrases
              </Text>
            </View>
            {durationMin !== null && (
              <View style={styles.summaryStat}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.75)" />
                <Text style={[styles.summaryStatText, { fontFamily: "Inter_400Regular" }]}>
                  {durationMin > 0 ? `${durationMin} min` : "< 1 min"}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
          CONVERSATION · {session.fromLangName.toUpperCase()}
        </Text>

        {/* Transcript — original language only */}
        {session.translations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mic-off-outline" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No phrases were captured in this session.
            </Text>
          </View>
        ) : (
          <View style={styles.transcript}>
            {session.translations.map((t) => (
              <View
                key={t.id}
                style={[styles.line, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.lineTime, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {formatTime(t.timestamp)}
                </Text>
                <Text style={[styles.lineText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {t.original}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },
  summary: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 6 },
  summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryCode: { color: "#FFF", fontSize: 22, letterSpacing: 0.5 },
  liveTag: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  liveTagText: { fontSize: 10, letterSpacing: 0.5, color: "#22C55E" },
  summaryLang: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 4 },
  summaryDate: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  summaryStats: { flexDirection: "row", gap: 18, marginTop: 10 },
  summaryStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryStatText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8 },
  transcript: { gap: 10 },
  line: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  lineTime: { fontSize: 11, letterSpacing: 0.5 },
  lineText: { fontSize: 15, lineHeight: 22 },
  emptyContainer: { alignItems: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 20, marginTop: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 260 },
});
