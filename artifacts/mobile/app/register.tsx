import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

type Step = "details" | "otp";
const OTP_LENGTH = 6;

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { register, verifyOtp, resendOtp } = useAuth();

  const [step, setStep] = useState<Step>("details");

  // Step 1 fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 fields
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const otpInputs = useRef<Array<TextInput | null>>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const speakerCode = username.trim().toUpperCase();

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSubmitDetails = async () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError("");
    const result = await register(username.trim(), email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setStep("otp");
      setInfo(`We sent a 6-digit code to ${email.trim()}`);
      setResendCooldown(30);
      setTimeout(() => otpInputs.current[0]?.focus(), 150);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    setError("");
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Enter the full 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    const result = await verifyOtp(username.trim(), code);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setOtp(Array(OTP_LENGTH).fill(""));
      otpInputs.current[0]?.focus();
    } else {
      router.replace("/(tabs)/");
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setInfo("");
    const result = await resendOtp(username.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setInfo("A new code has been sent.");
      setResendCooldown(30);
      setOtp(Array(OTP_LENGTH).fill(""));
      otpInputs.current[0]?.focus();
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderDetails = () => (
    <>
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

      <View style={styles.form}>
        {/* Username */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            USERNAME
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

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            EMAIL
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v.trim()); setError(""); }}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Password */}
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
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm password */}
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
              onSubmitEditing={handleSubmitDetails}
            />
          </View>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={handleSubmitDetails} disabled={loading} activeOpacity={0.85}>
          <LinearGradient
            colors={loading ? [colors.muted, colors.muted] : [colors.accent, colors.primary]}
            style={styles.submitBtn}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="mail-outline" size={20} color="#FFF" />
                <Text style={[styles.submitBtnText, { fontFamily: "Inter_700Bold" }]}>Send Code</Text>
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
            Already have an account?
          </Text>
          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text style={[styles.switchLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {" "}Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderOtp = () => (
    <>
      <View style={styles.logoArea}>
        <LinearGradient colors={[colors.primary, colors.accent]} style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={30} color="#FFF" />
        </LinearGradient>
        <Text style={[styles.appName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Verify your email
        </Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Enter the 6-digit code we sent to{"\n"}
          <Text style={{ color: colors.foreground }}>{email.trim()}</Text>
        </Text>
      </View>

      {/* OTP boxes */}
      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(el) => { otpInputs.current[i] = el; }}
            value={digit}
            onChangeText={(v) => handleOtpChange(v, i)}
            onKeyPress={(e) => handleOtpKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            style={[
              styles.otpBox,
              {
                backgroundColor: colors.card,
                borderColor: digit ? colors.primary : colors.border,
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
              },
            ]}
          />
        ))}
      </View>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>{error}</Text>
        </View>
      ) : info ? (
        <View style={[styles.infoBox, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "33" }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.errorText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{info}</Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
        <LinearGradient
          colors={loading ? [colors.muted, colors.muted] : [colors.accent, colors.primary]}
          style={styles.submitBtn}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
              <Text style={[styles.submitBtnText, { fontFamily: "Inter_700Bold" }]}>Verify & Create Account</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Didn't get it?
        </Text>
        <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0}>
          <Text
            style={[
              styles.switchLink,
              { color: resendCooldown > 0 ? colors.mutedForeground : colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {resendCooldown > 0 ? ` Resend in ${resendCooldown}s` : " Resend code"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => { setStep("details"); setError(""); setInfo(""); }} style={styles.backLink}>
        <Ionicons name="arrow-back" size={14} color={colors.mutedForeground} />
        <Text style={[styles.switchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {" "}Change details
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <LinearGradient
      colors={[colors.background, "#0D1535", colors.background]}
      style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inner}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {step === "details" ? renderDetails() : renderOtp()}
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
  tagline: { fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 19 },
  previewBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  previewLabel: { fontSize: 13, flex: 1 },
  previewCode: { fontSize: 15, letterSpacing: 1 },
  form: { gap: 14 },
  fieldGroup: { gap: 5 },
  label: { fontSize: 11, letterSpacing: 0.8 },
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
  infoBox: {
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
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingHorizontal: 4 },
  otpBox: {
    flex: 1, aspectRatio: 1, maxWidth: 52,
    borderWidth: 1.5, borderRadius: 14,
    textAlign: "center", fontSize: 24,
  },
  backLink: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4 },
});
