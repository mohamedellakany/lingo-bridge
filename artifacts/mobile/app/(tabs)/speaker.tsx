import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
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
import {
  Language,
  LANGUAGES,
  LanguagePickerModal,
} from "@/components/LanguagePickerModal";
import { WaveformAnimation } from "@/components/WaveformAnimation";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { useColors } from "@/hooks/useColors";

const SEGMENT_DURATION_MS = 5000;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:8080";

export default function SpeakerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, isLoading: authLoading } = useAuth();
  const { createSpeakerSession, endSession, addTranslation } = useSession();

  // Auth guard — redirect to login if not signed in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const [fromLang, setFromLang] = useState<Language>(LANGUAGES[0]);
  const [toLang, setToLang] = useState<Language>(LANGUAGES[1]);
  const [fromPickerVisible, setFromPickerVisible] = useState(false);
  const [toPickerVisible, setToPickerVisible] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("Tap to start speaking");
  const [sessionCode, setSessionCode] = useState("");
  const [currentOriginal, setCurrentOriginal] = useState("");
  const [currentTranslation, setCurrentTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [apiError, setApiError] = useState("");

  const recordingActiveRef = useRef(false);
  const currentRecordingRef = useRef<Audio.Recording | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionCodeRef = useRef("");

  // Pulse + glow animation
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.45, { duration: 800 }),
          withTiming(0.12, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isRecording]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ─── Translation via API ─────────────────────────────────────────────────

  const stopCurrentRecording = useCallback(async (): Promise<string | null> => {
    const rec = currentRecordingRef.current;
    if (!rec) return null;
    currentRecordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      return rec.getURI() ?? null;
    } catch {
      return null;
    }
  }, []);

  const sendSegmentForTranslation = useCallback(
    async (uri: string) => {
      try {
        setIsProcessing(true);
        setStatusText("Processing...");
        setApiError("");

        let base64: string;
        if (Platform.OS === "web") {
          // On web, uri is a blob URL — fetch and convert to base64
          const blob = await fetch(uri).then((r) => r.blob());
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1] ?? "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        const format = Platform.OS === "web" ? "webm" : "m4a";

        const resp = await fetch(`${API_BASE}/api/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64,
            format,
            fromLang: fromLang.code,
            toLang: toLang.code,
            fromLangName: fromLang.name,
            toLangName: toLang.name,
            sessionCode: sessionCodeRef.current,
          }),
        });

        const data = (await resp.json()) as {
          original?: string;
          translated?: string;
          error?: string;
          fatal?: boolean;
        };

        if (data.error) {
          setApiError(data.error);
          // A fatal error (billing, bad key, rate limit) won't resolve by
          // retrying, so stop the recording loop instead of hammering the API.
          if (data.fatal) {
            recordingActiveRef.current = false;
            if (segmentTimerRef.current) {
              clearTimeout(segmentTimerRef.current);
              segmentTimerRef.current = null;
            }
            await stopCurrentRecording();
            setIsRecording(false);
            setStatusText("Stopped");
          }
        } else if (data.original && data.original.length > 1) {
          setCurrentOriginal(data.original);
          setCurrentTranslation(data.translated ?? "");
          setShowTranslation(true);
          await addTranslation(data.original, data.translated ?? "");
        }
      } catch (err) {
        setApiError("Network error. Check your connection.");
      } finally {
        setIsProcessing(false);
        if (recordingActiveRef.current) {
          setStatusText("Listening...");
        }
      }
    },
    [fromLang, toLang, addTranslation, stopCurrentRecording]
  );

  // ─── Recording segments ──────────────────────────────────────────────────

  const startNewSegment = useCallback(async () => {
    if (!recordingActiveRef.current) return;

    try {
      const rec = new Audio.Recording();
      currentRecordingRef.current = rec;

      await rec.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          outputFormat: 2, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: "aac ",
          audioQuality: 127, // HIGH
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 64000,
        },
      });
      await rec.startAsync();
      setStatusText("Listening...");

      // After SEGMENT_DURATION_MS, cycle: stop → send → start next
      segmentTimerRef.current = setTimeout(async () => {
        const uri = await stopCurrentRecording();
        // Start next segment immediately (no gap)
        startNewSegment();
        // Send previous segment for translation in background
        if (uri) {
          sendSegmentForTranslation(uri);
        }
      }, SEGMENT_DURATION_MS);
    } catch (err) {
      setApiError("Microphone error. Please try again.");
      recordingActiveRef.current = false;
      setIsRecording(false);
    }
  }, [stopCurrentRecording, sendSegmentForTranslation]);

  // ─── Start / Stop ────────────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    setApiError("");

    // Request microphone permission
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Microphone Access Needed",
        "LingoBridge needs microphone access to listen and translate your speech. Please allow it in Settings.",
        [{ text: "OK" }]
      );
      return;
    }

    // Set up audio session (iOS: allow recording in silent mode)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const code = await createSpeakerSession(
      fromLang.code,
      toLang.code,
      fromLang.name,
      toLang.name,
      user?.speakerCode
    );
    setSessionCode(code);
    sessionCodeRef.current = code;

    // Register session server-side so listeners can join across devices
    await fetch(`${API_BASE}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        fromLang: fromLang.code,
        toLang: toLang.code,
        fromLangName: fromLang.name,
        toLangName: toLang.name,
      }),
    }).catch(() => null);
    setIsRecording(true);
    setCurrentOriginal("");
    setCurrentTranslation("");
    setShowTranslation(false);
    recordingActiveRef.current = true;
    startNewSegment();
  }, [fromLang, toLang, createSpeakerSession, startNewSegment]);

  const handleStopRecording = useCallback(async () => {
    recordingActiveRef.current = false;

    // Cancel pending segment timer
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    // Stop and send the final in-flight segment
    const uri = await stopCurrentRecording();
    if (uri) {
      sendSegmentForTranslation(uri);
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRecording(false);
    setStatusText("Session ended");
    await endSession();
    setSessionCode("");
  }, [stopCurrentRecording, sendSegmentForTranslation, endSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recordingActiveRef.current = false;
      if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
      stopCurrentRecording();
    };
  }, [stopCurrentRecording]);

  const handleSwapLanguages = () => {
    if (isRecording) return;
    setFromLang(toLang);
    setToLang(fromLang);
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my LingoBridge session with code: ${sessionCode}\nOpen LingoBridge and tap "Join Session" to receive live translations.`,
        title: "Join my LingoBridge session",
      });
    } catch {
      // ignore
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const handleBack = () => {
    if (isRecording) {
      Alert.alert("Stop Session?", "This will end the active recording.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Session",
          style: "destructive",
          onPress: async () => {
            await handleStopRecording();
            goBack();
          },
        },
      ]);
    } else {
      goBack();
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 12;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Speaker Mode
          </Text>
          {sessionCode ? (
            <TouchableOpacity
              onPress={handleShareCode}
              style={[
                styles.codeBtn,
                {
                  backgroundColor: colors.primary + "22",
                  borderColor: colors.primary + "44",
                },
              ]}
            >
              <Text
                style={[
                  styles.codeText,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                {sessionCode}
              </Text>
              <Ionicons name="share-outline" size={14} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {/* Language Selector */}
        <View style={styles.langRow}>
          <TouchableOpacity
            onPress={() => !isRecording && setFromPickerVisible(true)}
            style={[
              styles.langPill,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.langPillText,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {fromLang.name}
            </Text>
            <Text
              style={[
                styles.langNativeSmall,
                { color: colors.mutedForeground },
              ]}
            >
              {fromLang.nativeName}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSwapLanguages}
            style={[
              styles.swapBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="swap-horizontal"
              size={18}
              color={isRecording ? colors.mutedForeground : colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => !isRecording && setToPickerVisible(true)}
            style={[
              styles.langPill,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.langPillText,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {toLang.name}
            </Text>
            <Text
              style={[
                styles.langNativeSmall,
                { color: colors.mutedForeground },
              ]}
            >
              {toLang.nativeName}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mic Section */}
        <View style={styles.micSection}>
          <Animated.View
            style={[
              styles.micGlow,
              { backgroundColor: isRecording ? "#EF4444" : colors.primary },
              glowStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              { borderColor: isRecording ? "#EF4444" : colors.primary },
              pulseStyle,
            ]}
          />

          <TouchableOpacity
            onPress={
              isRecording ? handleStopRecording : handleStartRecording
            }
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={
                isRecording
                  ? ["#EF4444", "#DC2626"]
                  : [colors.primary, colors.accent]
              }
              style={styles.micBtn}
            >
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={36}
                color="#FFF"
              />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.waveformContainer}>
            <WaveformAnimation
              isActive={isRecording}
              primaryColor={colors.primary}
              accentColor={colors.accent}
              height={48}
            />
          </View>

          {/* Status row */}
          <View style={styles.statusRow}>
            {isProcessing && (
              <View
                style={[
                  styles.processingDot,
                  { backgroundColor: colors.accent },
                ]}
              />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: isRecording
                    ? isProcessing
                      ? colors.accent
                      : "#22C55E"
                    : colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {statusText}
            </Text>
          </View>

          {apiError ? (
            <Text
              style={[
                styles.errorText,
                { color: colors.destructive, fontFamily: "Inter_400Regular" },
              ]}
            >
              {apiError}
            </Text>
          ) : null}
        </View>

        {/* Translation Display */}
        {(currentOriginal || currentTranslation) && (
          <View style={styles.translationSection}>
            {/* Original */}
            {currentOriginal ? (
              <View
                style={[
                  styles.translationCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.langBadge,
                      { backgroundColor: colors.secondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.langBadgeText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {fromLang.name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.cardSubLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    Detected speech
                  </Text>
                </View>
                <Text
                  style={[
                    styles.translationText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {currentOriginal}
                </Text>
              </View>
            ) : null}

            {/* Arrow */}
            {showTranslation && (
              <View style={styles.arrowRow}>
                <View
                  style={[styles.arrowLine, { backgroundColor: colors.border }]}
                />
                <View
                  style={[
                    styles.arrowCircle,
                    { backgroundColor: colors.primary + "22" },
                  ]}
                >
                  <Ionicons name="arrow-down" size={14} color={colors.primary} />
                </View>
                <View
                  style={[styles.arrowLine, { backgroundColor: colors.border }]}
                />
              </View>
            )}

            {/* Translation */}
            {showTranslation && currentTranslation ? (
              <LinearGradient
                colors={[colors.primary + "22", colors.accent + "11"]}
                style={[
                  styles.translationCard,
                  { borderColor: colors.primary + "44" },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.langBadge,
                      { backgroundColor: colors.primary + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.langBadgeText,
                        {
                          color: colors.primary,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {toLang.name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.cardSubLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    AI Translation
                  </Text>
                </View>
                <Text
                  style={[
                    styles.translationText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 17,
                    },
                  ]}
                >
                  {currentTranslation}
                </Text>
              </LinearGradient>
            ) : null}
          </View>
        )}

        {/* Info box when idle */}
        {!isRecording && !sessionCode && (
          <View style={styles.infoBox}>
            <Ionicons
              name="mic-circle-outline"
              size={18}
              color={colors.primary}
            />
            <Text
              style={[
                styles.infoText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              Speak naturally — your speech is captured in 5-second segments,
              transcribed by OpenAI Whisper, then instantly translated. Listeners
              can join with the session code.
            </Text>
          </View>
        )}
      </ScrollView>

      <LanguagePickerModal
        visible={fromPickerVisible}
        selectedCode={fromLang.code}
        onSelect={setFromLang}
        onClose={() => setFromPickerVisible(false)}
        title="Speaking Language"
      />
      <LanguagePickerModal
        visible={toPickerVisible}
        selectedCode={toLang.code}
        onSelect={setToLang}
        onClose={() => setToPickerVisible(false)}
        title="Translate To"
      />
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
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18 },
  codeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  codeText: { fontSize: 13, letterSpacing: 0.5 },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
  },
  langPill: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
  langPillText: { fontSize: 14 },
  langNativeSmall: { fontSize: 11 },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  micSection: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 16,
    gap: 16,
  },
  micGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 18,
    opacity: 0,
  },
  pulseRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    top: 41,
    opacity: 0.5,
  },
  micBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  waveformContainer: { marginTop: 4 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  processingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: { fontSize: 14 },
  errorText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  translationSection: {
    paddingHorizontal: 20,
    gap: 0,
    paddingTop: 8,
  },
  translationCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  langBadgeText: { fontSize: 12 },
  cardSubLabel: { fontSize: 12 },
  translationText: { fontSize: 16, lineHeight: 24 },
  arrowRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
    paddingHorizontal: 20,
    gap: 10,
  },
  arrowLine: { flex: 1, height: 1 },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(91,138,245,0.08)",
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
