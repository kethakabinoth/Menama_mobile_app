import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import {
  Calendar,
  Check,
  Eye,
  Filter,
  RefreshCcw,
  X,
  ArrowLeft,
  Search,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../services/api";

// ── Design tokens ────────────────────────────────────────────
const G = {
  dark:   "#1B5E3B",
  mid:    "#2E7D32",
  base:   "#388E3C",
  light:  "#C8E6C9",
  pale:   "#E8F5E9",
  faint:  "#F6FFF7",
  white:  "#FFFFFF",
  offwhite: "#F4F9F5",
  text:   "#1A1A1A",
  sub:    "#6B6B6B",
  muted:  "#9E9E9E",
  border: "#D8EDD9",
  red:    "#C62828",
  redPale:"#FFEBEE",
  redBorder:"#FFCDD2",
};

export default function CostingsScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [webDateInput, setWebDateInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Ready" | "Approved" | "Rejected">("All");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const applyFilter = useCallback((data: any[]) => {
    let filtered = data;
    if (searchText.trim()) {
      const query = searchText.toLowerCase().trim();
      filtered = filtered.filter(
        (o) =>
          `${o.S_Order ?? ""}`.toLowerCase().includes(query) ||
          `${o.Customer_Name ?? ""}`.toLowerCase().includes(query) ||
          `${o.Item_Name ?? ""}`.toLowerCase().includes(query),
      );
    }
    if (dateFilter) {
      const dateString = dateFilter.toISOString().split("T")[0];
      filtered = filtered.filter((o) =>
        `${o.Tr_Date ?? o.Date ?? ""}`.includes(dateString),
      );
    }
    if (categoryFilter !== "All") {
      const cat = categoryFilter.toLowerCase().trim();
      filtered = filtered.filter((o) => {
        const status = (o.Costing_Status || "").toLowerCase().trim();
        if (cat === "ready") {
          return status !== "approved" && status !== "rejected";
        }
        return status === cat;
      });
    }
    setFilteredOrders(filtered);
  }, [searchText, dateFilter, categoryFilter]);

  const fetchCostings = useCallback(async () => {
    try {
      const response = await api.get("/costings");
      setOrders(response.data);
      applyFilter(response.data);
    } catch (error) {
      console.error("Fetch Costings Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyFilter]);

  useEffect(() => { applyFilter(orders); }, [orders, applyFilter]);
  useFocusEffect(useCallback(() => { fetchCostings(); }, [fetchCostings]));

  const groupOrders = (oList: any[]) => {
    const groups: { [key: string]: any } = {};
    oList.forEach((item) => {
      const key = item.S_Order;
      if (!groups[key]) {
        groups[key] = {
          S_Order: item.S_Order,
          Item_Name: item.Item_Name,
          Customer_Name: item.Customer_Name,
          Costing_Status: item.Costing_Status,
          materials: [],
          total: 0,
          id: item.ID,
        };
      }
      groups[key].materials.push(item);
      groups[key].total += Number(item.Total) || 0;
    });
    return Object.values(groups);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setDateFilter(selectedDate);
    }
  };

  const handleWebDateFilter = () => {
    if (webDateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = webDateInput.split("-").map(Number);
      setDateFilter(new Date(year, month - 1, day));
      setShowDatePicker(false);
    } else if (!webDateInput) {
      setDateFilter(null);
      setShowDatePicker(false);
    } else {
      Alert.alert("Invalid Date", "Please use YYYY-MM-DD format");
    }
  };

  const clearAllFilters = () => {
    setSearchText("");
    setDateFilter(null);
    setWebDateInput("");
    setCategoryFilter("All");
  };

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setActionLoading(true);
    try {
      await api.put(`/costings/${id}/${action}`);
      Alert.alert("Success", `Costing ${action}ed`);
      await fetchCostings();
      setModalVisible(false);
    } catch {
      Alert.alert("Error", `Failed to ${action} costing`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `LKR ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardAccent} />
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderNo}>{item.S_Order}</Text>
          <Text style={styles.itemNameBold}>{item.Item_Name}</Text>
        </View>
        <View style={styles.costingReadyBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.costingReadyText}>Costing Ready</Text>
        </View>
      </View>

      <View style={styles.cardInfoRow}>
        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>CUSTOMER</Text>
          <Text style={styles.infoValue}>{item.Customer_Name}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerTotalLabel}>Group Total</Text>
        <Text style={[styles.footerTotalValue, { color: G.dark }]}>
          {formatCurrency(item.total)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => {
          setSelectedOrder(item);
          setModalVisible(true);
        }}
      >
        <Eye size={16} color={G.white} />
        <Text style={styles.viewButtonText}>View Details</Text>
      </TouchableOpacity>
    </View>
  );

  const groupedFilteredOrders = groupOrders(filteredOrders);
  const hasAnyFilter = searchText || dateFilter;

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={G.dark} />
        <Text style={{ color: G.muted, marginTop: 10, fontSize: 13 }}>Loading costings…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={G.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Costings</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.filterBanner}>
        <View style={styles.bannerInfo}>
          <Filter size={18} color={G.dark} />
          <Text style={styles.bannerTitle}>Review List</Text>
        </View>
        {!!hasAnyFilter ? (
          <TouchableOpacity style={styles.resetBtn} onPress={clearAllFilters}>
            <RefreshCcw size={14} color={G.white} />
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color={G.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order, customer or product..."
            placeholderTextColor={G.muted}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={18} color={G.dark} />
        </TouchableOpacity>
      </View>

      {dateFilter && (
        <View style={styles.activeDateBadge}>
          <Text style={styles.activeDateText}>📅 {dateFilter.toISOString().split("T")[0]}</Text>
          <TouchableOpacity onPress={() => setDateFilter(null)}>
            <X size={14} color={G.dark} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.categoryRow}>
        {["All", "Ready", "Approved", "Rejected"].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, categoryFilter === cat && styles.categoryChipActive]}
            onPress={() => setCategoryFilter(cat as any)}
          >
            <Text style={[styles.categoryChipText, categoryFilter === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showDatePicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={dateFilter || new Date()}
          mode="date"
          onChange={onDateChange}
        />
      )}

      <Modal transparent visible={showDatePicker && Platform.OS === "web"} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.webDatePickerContent}>
            <Text style={styles.webDatePickerTitle}>Set Date Filter</Text>
            <TextInput
              style={styles.webDateInput}
              placeholder="YYYY-MM-DD"
              value={webDateInput}
              onChangeText={setWebDateInput}
              autoFocus
            />
            <View style={styles.webModalActionRow}>
              <TouchableOpacity style={[styles.webModalBtn, { backgroundColor: G.faint }]} onPress={() => setShowDatePicker(false)}>
                <Text style={{ color: G.dark, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.webModalBtn, { backgroundColor: G.dark }]} onPress={handleWebDateFilter}>
                <Text style={{ color: G.white, fontWeight: "600" }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={groupedFilteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
        renderItem={renderItem}
        keyExtractor={(item) => item.S_Order}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[G.dark]}
            tintColor={G.dark}
            onRefresh={() => { setRefreshing(true); fetchCostings(); }}
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Filter size={32} color={G.light} />
            </View>
            <Text style={styles.emptyTitle}>No costings found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters</Text>
            {!!hasAnyFilter && (
              <TouchableOpacity onPress={clearAllFilters} style={styles.clearFiltersBtn}>
                <Text style={styles.clearFiltersBtnText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={
          groupedFilteredOrders.length > ITEMS_PER_PAGE ? (
            <View style={styles.paginationControls}>
              <TouchableOpacity
                disabled={currentPage === 1}
                onPress={() => setCurrentPage((p) => p - 1)}
                style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
              >
                <Text style={styles.pageButtonText}>← Prev</Text>
              </TouchableOpacity>
              <Text style={styles.paginationText}>{currentPage} / {Math.ceil(groupedFilteredOrders.length / ITEMS_PER_PAGE)}</Text>
              <TouchableOpacity
                disabled={currentPage >= Math.ceil(groupedFilteredOrders.length / ITEMS_PER_PAGE)}
                onPress={() => setCurrentPage((p) => p + 1)}
                style={[styles.pageButton, currentPage >= Math.ceil(groupedFilteredOrders.length / ITEMS_PER_PAGE) && styles.pageButtonDisabled]}
              >
                <Text style={styles.pageButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* ── Modal ──────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.mainModalOverlay}>
          <View style={styles.mainModalContent}>

            {/* Green header */}
            <View style={styles.modalGreenHeader}>
              <View style={styles.decorCircle1} />
              <View style={styles.decorCircle2} />

              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Costing Details</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                  <X size={16} color={G.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalInfoCard}>
                <Text style={styles.modalInfoLabel}>ORDER</Text>
                <Text style={styles.modalInfoValue}>{selectedOrder?.S_Order}</Text>

                <Text style={styles.modalInfoLabel}>CUSTOMER</Text>
                <Text style={styles.modalInfoValue}>{selectedOrder?.Customer_Name}</Text>

                <View style={styles.modalDivider} />

                <Text style={styles.modalAmountLabel}>GROUP TOTAL</Text>
                <Text style={styles.modalAmount}>{formatCurrency(selectedOrder?.total || 0)}</Text>
              </View>
            </View>

            {/* White body */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Materials</Text>
              <View style={styles.materialTableModal}>
                <View style={styles.materialTableHeader}>
                  <Text style={[styles.tableHead, { flex: 2 }]}>Material</Text>
                  <Text style={[styles.tableHead, { flex: 1, textAlign: "center" }]}>Rate</Text>
                  <Text style={[styles.tableHead, { flex: 1, textAlign: "center" }]}>Qty</Text>
                  <Text style={[styles.tableHead, { flex: 1.5, textAlign: "right" }]}>Total</Text>
                </View>
                {selectedOrder?.materials?.map((mat: any, idx: number) => (
                  <View key={idx} style={styles.materialRow}>
                    <Text style={[styles.matText, { flex: 2 }]}>{mat.Material_Name}</Text>
                    <Text style={[styles.matText, { flex: 1, textAlign: "center" }]}>{Number(mat.Rate).toFixed(0)}</Text>
                    <Text style={[styles.matText, { flex: 1, textAlign: "center" }]}>{mat.Qty}</Text>
                    <Text style={[styles.matText, { flex: 1.5, textAlign: "right", color: G.dark, fontWeight: "700" }]}>
                      {Number(mat.Total).toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.awaitingNotice}>
                <View style={styles.awaitingDot} />
                <Text style={styles.awaitingText}>Awaiting your approval to proceed</Text>
              </View>
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.approveBtn, actionLoading && { opacity: 0.6 }]}
                disabled={actionLoading}
                onPress={() => handleAction(selectedOrder?.id, "approve")}
              >
                {actionLoading ? (
                  <ActivityIndicator color={G.white} size="small" />
                ) : (
                  <>
                    <Check size={18} color={G.white} />
                    <Text style={styles.btnText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rejectBtn, actionLoading && { opacity: 0.6 }]}
                disabled={actionLoading}
                onPress={() => handleAction(selectedOrder?.id, "reject")}
              >
                <X size={18} color={G.red} />
                <Text style={[styles.btnText, { color: G.red }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.offwhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 52 : 22,
    paddingBottom: 14,
    backgroundColor: G.dark,
  },
  backButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 19, fontWeight: "700", color: G.white, letterSpacing: 0.3 },

  filterBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: G.white,
    borderBottomWidth: 1,
    borderBottomColor: G.border,
  },
  bannerInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: G.text },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: G.dark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
  },
  resetBtnText: { color: G.white, fontWeight: "600", fontSize: 12 },

  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    alignItems: "center",
    flexDirection: "row",
  },
  searchInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: G.white, height: 44, borderRadius: 12,
    paddingHorizontal: 12, borderWidth: 1, borderColor: G.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: G.text },
  dateBtn: {
    width: 44, height: 44, backgroundColor: G.white,
    borderRadius: 12, borderWidth: 1, borderColor: G.border,
    alignItems: "center", justifyContent: "center",
  },

  activeDateBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: G.pale, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: G.light,
  },
  activeDateText: { fontSize: 12, color: G.dark, fontWeight: "500" },

  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: G.white, borderWidth: 1, borderColor: G.light,
    alignItems: "center",
  },
  categoryChipActive: { backgroundColor: G.pale, borderColor: G.light },
  categoryChipText: { fontSize: 11, fontWeight: "600", color: G.dark },
  categoryChipTextActive: { color: G.dark },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: G.white, marginBottom: 14,
    borderRadius: 18, overflow: "hidden",
    borderBlockColor: G.dark, borderWidth: 2, borderColor: G.border,
    shadowColor: G.dark, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardAccent: { height: 4, backgroundColor: G.dark },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", padding: 14, paddingBottom: 10,
  },
  orderNo: { fontSize: 15, fontWeight: "700", color: G.text },
  itemNameBold: { fontSize: 14, color: G.sub, marginTop: 2,fontWeight: "700" },
  costingReadyBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: G.pale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: G.light,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: G.base },
  costingReadyText: { color: G.dark, fontSize: 9, fontWeight: "700" },

  cardInfoRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: G.faint, marginHorizontal: 14, marginBottom: 12,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: G.border,
  },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 12, color: G.sub, fontWeight: "700", marginBottom: 3 },
  infoValue: { fontSize: 13, fontWeight: "700", color: G.text },

  cardFooter: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: G.border, marginBottom: 12,
  },
  footerTotalLabel: { fontSize: 13, color: G.sub, fontWeight: "500" },
  footerTotalValue: { fontSize: 15, fontWeight: "700", color: G.text },

  viewButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: G.dark, marginHorizontal: 14, marginBottom: 14,
    paddingVertical: 11, borderRadius: 12, gap: 7,
  },
  viewButtonText: { color: G.white, fontWeight: "700", fontSize: 13 },

  emptyContainer: { alignItems: "center", marginTop: 80 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: G.pale, alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: G.text, marginBottom: 4 },
  emptyText: { color: G.muted, fontSize: 13, marginBottom: 12 },
  clearFiltersBtn: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: G.pale, borderRadius: 8 },
  clearFiltersBtnText: { color: G.dark, fontWeight: "600", fontSize: 12 },

  paginationControls: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 16,
  },
  paginationText: { fontSize: 13, color: G.sub, fontWeight: "500" },
  pageButton: {
    backgroundColor: G.dark, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  pageButtonDisabled: { backgroundColor: G.light },
  pageButtonText: { color: G.white, fontWeight: "600", fontSize: 13 },

  // ── Modal ────────────────────────────────────────────────────
  mainModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  mainModalContent: {
    backgroundColor: G.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "88%", overflow: "hidden",
  },

  modalGreenHeader: {
    backgroundColor: G.dark,
    paddingTop: 20, paddingHorizontal: 18, paddingBottom: 22,
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)", top: -30, right: -20,
  },
  decorCircle2: {
    position: "absolute", width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: -25, right: 30,
  },
  modalHeaderRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: G.white, flex: 1 },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },

  modalInfoCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16, padding: 14,
  },
  modalInfoLabel: {
    fontSize: 15, color: "rgba(231, 237, 109, 0.92)",
    fontWeight: "800", letterSpacing: 0.4, marginBottom: 2,
  },
  modalInfoValue: { fontSize: 18, fontWeight: "600", color: G.white, marginBottom: 8 },
  modalDivider: { height: 0.5, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 10 },
  modalAmountLabel: {
    fontSize: 15, color: "rgba(231, 237, 109, 0.92)",
    fontWeight: "800", letterSpacing: 0.4, marginBottom: 3,
  },
  modalAmount: { fontSize: 26, fontWeight: "700", color: G.white },

  modalScroll: { paddingHorizontal: 18, paddingTop: 16 },
  sectionTitle: {
    fontSize: 15, fontWeight: "700", color: G.dark,
    marginBottom: 10,
  },

  materialTableModal: {
    backgroundColor: G.faint, borderRadius: 14,
    borderWidth: 1, borderColor: G.border,
    padding: 14, marginBottom: 14,
  },
  materialTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: G.border,
    paddingBottom: 8, marginBottom: 8,
  },
  tableHead: { fontSize: 13, fontWeight: "700", color: G. sub},
  materialRow: { flexDirection: "row", paddingVertical: 8 },
  matText: { fontSize: 12, color: G.text, fontWeight: "500" },

  awaitingNotice: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: G.redPale, borderRadius: 10,
    borderWidth: 1, borderColor: G.red,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 8,
  },
  awaitingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: G.red },
  awaitingText: { fontSize: 12, color: G.red, fontWeight: "500", flex: 1 },

  actionRow: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 18, paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    borderTopWidth: 1, borderTopColor: G.border,
    backgroundColor: G.white,
  },
  approveBtn: {
    flex: 2, height: 52, borderRadius: 14,
    backgroundColor: G.dark, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  rejectBtn: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: G.white,
    borderWidth: 1, borderColor: G.redBorder,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnText: { color: G.white, fontWeight: "700", fontSize: 14 },

  webDatePickerContent: {
    backgroundColor: G.white,
    borderRadius: 20,
    padding: 25,
    marginHorizontal: 16,
  },
  webDatePickerTitle: { fontSize: 16, fontWeight: "700", color: G.text, textAlign: "center", marginBottom: 16 },
  webDateInput: {
    borderWidth: 1, borderColor: G.border, borderRadius: 10,
    padding: 12, fontSize: 14, marginVertical: 16, textAlign: "center",
    color: G.text,
  },
  webModalActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  webModalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center",
  },
});