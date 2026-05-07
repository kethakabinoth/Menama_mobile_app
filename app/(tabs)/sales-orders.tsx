import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    Calendar,
    Clipboard,
    DollarSign,
    Eye,
    Filter,
    RefreshCcw,
    User,
    X,
} from "lucide-react-native";
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

export default function SalesOrdersScreen() {
  const { filter } = useLocalSearchParams();
  const router = useRouter();
  const filterStr = typeof filter === "string" ? filter : undefined;
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [webDateInput, setWebDateInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "All" | "Ready" | "Approved" | "Rejected"
  >("All");

  const applyFilter = useCallback(
    (data: any[]) => {
      let filtered = data;

      if (filterStr === "costing") {
        filtered = filtered.filter(
          (o) => o.Costing_Status?.toLowerCase().trim() === "ready",
        );
      } else if (filterStr === "quotation") {
        filtered = filtered.filter(
          (o) => o.Quatation_Status?.toLowerCase().trim() === "ready",
        );
      }

      if (categoryFilter !== "All") {
        const cat = categoryFilter.toLowerCase();
        filtered = filtered.filter(
          (o) =>
            o.Costing_Status?.toLowerCase().trim() === cat ||
            o.Quatation_Status?.toLowerCase().trim() === cat,
        );
      }

      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        filtered = filtered.filter(
          (o) =>
            `${o.S_Order ?? ""}`.toLowerCase().includes(query) ||
            `${o.Customer_Name ?? ""}`.toLowerCase().includes(query) ||
            `${o.Product_Name ?? ""}`.toLowerCase().includes(query),
        );
      }

      if (dateFilter) {
        const dateString = dateFilter.toISOString().split("T")[0];
        filtered = filtered.filter((o) =>
          `${o.Tr_Date ?? o.Date ?? ""}`.includes(dateString),
        );
      }

      setFilteredOrders(filtered);
    },
    [filterStr, searchText, dateFilter, categoryFilter],
  );

  const groupSalesOrders = (data: any[]) => {
    const groups: { [key: string]: any } = {};
    data.forEach((item) => {
      const key = item.S_Order;
      if (!groups[key]) {
        groups[key] = {
          ...item,
          items: [],
          // Outstanding_Balance is the same for all items in same S_Order from my backend query
          // but if it's per row, I should sum it? Usually it's per order.
          displayBalance: item.Outstanding_Balance || 0,
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups);
  };

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get("/sales-orders");
      setOrders(response.data);
      applyFilter(response.data);
    } catch (error) {
      console.error("Fetch Orders Error:", error);
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
      fetchOrders();
    }, [fetchOrders]),
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

  const getTotalOutstanding = () => {
    // Grouped unique balances to avoid over-counting if same order shows multiple times in list
    const grouped = groupSalesOrders(filteredOrders);
    return grouped.reduce(
      (sum, order) => sum + (Number(order.displayBalance) || 0),
      0,
    );
  };

  const clearAllFilters = () => {
    setSearchText("");
    setDateFilter(null);
    setWebDateInput("");
    setCategoryFilter("All");
    router.setParams({ filter: undefined });
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNo}>{item.S_Order}</Text>
        <View style={[styles.statusBadge, { backgroundColor: "#4CD964" }]}>
          <Text style={styles.statusText}>Active</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <User size={16} color="#666" />
          <Text style={styles.infoText}>{item.Customer_Name}</Text>
        </View>

        <View style={styles.productsList}>
          {item.items.map((it: any, idx: number) => (
            <View key={idx} style={styles.productRowInline}>
              <Clipboard size={14} color="#8E8E93" />
              <Text style={styles.productItemText}>{it.Product_Name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.balanceInfo}>
          <DollarSign size={16} color="#FF3B30" />
          <Text style={styles.balanceText}>
            Order Balance: Rs. {Number(item.displayBalance).toLocaleString()}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Costing:</Text>
            <Text
              style={[
                styles.statusValue,
                { color: getStatusColor(item.Costing_Status) },
              ]}
            >
              {item.Costing_Status || "Pending"}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Quotation:</Text>
            <Text
              style={[
                styles.statusValue,
                { color: getStatusColor(item.Quatation_Status) },
              ]}
            >
              {item.Quatation_Status || "Pending"}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => {
          setSelectedOrder(item);
          setModalVisible(true);
        }}
      >
        <Eye size={18} color="#007AFF" />
        <Text style={styles.viewButtonText}>View Order Details</Text>
      </TouchableOpacity>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase().trim()) {
      case "approved":
        return "#4CD964";
      case "ready":
        return "#FF9500";
      case "pending":
        return "#8E8E93";
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

  const hasAnyFilter = searchText || dateFilter || filterStr;

  return (
    <View style={styles.container}>
      <View style={styles.filterBanner}>
        <View style={styles.bannerInfo}>
          <Filter size={20} color="#007AFF" />
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>
              {filterStr
                ? `${filterStr.charAt(0).toUpperCase() + filterStr.slice(1)} Ready`
                : "Showing All Active Orders"}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {filteredOrders.length}{" "}
              {filteredOrders.length === 1 ? "order" : "orders"} found
            </Text>
          </View>
        </View>
        {hasAnyFilter && (
          <TouchableOpacity style={styles.showAllBtn} onPress={clearAllFilters}>
            <RefreshCcw size={16} color="white" />
            <Text style={styles.showAllBtnText}>Show All</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.totalSummary}>
        <Text style={styles.totalLabel}>Total Outstanding (Filtered):</Text>
        <Text style={styles.totalValue}>
          Rs. {getTotalOutstanding().toLocaleString()}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search order, customer or product"
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
                ? `Date Filter: ${dateFilter.toISOString().split("T")[0]}`
                : "Select Date to Filter (Calendar)"}
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
        data={groupSalesOrders(filteredOrders)}
        renderItem={renderItem}
        keyExtractor={(item) => item.S_Order}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOrders();
            }}
          />
        }
        contentContainerStyle={{ padding: 15 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching orders found</Text>
            {hasAnyFilter && (
              <TouchableOpacity
                onPress={clearAllFilters}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
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
              <Text style={styles.modalTitleDetail}>
                Order Details: {selectedOrder?.S_Order}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Product:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.Product_Name}
                </Text>
                <Text style={styles.detailLabel}>Customer:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.Customer_Name}
                </Text>
                <Text style={styles.detailLabel}>Rate:</Text>
                <Text style={[styles.detailValue, { color: "#FF3B30" }]}>
                  Rs. {selectedOrder?.Rate?.toLocaleString()}
                </Text>
                <Text style={styles.detailLabel}>Date:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder
                    ? new Date(selectedOrder.Tr_Date).toLocaleDateString()
                    : ""}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
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
  bannerInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  bannerTextCol: { marginLeft: 12 },
  bannerTitle: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  bannerSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
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
  totalSummary: {
    padding: 15,
    backgroundColor: "#FFF5F5",
    margin: 15,
    borderRadius: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFEBEB",
  },
  totalLabel: { fontSize: 12, color: "#888", fontWeight: "600" },
  totalValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF3B30",
    marginTop: 4,
  },
  searchContainer: { padding: 15, paddingTop: 0 },
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
    borderRadius: 15,
    marginBottom: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderNo: { fontWeight: "bold", color: "#007AFF", fontSize: 15 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { color: "white", fontSize: 11, fontWeight: "bold" },
  cardBody: { marginBottom: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  infoText: { marginLeft: 10, color: "#444", fontSize: 14 },
  productsList: {
    backgroundColor: "#F8F9FA",
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
  },
  productRowInline: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
    gap: 8,
  },
  productItemText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  balanceInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  balanceText: {
    marginLeft: 8,
    fontWeight: "bold",
    color: "#FF3B30",
    fontSize: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 10,
  },
  statusContainer: { alignItems: "center" },
  statusLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  statusValue: { fontSize: 13, fontWeight: "bold" },
  viewButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    marginTop: 8,
  },
  viewButtonText: { color: "#007AFF", marginLeft: 8, fontWeight: "700" },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
    flex: 0.23,
    alignItems: "center",
  },
  categoryChipActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  categoryChipText: { fontSize: 11, fontWeight: "bold", color: "#666" },
  categoryChipTextActive: { color: "white" },
  emptyContainer: { alignItems: "center", marginTop: 50 },
  emptyText: { color: "#999", fontSize: 16 },
  resetBtn: { marginTop: 15, padding: 10 },
  resetBtnText: { color: "#007AFF", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  webDatePickerContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowRadius: 10,
    shadowOpacity: 0.2,
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
    height: "75%",
    padding: 25,
    marginTop: "auto",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  modalTitleDetail: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },
  modalTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  modalScroll: { flex: 1 },
  detailSection: {
    backgroundColor: "#F8F9FA",
    padding: 18,
    borderRadius: 20,
    marginBottom: 25,
  },
  detailLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: { fontSize: 16, fontWeight: "600", color: "#333", marginTop: 2 },
  actionSection: { marginBottom: 30 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1A1A1A",
  },
  actionButtons: { flexDirection: "row", justifyContent: "space-between" },
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
});
