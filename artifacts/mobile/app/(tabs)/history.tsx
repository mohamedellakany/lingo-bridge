import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Session, useSession } from "@/context/SessionContext";
import { useColors } from "@/hooks/useColors";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionItem({
  session,
  colors,
  onPress,
  onDelete,
}: {
  session: Session;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
  onDelete: () => void;
}) {
  const duration =
    session.endedAt && session.createdAt
      ? Math.round((session.endedAt - session.createdAt) / 1000 / 60)
      : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.item,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemLeft}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: session.isActive ? "#22C55E" : colors.mutedForeground },
            ]}
          />
          <Text
            style={[
              styles.itemCode,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {session.code}
          </Text>
          {session.isActive && (
            <View style={[styles.liveTag, { backgroundColor: "#22C55E22" }]}>
              <Text style={[styles.liveTagText, { color: "#22C55E", fontFamily: "Inter_600SemiBold" }]}>
                LIVE
              </Text>
            </View>
          )}
        </View>
        <View style={styles.itemHeaderRight}>
          <Text
            style={[
              styles.itemDate,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {formatDate(session.createdAt)}
          </Text>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.langRow}>
        <View style={[styles.langChip, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.langChipText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {session.fromLangName}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />
        <View style={[styles.langChip, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.langChipText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            {session.toLangName}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.statText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {session.translations.length} phrases
          </Text>
        </View>
        {duration !== null && (
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {duration > 0 ? `${duration} min` : "< 1 min"}
            </Text>
          </View>
        )}
      </View>

      {session.translations.length > 0 && (
        <View style={[styles.sampleBox, { backgroundColor: colors.muted }]}>
          <Text
            style={[
              styles.sampleText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
            numberOfLines={2}
          >
            "{session.translations[0].original}"
          </Text>
        </View>
      )}

      <View style={[styles.viewRow, { borderTopColor: colors.border }]}>
        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
        <Text style={[styles.viewText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
          View transcript
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { sessions, refreshSessions, deleteSession, clearAllSessions } = useSession();

  // Which session is pending deletion (null = none). "ALL" = clear everything.
  const [pendingDelete, setPendingDelete] = useState<Session | "ALL" | null>(null);

  useEffect(() => {
    refreshSessions();
  }, []);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 12;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const confirmDelete = async () => {
    if (pendingDelete === "ALL") {
      await clearAllSessions();
    } else if (pendingDelete) {
      await deleteSession(pendingDelete.id);
    }
    setPendingDelete(null);
    refreshSessions();
  };

  const isClearAll = pendingDelete === "ALL";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Session History
        </Text>
        {sessions.length > 0 ? (
          <TouchableOpacity onPress={() => setPendingDelete("ALL")} style={styles.backBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <FlatList<Session>
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          sessions.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <SessionItem
            session={item}
            colors={colors}
            onPress={() => router.push(`/session/${encodeURIComponent(item.id)}`)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={56} color={colors.mutedForeground} />
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              No sessions yet
            </Text>
            <Text
              style={[
                styles.emptyDesc,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Your past speaker sessions will appear here after you start speaking
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/speaker")}
              style={[styles.startBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="mic" size={18} color="#FFF" />
              <Text style={[styles.startBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                Start Speaking
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Delete confirmation */}
      <Modal
        visible={pendingDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setPendingDelete(null)}>
          <Pressable
            style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.confirmIconWrap, { backgroundColor: colors.destructive + "18" }]}>
              <Ionicons name="trash-outline" size={26} color={colors.destructive} />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {isClearAll ? "Delete all sessions?" : "Delete this session?"}
            </Text>
            <Text style={[styles.confirmDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {isClearAll
                ? "This permanently removes all saved conversations. This cannot be undone."
                : "This permanently removes this conversation and its transcript. This cannot be undone."}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmNo, { borderColor: colors.border }]}
                onPress={() => setPendingDelete(null)}
              >
                <Text style={[styles.confirmBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.destructive }]}
                onPress={confirmDelete}
              >
                <Text style={[styles.confirmBtnText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>
                  {isClearAll ? "Delete all" : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  emptyList: { flex: 1, justifyContent: "center" },
  item: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  deleteBtn: { padding: 2 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  itemCode: { fontSize: 16, letterSpacing: 0.5 },
  liveTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveTagText: { fontSize: 10, letterSpacing: 0.5 },
  itemDate: { fontSize: 12 },
  langRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  langChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  langChipText: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 16 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  statText: { fontSize: 12 },
  sampleBox: { borderRadius: 10, padding: 12 },
  sampleText: { fontSize: 13, lineHeight: 19, fontStyle: "italic" },
  viewRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderTopWidth: 1, paddingTop: 12, marginTop: 2,
  },
  viewText: { fontSize: 13, flex: 1 },
  emptyContainer: { alignItems: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 20, marginTop: 8 },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  startBtnText: { color: "#FFF", fontSize: 15 },
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
  confirmTitle: { fontSize: 20, textAlign: "center" },
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
});
