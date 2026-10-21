import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

// Required so the auth popup/redirect can close and return to the app.
WebBrowser.maybeCompleteAuthSession();

// Client IDs are supplied via env. Each platform needs its own (see setup docs).
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

const isConfigured = Boolean(WEB_CLIENT_ID || IOS_CLIENT_ID || ANDROID_CLIENT_ID);

interface Props {
  onError?: (message: string) => void;
  onSuccess?: () => void;
}

export function GoogleSignInButton(props: Props) {
  // IMPORTANT: only mount the inner component (which calls the Google auth
  // hook) when client IDs are actually configured. Calling the hook with no
  // config throws and would crash the whole screen. When unconfigured we
  // render nothing, so the hook never runs.
  if (!isConfigured) return null;
  return <GoogleSignInButtonInner {...props} />;
}

function GoogleSignInButtonInner({ onError, onSuccess }: Props) {
  const colors = useColors();
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === "success") {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        setBusy(false);
        onError?.("Google did not return a token. Please try again.");
        return;
      }
      loginWithGoogle(idToken).then((res) => {
        setBusy(false);
        if (res.error) onError?.(res.error);
        else onSuccess?.();
      });
    } else if (response.type === "error") {
      setBusy(false);
      onError?.("Google sign-in was cancelled or failed.");
    } else if (response.type === "dismiss" || response.type === "cancel") {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const handlePress = async () => {
    setBusy(true);
    onError?.("");
    try {
      await promptAsync();
    } catch {
      setBusy(false);
      onError?.("Could not start Google sign-in.");
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          or
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>

      <TouchableOpacity
        onPress={handlePress}
        disabled={!request || busy}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.foreground} size="small" />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color="#EA4335" />
            <Text style={[styles.btnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Continue with Google
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 15,
  },
  btnText: { fontSize: 16 },
});
