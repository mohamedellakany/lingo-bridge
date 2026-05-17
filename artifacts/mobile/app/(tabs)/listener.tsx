import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:5000";

interface ApiSession {
  code: string;
  fromLang: string;
  toLang: string;
  fromLangName: string;
  toLangName: string;
  createdAt: number;
  translations: Array<{
    id: string;
    original: string;
    translated: string;
    timestamp: number;
  }>;
}

type ListenMode = "listen" | "read";

export default function ListenerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [speakerInput, setSpeakerInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [waitingForSpeaker, setWaitingForSpeaker] = useState<string | null>(null);
  const [joinedSession, setJoinedSession] = useState<ApiSession | null>(null);
  const [latestTranslation, setLatestTranslation] = useState<{
    id: string;
    original: string;
    translated: string;
  } | null>(null);
  const [connectedCount] = useState(() => Math.floor(1 + Math.random() * 8));
  const [listenMode, setListenMode] = useState<ListenMode>("listen");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpokenIdRef = useRef<string>("");

  // Pulse animation for the speaker wave (listen mode)
  const wave1 = useSharedValue(1);
  const wave2 = useSharedValue(1);
  const wave3 = useSharedValue(1);

  useEffect(() => {
    if (isSpeaking) {
      wave1.value = withRepeat(withSequence(withTiming(1.3, { duration: 400 }), withTiming(1, { duration: 400 })), -1);
      wave2.value = withRepeat(withSequence(withTiming(1, { duration: 200 }), withTiming(1.5, { duration: 400 }), withTiming(1, { duration: 400 })), -1);
      wave3.value = withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(1.3, { duration: 400 }), withTiming(1, { duration: 300 })), -1);
    } else {
      wave1.value = withTiming(1, { duration: 200 });
      wave2.value = withTiming(1, { duration: 200 });
      wave3.value = withTiming(1, { duration: 200 });
    }
  }, [isSpeaking]);

  const wave1Style = useAnimatedStyle(() => ({ transform: [{ scaleY: wave1.value }] }));
  const wave2Style = useAnimatedStyle(() => ({ transform: [{ scaleY: wave2.value }] }));
  const wave3Style = useAnimatedStyle(() => ({ transform: [{ scaleY: wave3.value }] }));

  // Speak new translations when in listen mode
  useEffect(() => {
    if (!latestTranslation || !joinedSession) return;
    if (latestTranslation.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = latestTranslation.id;

    if (listenMode === "listen") {
      Speech.stop();
      setIsSpeaking(true);
      Speech.speak(latestTranslation.translated, {
        language: joinedSession.toLang,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
      });
    }
  }, [latestTranslation, listenMode, joinedSession]);

  const toggleListenMode = () => {
    const next: ListenMode = listenMode === "listen" ? "read" : "listen";
    if (next === "read") {
      Speech.stop();
      setIsSpeaking(false);
    }
    setListenMode(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startPolling = (sessionCode: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/api/sessions/${encodeURIComponent(sessionCode)}`
        );
        if (!resp.ok) return; // still waiting — keep polling
        const session = (await resp.json()) as ApiSession;
        // Speaker just went live — transition from waiting to connected
        setWaitingForSpeaker(null);
        setJoinedSession(session);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (session.translations.length > 0) {
          const last = session.translations[session.translations.length - 1];
          setLatestTranslation({ id: last.id, original: last.original, translated: last.translated });
        }
      } catch {
        // ignore transient network errors
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      Speech.stop();
    };
  }, []);

  const handleJoin = async () => {
    const username = speakerInput.trim();
    if (!username) {
      setJoinError("Please enter the speaker's username");
      return;
    }
    setJoining(true);
    setJoinError("");
    try {
      const code = username.toUpperCase();
      const resp = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(code)}`);
      if (resp.ok) {
        const session = (await resp.json()) as ApiSession;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setJoinedSession(session);
        if (session.translations.length > 0) {
          const last = session.translations[session.translations.length - 1];
          setLatestTranslation({ id: last.id, original: last.original, translated: last.translated });
        }
        startPolling(session.code);
      } else {
        // Speaker not live yet — enter waiting state and keep polling
        setWaitingForSpeaker(code);
        startPolling(code);
      }
    } catch {
      setJoinError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    Speech.stop();
    setIsSpeaking(false);
    setJoinedSession(null);
    setWaitingForSpeaker(null);
    setLatestTranslation(null);
    setSpeakerInput("");
    setJoinError("");
    lastSpokenIdRef.current = "";
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 12;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  // ─── Connected view ────────────────────────────────────────────────────────
  if (joinedSession) {
    return (
      <LinearGradient
        colors={[colors.background, "#0D1535", colors.background]}
        style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}
      >
        {/* Header */}
        <View style={styles.connectedHeader}>
          <TouchableOpacity onPress={handleLeave} style={styles.leaveBtn}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View style={styles.sessionInfo}>
            <View style={[styles.liveDot, { backgroundColor: "#22C55E" }]} />
            <Text style={[styles.sessionCode, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {joinedSession.code}
            </Text>
            <View style={styles.connectedBadge}>
              <Ionicons name="people" size={12} color={colors.mutedForeground} />
              <Text style={[styles.connectedText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {connectedCount + 1}
              </Text>
            </View>
          </View>

          {/* Listen / Read toggle */}
          <TouchableOpacity
            onPress={toggleListenMode}
            style={[
              styles.modeToggle,
              {
                backgroundColor: listenMode === "listen" ? colors.primary + "22" : colors.card,
                borderColor: listenMode === "listen" ? colors.primary + "66" : colors.border,
              },
            ]}
          >
            <Ionicons
              name={listenMode === "listen" ? "volume-high" : "eye-outline"}
              size={16}
              color={listenMode === "listen" ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.modeToggleText,
                {
                  color: listenMode === "listen" ? colors.primary : colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {listenMode === "listen" ? "Listen" : "Read"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Language row */}
        <View style={styles.langDisplay}>
          <View style={[styles.langTag, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.langTagText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {joinedSession.fromLangName}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />
          <View style={[styles.langTag, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.langTagText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {joinedSession.toLangName}
            </Text>
          </View>
        </View>

        {/* Content area */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.subtitleArea} showsVerticalScrollIndicator={false}>
          {latestTranslation ? (
            <>
              {/* Listen mode: audio visualizer */}
              {listenMode === "listen" && (
                <View style={styles.audioVisualizer}>
                  <LinearGradient
                    colors={[colors.primary + "18", colors.accent + "10"]}
                    style={[styles.visualizerCard, { borderColor: colors.primary + "33" }]}
                  >
                    <Ionicons
                      name={isSpeaking ? "volume-high" : "volume-medium"}
                      size={28}
                      color={isSpeaking ? colors.primary : colors.mutedForeground}
                    />
                    <View style={styles.waveRow}>
                      {[styles.bar1, styles.bar2, styles.bar3, styles.bar4, styles.bar5].map((barStyle, i) => {
                        const animStyle = [wave1Style, wave2Style, wave3Style, wave2Style, wave1Style][i];
                        return (
                          <Animated.View
                            key={i}
                            style={[
                              styles.waveBar,
                              barStyle,
                              animStyle,
                              { backgroundColor: isSpeaking ? colors.primary : colors.border },
                            ]}
                          />
                        );
                      })}
                    </View>
                    <Text style={[styles.audioStatus, { color: isSpeaking ? colors.primary : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {isSpeaking ? "Speaking..." : "Waiting for speaker..."}
                    </Text>
                  </LinearGradient>
                </View>
              )}

              {/* Translated text (always shown in read mode, dimmed in listen mode) */}
              <LinearGradient
                colors={[colors.primary + "18", colors.accent + "10"]}
                style={[
                  styles.subtitleCard,
                  { borderColor: colors.primary + "33", opacity: listenMode === "read" ? 1 : 0.6 },
                ]}
              >
                <Text style={[styles.subtitleText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {latestTranslation.translated}
                </Text>
              </LinearGradient>

              {/* Original text */}
              <View style={[styles.originalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.originalLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {joinedSession.fromLangName}
                </Text>
                <Text style={[styles.originalText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {latestTranslation.original}
                </Text>
              </View>

              {/* History */}
              {joinedSession.translations.length > 1 && (
                <View style={styles.historyList}>
                  <Text style={[styles.historyLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    EARLIER
                  </Text>
                  {joinedSession.translations
                    .slice(-5, -1)
                    .reverse()
                    .map((t, i) => (
                      <View
                        key={t.id}
                        style={[
                          styles.historyItem,
                          { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.7 - i * 0.1 },
                        ]}
                      >
                        <Text style={[styles.historyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                          {t.translated}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.waitingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.waitingText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Waiting for speaker to begin...
              </Text>
              <Text style={[styles.waitingSubText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Translations will appear here in real time
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Status bar */}
        <View style={[styles.statusBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.liveDot, { backgroundColor: "#22C55E" }]} />
          <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Live • {joinedSession.translations.length} phrase{joinedSession.translations.length !== 1 ? "s" : ""} received
          </Text>
          <View style={{ flex: 1 }} />
          <Ionicons
            name={listenMode === "listen" ? "volume-high" : "eye-outline"}
            size={14}
            color={colors.mutedForeground}
          />
          <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {listenMode === "listen" ? "Audio on" : "Read only"}
          </Text>
        </View>
      </LinearGradient>
    );
  }

  // ─── Waiting for speaker view ───────────────────────────────────────────────
  if (waitingForSpeaker) {
    return (
      <LinearGradient
        colors={[colors.background, "#0D1535", colors.background]}
        style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLeave} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Waiting for Speaker
          </Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.waitingContainer}>
          <LinearGradient
            colors={[colors.accent + "28", colors.primary + "18"]}
            style={styles.illustrationCircle}
          >
            <Ionicons name="headset" size={56} color={colors.accent} />
          </LinearGradient>

          <Text style={[styles.illustrationTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {waitingForSpeaker}
          </Text>
          <Text style={[styles.waitingText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            Waiting for speaker to go live...
          </Text>
          <Text style={[styles.waitingSubText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            You'll connect automatically the moment they start speaking
          </Text>

          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 8 }} />

          <TouchableOpacity
            onPress={handleLeave}
            style={[styles.cancelBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.cancelBtnText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ─── Join view ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Join a Session
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.joinContent}>
        {/* Illustration */}
        <View style={styles.illustrationArea}>
          <LinearGradient
            colors={[colors.accent + "28", colors.primary + "18"]}
            style={styles.illustrationCircle}
          >
            <Ionicons name="headset" size={56} color={colors.accent} />
          </LinearGradient>
          <Text style={[styles.illustrationTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Listen live
          </Text>
          <Text style={[styles.illustrationDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Enter the speaker's username to receive their live translated subtitles — no account needed
          </Text>
        </View>

        {/* No account badge */}
        <View style={[styles.noAccountBadge, { backgroundColor: "#22C55E18", borderColor: "#22C55E44" }]}>
          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          <Text style={[styles.noAccountText, { color: "#22C55E", fontFamily: "Inter_500Medium" }]}>
            No account required to listen
          </Text>
        </View>

        {/* Input */}
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            SPEAKER'S USERNAME
          </Text>
          <TextInput
            value={speakerInput}
            onChangeText={(v) => {
              setSpeakerInput(v.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              setJoinError("");
            }}
            placeholder="their_username"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.codeInput,
              {
                backgroundColor: colors.card,
                borderColor: joinError ? colors.destructive : colors.border,
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="join"
            onSubmitEditing={handleJoin}
          />
          {joinError ? (
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
              {joinError}
            </Text>
          ) : null}
        </View>

        {/* Join button */}
        <TouchableOpacity onPress={handleJoin} disabled={joining || !speakerInput.trim()} activeOpacity={0.85}>
          <LinearGradient
            colors={joining || !speakerInput.trim() ? [colors.muted, colors.muted] : [colors.accent, colors.primary]}
            style={styles.joinBtn}
          >
            {joining ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="headset" size={20} color="#FFF" />
                <Text style={[styles.joinBtnText, { fontFamily: "Inter_700Bold" }]}>Start Listening</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Tip */}
        <View style={[styles.tip, { backgroundColor: colors.secondary }]}>
          <Ionicons name="bulb-outline" size={16} color={colors.primary} />
          <Text style={[styles.tipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Ask the speaker for their username. It's the same every time — no session codes to share.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 16,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  joinContent: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 16 },
  illustrationArea: { alignItems: "center", gap: 12, paddingVertical: 16 },
  illustrationCircle: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  illustrationTitle: { fontSize: 22 },
  illustrationDesc: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 280 },
  noAccountBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  noAccountText: { fontSize: 14 },
  inputSection: { gap: 8 },
  inputLabel: { fontSize: 11, letterSpacing: 0.8 },
  codeInput: {
    borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 20, textAlign: "center", letterSpacing: 2,
  },
  errorText: { fontSize: 13, textAlign: "center" },
  joinBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 16, paddingVertical: 17,
  },
  joinBtnText: { fontSize: 17, color: "#FFF" },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, padding: 14 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  // Connected state
  connectedHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 10,
  },
  leaveBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  sessionInfo: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  sessionCode: { fontSize: 15 },
  connectedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  connectedText: { fontSize: 13 },
  modeToggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7,
  },
  modeToggleText: { fontSize: 13 },
  langDisplay: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingBottom: 12,
  },
  langTag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  langTagText: { fontSize: 13 },
  subtitleArea: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  audioVisualizer: {},
  visualizerCard: {
    borderRadius: 20, borderWidth: 1, padding: 24,
    alignItems: "center", gap: 16,
  },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 5, height: 40 },
  waveBar: { width: 5, borderRadius: 3 },
  bar1: { height: 16 },
  bar2: { height: 28 },
  bar3: { height: 36 },
  bar4: { height: 28 },
  bar5: { height: 16 },
  audioStatus: { fontSize: 14 },
  subtitleCard: {
    borderRadius: 20, padding: 24, borderWidth: 1,
    alignItems: "center", justifyContent: "center", minHeight: 100,
  },
  subtitleText: { fontSize: 21, lineHeight: 30, textAlign: "center" },
  originalBox: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 4 },
  originalLabel: { fontSize: 11, letterSpacing: 0.6 },
  originalText: { fontSize: 14, lineHeight: 21 },
  historyList: { gap: 8 },
  historyLabel: { fontSize: 10, letterSpacing: 0.8 },
  historyItem: { borderRadius: 12, padding: 12, borderWidth: 1 },
  historyText: { fontSize: 14 },
  waitingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  waitingText: { fontSize: 16, textAlign: "center" },
  waitingSubText: { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  cancelBtn: { marginTop: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 32, paddingVertical: 12 },
  cancelBtnText: { fontSize: 15 },
  statusBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, padding: 12, borderRadius: 14, borderWidth: 1,
  },
  statusText: { fontSize: 13 },
});
