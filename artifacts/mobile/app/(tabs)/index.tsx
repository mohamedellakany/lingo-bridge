import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 24);

  const handleSpeak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (user) {
      router.push("/(tabs)/speaker");
    } else {
      router.push("/login");
    }
  };

  const handleListen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/listener");
  };

  const handleViewConversations = () => {
    setMenuOpen(false);
    router.push("/(tabs)/history");
  };

  const handleLogoutPress = () => {
    setMenuOpen(false);
    setConfirmLogout(true);
  };

  const confirmLogoutYes = async () => {
    setConfirmLogout(false);
    await logout();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Background orbs */}
      <View style={styles.bgOrbs} pointerEvents="none">
        <View style={[styles.orb1, { backgroundColor: colors.primary + "18" }]} />
        <View style={[styles.orb2, { backgroundColor: colors.accent + "12" }]} />
        <View style={[styles.orb3, { backgroundColor: colors.primary + "10" }]} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <LinearGradient colors={[colors.primary, colors.accent]} style={styles.logoMark}>
              <Ionicons name="mic" size={18} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.appName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              LingoBridge
            </Text>
          </View>

          {user ? (
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              style={[styles.userChip, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.userDot, { backgroundColor: colors.primary }]}>
                <Text style={styles.userInitial}>{user.username[0].toUpperCase()}</Text>
              </View>
              <Text style={[styles.userChipText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {user.username}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/login")}
              style={[styles.signInBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.signInBtnText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Sign in
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* User dropdown menu */}
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
            <View
              style={[
                styles.menuCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  top: topPad + 44,
                  right: 20,
                },
              ]}
            >
              {user && (
                <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.menuName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {user.username}
                  </Text>
                  <Text style={[styles.menuSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Speaker ID: {user.speakerCode}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.menuItem} onPress={handleViewConversations}>
                <Ionicons name="chatbubbles-outline" size={18} color={colors.foreground} />
                <Text style={[styles.menuItemText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  My Conversations
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleLogoutPress}>
                <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
                <Text style={[styles.menuItemText, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
                  Log out
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Logout confirmation */}
        <Modal
          visible={confirmLogout}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmLogout(false)}
        >
          <Pressable style={styles.confirmOverlay} onPress={() => setConfirmLogout(false)}>
            <Pressable
              style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.confirmIconWrap, { backgroundColor: colors.destructive + "18" }]}>
                <Ionicons name="log-out-outline" size={26} color={colors.destructive} />
              </View>
              <Text style={[styles.confirmTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Log out?
              </Text>
              <Text style={[styles.confirmDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Are you sure you want to log out of your account?
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmNo, { borderColor: colors.border }]}
                  onPress={() => setConfirmLogout(false)}
                >
                  <Text style={[styles.confirmBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    No
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: colors.destructive }]}
                  onPress={confirmLogoutYes}
                >
                  <Text style={[styles.confirmBtnText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>
                    Yes, log out
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Hero text */}
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Break the{"\n"}
            <Text style={{ color: colors.primary }}>language</Text> barrier
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Real-time voice translation powered by AI.{"\n"}Speak or listen — in any language.
          </Text>
        </View>

        {/* Speaker card */}
        <TouchableOpacity activeOpacity={0.88} onPress={handleSpeak} style={styles.cardOuter}>
          <LinearGradient
            colors={["#1A2E6B", "#0E1F52", "#0B1840"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { borderColor: colors.primary + "55" }]}
          >
            {/* Glow */}
            <View style={[styles.cardGlow, { backgroundColor: colors.primary + "30" }]} />

            <View style={styles.cardContent}>
              <LinearGradient colors={[colors.primary, "#3A6BFF"]} style={styles.cardIconBg}>
                <Ionicons name="mic" size={34} color="#FFF" />
              </LinearGradient>

              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
                  I'm Speaking
                </Text>
                <Text style={[styles.cardDesc, { color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" }]}>
                  Broadcast your voice live.{"\n"}Listeners hear you in their language.
                </Text>
              </View>

              <View style={styles.cardRight}>
                {user ? (
                  <View style={[styles.badge, { backgroundColor: "#22C55E22", borderColor: "#22C55E55" }]}>
                    <View style={[styles.badgeDot, { backgroundColor: "#22C55E" }]} />
                    <Text style={[styles.badgeText, { color: "#22C55E", fontFamily: "Inter_600SemiBold" }]}>
                      {user.speakerCode}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
                    <Ionicons name="person-outline" size={11} color={colors.primary} />
                    <Text style={[styles.badgeText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                      Account needed
                    </Text>
                  </View>
                )}
                <View style={[styles.arrowBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="arrow-forward" size={16} color="#FFF" />
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Listener card */}
        <TouchableOpacity activeOpacity={0.88} onPress={handleListen} style={styles.cardOuter}>
          <LinearGradient
            colors={["#1A1040", "#120C35", "#0E0A2A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { borderColor: colors.accent + "55" }]}
          >
            <View style={[styles.cardGlow, { backgroundColor: colors.accent + "25" }]} />

            <View style={styles.cardContent}>
              <LinearGradient colors={[colors.accent, "#7B4FE0"]} style={styles.cardIconBg}>
                <Ionicons name="headset" size={34} color="#FFF" />
              </LinearGradient>

              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
                  I'm Listening
                </Text>
                <Text style={[styles.cardDesc, { color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" }]}>
                  Join any live session instantly.{"\n"}Read or listen in your language.
                </Text>
              </View>

              <View style={styles.cardRight}>
                <View style={[styles.badge, { backgroundColor: "#22C55E22", borderColor: "#22C55E55" }]}>
                  <Ionicons name="checkmark-circle-outline" size={12} color="#22C55E" />
                  <Text style={[styles.badgeText, { color: "#22C55E", fontFamily: "Inter_500Medium" }]}>
                    No account
                  </Text>
                </View>
                <View style={[styles.arrowBtn, { backgroundColor: colors.accent }]}>
                  <Ionicons name="arrow-forward" size={16} color="#FFF" />
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Use cases */}
        <View style={styles.useCases}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            DESIGNED FOR
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.useCasesRow}
          >
            {[
              { icon: "business", label: "Meetings" },
              { icon: "mic-circle", label: "Conferences" },
              { icon: "school", label: "Education" },
              { icon: "medkit", label: "Healthcare" },
              { icon: "airplane", label: "Tourism" },
              { icon: "headset", label: "Support" },
            ].map((uc) => (
              <View
                key={uc.label}
                style={[styles.useCase, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Ionicons name={uc.icon as any} size={20} color={colors.primary} />
                <Text style={[styles.useCaseLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {uc.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bgOrbs: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  orb1: {
    position: "absolute", width: 300, height: 300, borderRadius: 150,
    top: -80, left: -80,
  },
  orb2: {
    position: "absolute", width: 250, height: 250, borderRadius: 125,
    bottom: 200, right: -60,
  },
  orb3: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    bottom: -40, left: 60,
  },
  scroll: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 20 },
  userChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  userDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  userInitial: { color: "#FFF", fontSize: 11, fontFamily: "Inter_700Bold" } as any,
  userChipText: { fontSize: 13 },
  signInBtn: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  signInBtnText: { fontSize: 13 },
  menuOverlay: { flex: 1 },
  menuCard: {
    position: "absolute",
    minWidth: 220,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  menuHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  menuName: { fontSize: 15 },
  menuSub: { fontSize: 12, marginTop: 2 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: { fontSize: 15 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  confirmTitle: { fontSize: 20 },
  confirmDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  confirmButtons: { flexDirection: "row", gap: 12, marginTop: 14, width: "100%" },
  confirmBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmNo: { borderWidth: 1.5 },
  confirmBtnText: { fontSize: 15 },
  hero: { gap: 10, paddingVertical: 4 },
  heroTitle: { fontSize: 36, lineHeight: 44 },
  heroSub: { fontSize: 14, lineHeight: 22 },
  cardOuter: { borderRadius: 24, overflow: "hidden" },
  card: { borderRadius: 24, borderWidth: 1, padding: 24, overflow: "hidden" },
  cardGlow: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    top: -60, right: -40,
  },
  cardContent: { flexDirection: "row", alignItems: "center", gap: 16 },
  cardIconBg: {
    width: 68, height: 68, borderRadius: 20,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardText: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 20 },
  cardDesc: { fontSize: 13, lineHeight: 19 },
  cardRight: { alignItems: "flex-end", gap: 10, flexShrink: 0 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11 },
  arrowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  useCases: { gap: 12, paddingBottom: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8 },
  useCasesRow: { gap: 10 },
  useCase: {
    alignItems: "center", gap: 7, padding: 14,
    borderRadius: 16, borderWidth: 1, minWidth: 76,
  },
  useCaseLabel: { fontSize: 12 },
});
