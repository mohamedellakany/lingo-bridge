import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const speakerCode = username.trim().toUpperCase();

  const handleRegister = async () => {
    if (!username.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError("");
    const result = await register(username.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace("/(tabs)/");
    }
  };

  return (
    <LinearGradient
      colors={[colors.background, "#0D1535", colors.background]}
      style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Logo */}
          <View style={styles.logoArea}>
            <LinearGradient colors={[colors.primary, colors.accent]} style={styles.logoCircle}>
              <Ionicons name="mic" size={30} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.appName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Create Account
            </Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Your username becomes your permanent speaker ID
            </Text>
          </View>

          {/* Speaker code preview */}
          {username.trim().length >= 3 && (
            <View style={[styles.previewBox, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
              <Ionicons name="radio-outline" size={16} color={colors.primary} />
              <Text style={[styles.previewLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Your speaker ID will be:
              </Text>
              <Text style={[styles.previewCode, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {speakerCode}
              </Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                USERNAME
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                3–20 characters. Letters, numbers, underscores only.
              </Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  value={username}
                  onChangeText={(v) => { setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(""); }}
                  placeholder="your_username"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                PASSWORD
              </Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                CONFIRM PASSWORD
              </Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(""); }}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={loading ? [colors.muted, colors.muted] : [colors.accent, colors.primary]}
                style={styles.submitBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={20} color="#FFF" />
                    <Text style={[styles.submitBtnText, { fontFamily: "Inter_700Bold" }]}>Create Account</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Already have an account?
              </Text>
              <TouchableOpacity onPress={() => router.replace("/login")}>
                <Text style={[styles.switchLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  {" "}Sign in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, gap: 20 },
  logoArea: { alignItems: "center", gap: 10, paddingVertical: 8 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 22 },
  tagline: { fontSize: 13, textAlign: "center", maxWidth: 260 },
  previewBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  previewLabel: { fontSize: 13, flex: 1 },
  previewCode: { fontSize: 15, letterSpacing: 1 },
  form: { gap: 14 },
  fieldGroup: { gap: 5 },
  label: { fontSize: 11, letterSpacing: 0.8 },
  hint: { fontSize: 11, lineHeight: 16 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 16, paddingVertical: 17, marginTop: 4,
  },
  submitBtnText: { fontSize: 17, color: "#FFF" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 14 },
  switchLink: { fontSize: 14 },
});
