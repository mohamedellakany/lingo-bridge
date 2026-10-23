import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, isLoading, changePassword, deleteAccount } = useAuth();

  // Change-password form
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Delete-account confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 20 : 12);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNew) {
      setPwError("Please fill in all fields");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNew) {
      setPwError("New passwords don't match");
      return;
    }
    setPwSaving(true);
    setPwError("");
    setPwSuccess("");
    const res = await changePassword(currentPassword, newPassword);
    setPwSaving(false);
    if (res.error) {
      setPwError(res.error);
    } else {
      setPwSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
      setShowPwForm(false);
    }
  };

  const handleDelete = async () => {
    if (deleteText.trim().toUpperCase() !== "DELETE") {
      setDeleteError('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    setDeleteError("");
    const res = await deleteAccount();
    setDeleting(false);
    if (res.error) {
      setDeleteError(res.error);
    } else {
      setConfirmDelete(false);
      router.replace("/");
    }
  };

  if (isLoading || !user) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.background, "#0D1535", colors.background]}
      style={[styles.root, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Account Settings
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Profile */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{user.username[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.username, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {user.username}
                </Text>
                <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {user.email || "No email on file"}
                </Text>
              </View>
            </View>
            <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Speaker ID
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {user.speakerCode}
              </Text>
            </View>
          </View>

          {/* Change password */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.cardHeaderRow}
              onPress={() => { setShowPwForm((s) => !s); setPwError(""); setPwSuccess(""); }}
            >
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="key-outline" size={18} color={colors.foreground} />
                <Text style={[styles.cardHeaderText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Change Password
                </Text>
              </View>
              <Ionicons name={showPwForm ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            {pwSuccess ? (
              <View style={[styles.msgBox, { backgroundColor: "#22C55E18", borderColor: "#22C55E44" }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" />
                <Text style={[styles.msgText, { color: "#22C55E", fontFamily: "Inter_400Regular" }]}>{pwSuccess}</Text>
              </View>
            ) : null}

            {showPwForm && (
              <View style={styles.form}>
                <Field label="CURRENT PASSWORD" value={currentPassword} onChange={(v) => { setCurrentPassword(v); setPwError(""); }} colors={colors} placeholder="Current password" />
                <Field label="NEW PASSWORD" value={newPassword} onChange={(v) => { setNewPassword(v); setPwError(""); }} colors={colors} placeholder="At least 6 characters" />
                <Field label="CONFIRM NEW PASSWORD" value={confirmNew} onChange={(v) => { setConfirmNew(v); setPwError(""); }} colors={colors} placeholder="Re-enter new password" />

                {pwError ? (
                  <View style={[styles.msgBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                    <Text style={[styles.msgText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>{pwError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity onPress={handleChangePassword} disabled={pwSaving} activeOpacity={0.85}>
                  <LinearGradient colors={pwSaving ? [colors.muted, colors.muted] : [colors.primary, colors.accent]} style={styles.saveBtn}>
                    {pwSaving ? <ActivityIndicator color="#FFF" size="small" /> : (
                      <Text style={[styles.saveBtnText, { fontFamily: "Inter_700Bold" }]}>Update Password</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Danger zone */}
          <View style={styles.dangerZone}>
            <Text style={[styles.dangerLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              DANGER ZONE
            </Text>
            <TouchableOpacity
              style={[styles.rowBtn, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "44" }]}
              onPress={() => { setConfirmDelete(true); setDeleteText(""); setDeleteError(""); }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              <Text style={[styles.rowBtnText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
                Delete my account
              </Text>
            </TouchableOpacity>
            <Text style={[styles.dangerHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Permanently removes your account, sessions, and transcripts. This cannot be undone.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete confirmation */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <Pressable style={styles.overlay} onPress={() => !deleting && setConfirmDelete(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.confirmIcon, { backgroundColor: colors.destructive + "18" }]}>
              <Ionicons name="warning-outline" size={26} color={colors.destructive} />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Delete account?
            </Text>
            <Text style={[styles.confirmDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              This permanently deletes your account and all data. Type{" "}
              <Text style={{ color: colors.destructive, fontFamily: "Inter_700Bold" }}>DELETE</Text> to confirm.
            </Text>
            <TextInput
              value={deleteText}
              onChangeText={(v) => { setDeleteText(v); setDeleteError(""); }}
              placeholder="DELETE"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.deleteInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
            />
            {deleteError ? (
              <Text style={[styles.deleteErr, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>{deleteError}</Text>
            ) : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmCancel, { borderColor: colors.border }]}
                onPress={() => !deleting && setConfirmDelete(false)}
              >
                <Text style={[styles.confirmBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.destructive }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <Text style={[styles.confirmBtnText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

function Field({
  label,
  value,
  onChange,
  colors,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 10 }} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={!show}
          style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
        />
        <TouchableOpacity onPress={() => setShow((s) => !s)} style={{ padding: 4 }}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontSize: 22, fontFamily: "Inter_700Bold" } as any,
  username: { fontSize: 18 },
  sub: { fontSize: 13, marginTop: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 14 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 14, letterSpacing: 0.5 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderText: { fontSize: 15 },
  form: { gap: 12 },
  fieldGroup: { gap: 5 },
  label: { fontSize: 11, letterSpacing: 0.8 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 13 },
  saveBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", justifyContent: "center", marginTop: 2 },
  saveBtnText: { fontSize: 15, color: "#FFF" },
  msgBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  msgText: { flex: 1, fontSize: 13, lineHeight: 18 },
  rowBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 15,
  },
  rowBtnText: { fontSize: 15 },
  dangerZone: { gap: 10, marginTop: 8 },
  dangerLabel: { fontSize: 11, letterSpacing: 0.8 },
  dangerHint: { fontSize: 12, lineHeight: 17 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 32 },
  confirmCard: { width: "100%", maxWidth: 360, borderRadius: 22, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  confirmTitle: { fontSize: 20 },
  confirmDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  deleteInput: { width: "100%", borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, textAlign: "center", letterSpacing: 2, marginTop: 6 },
  deleteErr: { fontSize: 13 },
  confirmButtons: { flexDirection: "row", gap: 12, marginTop: 10, width: "100%" },
  confirmBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  confirmCancel: { borderWidth: 1.5 },
  confirmBtnText: { fontSize: 15 },
});
