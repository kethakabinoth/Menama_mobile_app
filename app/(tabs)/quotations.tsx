import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import {
  Calendar,
  Check,
  Eye,
  Filter,
  RefreshCcw,
  User,
  X,
  ArrowLeft
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

export default function QuotationsScreen() {
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
  const [categoryFilter, setCategoryFilter] = useState<
    "All" | "Ready" | "Approved" | "Rejected"
  >("All");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const applyFilter = useCallback(
    (data: any[]) => {
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
          // Check both spelled variations just in case, and normalize
          const status = (o.Quatation_Status || o.Quotation_Status || "")
            .toLowerCase()
            .trim();

          if (cat === "ready") {
            // "Ready" means it's not finalized yet.
            // So it MUST NOT be approved and MUST NOT be rejected.
            return status !== "approved" && status !== "rejected";
          }

          return status === cat;
        });
      }

      setFilteredOrders(filtered);
    },
    [searchText, dateFilter, categoryFilter],
  );

  const fetchQuotations = useCallback(async () => {
    try {
      const response = await api.get("/quotations");
      setOrders(response.data);
      applyFilter(response.data);
    } catch (error) {
      console.error("Fetch Quotations Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyFilter]);

  useEffect(() => {
    applyFilter(orders);
  }, [orders, applyFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchQuotations();
    }, [fetchQuotations]),
  );

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
      await api.put(`/quotations/${id}/${action}`);
      Alert.alert("Success", `Quotation ${action}ed`);
      await fetchQuotations();
      setModalVisible(false);
    } catch {
      Alert.alert("Error", `Failed to ${action} quotation`);
    } finally {
      setActionLoading(false);
    }
  };

  const groupQuotations = (qList: any[]) => {
    const groups: { [key: string]: any } = {};
    qList.forEach((item) => {
      const key = item.S_Order;
      if (!groups[key]) {
        groups[key] = {
          S_Order: item.S_Order,
          Customer_Name: item.Customer_Name,
          Quatation_Status: item.Quatation_Status,
          Tr_Date: item.Tr_Date,
          items: [],
          total: 0,
          id: item.ID,
        };
      }
      groups[key].items.push(item);
      groups[key].total += Number(item.Rate) || 0;
    });
    return Object.values(groups);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatCurrency = (amount: number) => {
    return `LKR ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNo}>{item.S_Order}</Text>
        <View style={styles.readyBadge}>
          <Text style={styles.readyBadgeText}>Quotation Ready</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.customerRow}>
          <User size={14} color="#8E8E93" />
          <Text style={styles.customerText}>{item.Customer_Name}</Text>
        </View>
        <Text style={[styles.dateTextBottom, { marginTop: 8 }]}>
          Ordered on: {formatDate(item.Tr_Date)}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerTotalLabel}>Total Amount</Text>
        <Text style={styles.rateText}>{formatCurrency(item.total)}</Text>
      </View>

      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => {
          setSelectedOrder(item);
          setModalVisible(true);
        }}
      >
        <Eye size={18} color="#007AFF" />
        <Text style={styles.viewButtonText}>View Details</Text>
      </TouchableOpacity>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase().trim()) {
      case "approved":
        return "#4CD964";
      case "ready":
        return "#FF9500";
      case "rejected":
        return "#FF3B30";
      default:
        return "#8E8E93";
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const hasAnyFilter = searchText || dateFilter;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quotations List</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.filterBanner}>
        <View style={styles.bannerInfo}>
          <Filter size={20} color="#007AFF" />
          <Text style={styles.bannerTitle}>Review List</Text>
        </View>
        {!!hasAnyFilter ? (
          <TouchableOpacity style={styles.showAllBtn} onPress={clearAllFilters}>
            <RefreshCcw size={16} color="white" />
            <Text style={styles.showAllBtnText}>Reset</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search order, customer or product..."
            placeholderTextColor="#3c4041af"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={18} color="#007AFF" />
            <Text style={styles.dateText}>
              {dateFilter
                ? `Date: ${dateFilter.toISOString().split("T")[0]}`
                : "Filter by Date (Calendar)"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categoryRow}>
          {["All", "Ready", "Approved", "Rejected"].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                categoryFilter === cat && styles.categoryChipActive,
              ]}
              onPress={() => setCategoryFilter(cat as any)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  categoryFilter === cat && styles.categoryChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showDatePicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={dateFilter || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      {/* Web Date Picker Fallback */}
      <Modal
        transparent
        visible={showDatePicker && Platform.OS === "web"}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.webDatePickerContent}>
            <Text style={styles.modalTitle}>Set Date Filter</Text>
            <TextInput
              style={styles.webDateInput}
              placeholder="YYYY-MM-DD"
              value={webDateInput}
              onChangeText={setWebDateInput}
              autoFocus
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.modalBtnTextRow}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnApply]}
                onPress={handleWebDateFilter}
              >
                <Text style={[styles.modalBtnTextRow, { color: "white" }]}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={groupQuotations(filteredOrders).slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
        renderItem={renderItem}
        keyExtractor={(item) => item.S_Order}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchQuotations();
            }}
          />
        }
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching quotations found</Text>
            {!!hasAnyFilter ? (
              <TouchableOpacity
                onPress={clearAllFilters}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnText}>Clear All Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListFooterComponent={
          groupQuotations(filteredOrders).length > ITEMS_PER_PAGE ? (
            <View style={styles.paginationControls}>
              <Text style={styles.paginationText}>
                Page {currentPage} of {Math.ceil(groupQuotations(filteredOrders).length / ITEMS_PER_PAGE)}
              </Text>
              <View style={styles.paginationButtons}>
                <TouchableOpacity 
                   disabled={currentPage === 1}
                   onPress={() => setCurrentPage(p => p - 1)}
                   style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                >
                  <Text style={styles.pageButtonText}>Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                   disabled={currentPage >= Math.ceil(groupQuotations(filteredOrders).length / ITEMS_PER_PAGE)}
                   onPress={() => setCurrentPage(p => p + 1)}
                   style={[styles.pageButton, currentPage >= Math.ceil(groupQuotations(filteredOrders).length / ITEMS_PER_PAGE) && styles.pageButtonDisabled]}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleDetail}>Quotation Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            >
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Order No:</Text>
                <Text style={styles.detailValue}>{selectedOrder?.S_Order}</Text>
                <Text style={styles.detailLabel}>Customer:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.Customer_Name}
                </Text>
                <Text style={styles.detailLabel}>Ordered on:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedOrder?.Tr_Date)}
                </Text>
                <Text style={styles.detailLabel}>Total Rate:</Text>
                <Text style={[styles.detailValue, { color: "#007AFF" }]}>
                  {formatCurrency(selectedOrder?.total || 0)}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Quotation Items</Text>
              <View style={styles.itemListModal}>
                {selectedOrder?.items?.map((q: any, idx: number) => (
                  <View key={idx} style={styles.quotationItemRow}>
                    <View style={styles.qItemInfo}>
                      <Text style={styles.qItemName}>{q.Item_Name}</Text>
                      <Text style={styles.qItemNo}>{q.Q_No}</Text>
                    </View>
                    <Text style={styles.qItemRate}>
                      {formatCurrency(q.Rate)}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnApprove,
                  actionLoading && styles.btnDisabled,
                ]}
                onPress={() => handleAction(selectedOrder.id, "approve")}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Check size={18} color="white" />
                    <Text style={styles.btnText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnReject,
                  actionLoading && styles.btnDisabled,
                ]}
                onPress={() => handleAction(selectedOrder.id, "reject")}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <X size={18} color="white" />
                    <Text style={styles.btnText}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 24 : 25,
    paddingBottom: 15,
    backgroundColor: "white",
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  paginationText: {
    fontSize: 14,
    color: '#666',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  pageButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pageButtonDisabled: {
    backgroundColor: '#D1D1D6',
  },
  pageButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1C1C1E",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  filterBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  bannerInfo: { flexDirection: "row", alignItems: "center" },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginLeft: 10,
  },
  showAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  showAllBtnText: { color: "white", fontWeight: "bold", fontSize: 13 },
  searchContainer: { padding: 15 },
  searchBar: { marginBottom: 10 },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E1E1E6",
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
  },
  filtersRow: { flexDirection: "row" },
  datePickerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#007AFF",
    paddingHorizontal: 15,
    height: 48,
  },
  dateText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderNo: { fontWeight: "bold", color: "#1C1C1E", fontSize: 17 },
  qNoUnderHeader: { color: "#8E8E93", fontSize: 12, fontWeight: "500" },
  cardBody: { marginBottom: 16 },
  itemName: {
    fontSize: 16,
    color: "#1C1C1E",
    marginBottom: 6,
    fontWeight: "500",
  },
  customerRow: { flexDirection: "row", alignItems: "center" },
  customerText: { marginLeft: 6, color: "#8E8E93", fontSize: 13 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  dateAndBadge: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateTextBottom: { color: "#1C1C1E", fontSize: 14, fontWeight: "500" },
  readyBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readyBadgeText: {
    color: "#4CAF50",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  rateText: { fontSize: 16, fontWeight: "bold", color: "#4CAF50" },
  viewButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    marginTop: 12,
  },
  viewButtonText: { color: "#007AFF", marginLeft: 8, fontWeight: "700" },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#007AFF",
    flex: 0.23,
    alignItems: "center",
  },
  categoryChipActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  categoryChipText: { fontSize: 11, fontWeight: "bold", color: "#007AFF" },
  categoryChipTextActive: { color: "white" },
  emptyContainer: { alignItems: "center", marginTop: 50 },
  emptyText: { color: "#999", fontSize: 16 },
  resetBtn: { marginTop: 15, padding: 10 },
  resetBtnText: { color: "#007AFF", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  webDatePickerContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
  },
  webDateInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    marginVertical: 20,
    textAlign: "center",
  },
  modalActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 15 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  modalBtnCancel: { backgroundColor: "#f0f0f0" },
  modalBtnApply: { backgroundColor: "#007AFF" },
  modalBtnTextRow: { fontWeight: "bold" },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    height: "85%",
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitleDetail: { fontSize: 18, fontWeight: "bold" },
  modalTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  detailCard: {
    backgroundColor: "#f8f9fa",
    padding: 18,
    borderRadius: 20,
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 18,
    color: "#888",
    fontWeight: "600",
    marginTop: 10,
    textTransform: "uppercase",
  },
  detailValue: { fontSize: 18, fontWeight: "600", color: "#333" },
  footerTotalLabel: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  modalScroll: { flex: 1 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1A1A1A",
  },
  itemListModal: {
    backgroundColor: "#F8F9FA",
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E1E1E6",
  },
  quotationItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  qItemInfo: { flex: 1 },
  qItemName: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  qItemNo: { fontSize: 13, color: "#8E8E93", marginTop: 2,fontWeight: "800" },
  qItemRate: { fontSize: 18, fontWeight: "bold", color: "#0fa520" },
  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  quickBtnText: { color: "white", fontWeight: "bold", fontSize: 13 },
  btn: {
    flex: 0.48,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  btnApprove: { backgroundColor: "#4CD964" },
  btnReject: { backgroundColor: "#FF3B30" },
  btnText: { color: "white", fontWeight: "bold" },
  btnDisabled: { opacity: 0.6 },
});
