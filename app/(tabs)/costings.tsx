import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import {
  Calendar,
  Check,
  Eye,
  Filter,
  RefreshCcw,
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
          const status = (o.Costing_Status || o.Costing_Status || "")
            .toLowerCase()
            .trim();
          if (cat === "ready") {
            
            // Include everything that isn't Approved or Rejected
            return status !== "approved" && status !== "rejected";
          }
          return status === cat;
        });
      }

      setFilteredOrders(filtered);
    },
    [searchText, dateFilter, categoryFilter],
  );

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

  useEffect(() => {
    applyFilter(orders);
  }, [orders, applyFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchCostings();
    }, [fetchCostings]),
  );

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

  const formatCurrency = (amount: number) => {
    return `LKR ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.orderNo}>{item.S_Order}</Text>
          <Text style={styles.itemNameBold}>{item.Item_Name}</Text>
        </View>
        <View style={styles.costingReadyBadge}>
          <Text style={styles.costingReadyText}>Costing Ready</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerTotalLabel}>Group Total</Text>
        <Text style={styles.footerTotalValue}>
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
        <Eye size={18} color="#007AFF" />
        <Text style={styles.viewButtonText}>View Details</Text>
      </TouchableOpacity>
    </View>
  );

  const groupedFilteredOrders = groupOrders(filteredOrders);

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
        <Text style={styles.headerTitle}>Costings List</Text>
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
        data={groupedFilteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
        renderItem={renderItem}
        keyExtractor={(item) => item.S_Order}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchCostings();
            }}
          />
        }
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching costings found</Text>
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
          groupedFilteredOrders.length > ITEMS_PER_PAGE ? (
            <View style={styles.paginationControls}>
              <Text style={styles.paginationText}>
                Page {currentPage} of {Math.ceil(groupedFilteredOrders.length / ITEMS_PER_PAGE)}
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
                   disabled={currentPage >= Math.ceil(groupedFilteredOrders.length / ITEMS_PER_PAGE)}
                   onPress={() => setCurrentPage(p => p + 1)}
                   style={[styles.pageButton, currentPage >= Math.ceil(groupedFilteredOrders.length / ITEMS_PER_PAGE) && styles.pageButtonDisabled]}
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
              <Text style={styles.modalTitleDetail}>Costing Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            >
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Product Item:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.Item_Name}
                </Text>
                <Text style={styles.detailLabel}>Customer:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.Customer_Name}
                </Text>
                <Text style={styles.detailLabel}>Group Total:</Text>
                <Text style={[styles.detailValue, { color: "#007AFF" }]}>
                  {formatCurrency(selectedOrder?.total || 0)}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Material List</Text>
              <View style={styles.materialTableModal}>
                <View style={styles.materialTableHeader}>
                  <Text style={[styles.tableHead, { flex: 2 }]}>Material</Text>
                  <Text
                    style={[styles.tableHead, { flex: 1, textAlign: "center" }]}
                  >
                    Rate
                  </Text>
                  <Text
                    style={[styles.tableHead, { flex: 1, textAlign: "center" }]}
                  >
                    Qty
                  </Text>
                  <Text
                    style={[
                      styles.tableHead,
                      { flex: 1.5, textAlign: "right" },
                    ]}
                  >
                    Total
                  </Text>
                </View>
                {selectedOrder?.materials?.map((mat: any, idx: number) => (
                  <View key={idx} style={styles.materialRow}>
                    <Text style={[styles.matText, { flex: 2 }]}>
                      {mat.Material_Name}
                    </Text>
                    <Text
                      style={[styles.matText, { flex: 1, textAlign: "center" }]}
                    >
                      {Number(mat.Rate).toFixed(0)}
                    </Text>
                    <Text
                      style={[styles.matText, { flex: 1, textAlign: "center" }]}
                    >
                      {mat.Qty}
                    </Text>
                    <Text
                      style={[
                        styles.matText,
                        { flex: 1.5, textAlign: "right" },
                      ]}
                    >
                      {Number(mat.Total).toFixed(0)}
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
  searchContainer: { padding: 12 },
  searchBar: { marginBottom: 10 },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E1E1E6",
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: "#5a4949",
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
    marginBottom: 12,
  },
  headerTitleCol: { flex: 1 },
  orderNo: { fontWeight: "bold", color: "#1C1C1E", fontSize: 17 },
  itemNameBold: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  costingReadyBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  costingReadyText: {
    color: "#EF6C00",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  cardBody: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  materialTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E1E6",
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableHead: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
  },
  materialRow: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  matText: {
    fontSize: 13,
    color: "#3A3A3C",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    marginBottom: 12,
  },
  footerTotalLabel: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  footerTotalValue: { fontSize: 16, fontWeight: "bold", color: "#1C1C1E" },
  viewButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  viewButtonText: { color: "#007AFF", marginLeft: 8, fontWeight: "700" },
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
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
    marginTop: 10,
    textTransform: "uppercase",
  },
  detailValue: { fontSize: 19, fontWeight: "800", color: "#333" },
  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  modalScroll: { flex: 1 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1A1A1A",
  },
  materialTableModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
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
