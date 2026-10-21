import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const topPad = insets.top + (Platform.OS === "web" ? 20 : 12);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Privacy Policy
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.updated, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Last updated: October 2026
        </Text>

        <Section title="Overview" colors={colors}>
          LingoBridge provides real-time voice translation. This policy explains what we
          collect, why, and your choices. By using the app you agree to this policy.
        </Section>

        <Section title="Information we collect" colors={colors}>
          • Account details you provide: username, email, and a securely hashed password.{"\n"}
          • Audio you record while speaking, which is sent to our translation provider to
          produce text and translations.{"\n"}
          • Session transcripts (original and translated text) so you can review past
          conversations.
        </Section>

        <Section title="How we use your information" colors={colors}>
          We use your data to operate the service: authenticate you, transcribe and translate
          speech, deliver translations to listeners, and let you review your history. We do not
          sell your personal data.
        </Section>

        <Section title="Voice and transcript data" colors={colors}>
          Audio is processed to generate translations. Transcripts are stored so you can revisit
          them and can be deleted by you at any time from your conversation history.
        </Section>

        <Section title="Third-party processing" colors={colors}>
          Speech-to-text and translation are performed by a third-party AI provider. Audio and
          text are transmitted to that provider solely to perform the translation.
        </Section>

        <Section title="Data retention and deletion" colors={colors}>
          You can delete individual sessions or clear all history in the app. Deleting your
          account removes your personal data associated with it.
        </Section>

        <Section title="Security" colors={colors}>
          Passwords are hashed with bcrypt and never stored in plain text. Access tokens expire.
          We apply reasonable safeguards, though no system is perfectly secure.
        </Section>

        <Section title="Contact" colors={colors}>
          Questions about this policy? Contact the app operator at the support address provided
          in your app store listing.
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
        {title}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {children}
      </Text>
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
  scroll: { paddingHorizontal: 22, paddingTop: 4, gap: 18 },
  updated: { fontSize: 12 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 16 },
  body: { fontSize: 14, lineHeight: 22 },
});
