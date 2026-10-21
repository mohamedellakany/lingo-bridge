import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(username.trim(), password);
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
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            style={styles.logoCircle}
          >
            <Ionicons name="mic" size={36} color="#FFF" />
          </LinearGradient>
          <Text style={[styles.appName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            LingoBridge
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Live voice translation, across languages
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={[styles.formTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Sign in
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              USERNAME
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                value={username}
                onChangeText={(v) => { setUsername(v); setError(""); }}
                placeholder="username"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                autoCapitalize="none"
                autoCorrect={false}
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
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            <LinearGradient
              colors={loading ? [colors.muted, colors.muted] : [colors.primary, colors.accent]}
              style={styles.submitBtn}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#FFF" />
                  <Text style={[styles.submitBtnText, { fontFamily: "Inter_700Bold" }]}>Sign In</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <GoogleSignInButton
            onError={setError}
            onSuccess={() => router.replace("/(tabs)/")}
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={() => router.replace("/register")}>
              <Text style={[styles.switchLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                {" "}Create one
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 32 },
  logoArea: { alignItems: "center", gap: 12 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 28 },
  tagline: { fontSize: 14, textAlign: "center" },
  form: { gap: 16 },
  formTitle: { fontSize: 22, marginBottom: 4 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 11, letterSpacing: 0.8 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, paddingVertical: 15 },
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
