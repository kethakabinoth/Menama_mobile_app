import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clipboard,
  Eye,
  Filter,
  RefreshCcw,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import api from "../../services/api";
import { useBadges } from "../../context/BadgeContext";
import { socket, SOCKET_EVENTS } from "../../services/socket";

const getTimeAgo = (date: string | Date) => {
  if (!date) return "";
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMins < 1) return "Just now";
  if (diffInMins < 60) return `${diffInMins}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${diffInDays}d ago`;
};

// ── Green Theme ────────────
const G = {
  dark: "#1B5E3B",
  mid: "#2E7D32",
  base: "#388E3C",
  light: "#C8E6C9",
  pale: "#E8F5E9",
  faint: "#F6FFF7",
  white: "#FFFFFF",
  offwhite: "#F4F9F5",
  text: "#1A1A1A",
  sub: "#6B6B6B",
  muted: "#9E9E9E",
  border: "#D8EDD9",
  red: "#C62828",
};

export default function SalesOrdersScreen() {
  const { filter } = useLocalSearchParams();
  const { refreshCounts } = useBadges();
  const router = useRouter();
  const filterStr = typeof filter === "string" ? filter : undefined;

  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "All" | "Ready" | "Approved" | "Rejected"
  >("All");

  // Pagination - 2 cards per page
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 2;

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

      setFilteredOrders(filtered);
      setCurrentPage(1);
    },
    [filterStr, searchText, categoryFilter],
  );

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

  useEffect(() => applyFilter(orders), [orders, applyFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  useEffect(() => {
    socket.on(SOCKET_EVENTS.DATA_UPDATED, () => {
      fetchOrders();
      refreshCounts();
    });
    return () => { socket.off(SOCKET_EVENTS.DATA_UPDATED); };
  }, [fetchOrders, refreshCounts]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const pagedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const getTotalOutstanding = () =>
    filteredOrders.reduce((sum, order) => {
      const val = parseFloat(order.Rate);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const clearAllFilters = () => {
    setSearchText("");
    setCategoryFilter("All");
    router.setParams({ filter: undefined });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase().trim()) {
      case "approved":
        return "#2E7D32"; // Dark Green
      case "ready":
        return "#1976D2"; // Blue
      case "rejected":
        return "#C62828"; // Red
      case "pending":
        return "#EF6C00"; // Orange
      default:
        return "#757575"; // Gray
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardAccent} />

      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderNo}>{item.S_Order}</Text>
          <Text style={styles.timeAgoText}>{getTimeAgo(item.Tr_Date)}</Text>
        </View>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: item.Status?.trim() === "A" ? G.mid : G.muted,
              },
            ]}
          />
          <Text style={styles.statusText}>
            {item.Status?.trim() === "A" ? "Available" : item.Status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <User size={18} color={G.sub} />
          <Text style={styles.customerName}>{item.Customer_Name}</Text>
        </View>

        <View style={styles.productsList}>
          <View style={styles.productRow}>
            <Clipboard size={16} color={G.mid} />
            <Text
              style={[styles.productText, { fontWeight: "700", color: G.text }]}
            >
              {item.Product_Name}
            </Text>
          </View>
        </View>

        <View style={styles.balanceBox}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.balanceText}>
              Rs. {Number(item.Outstanding_Balance).toLocaleString()}
            </Text>
            <Text style={{ fontSize: 13, color: G.text, fontWeight: "600" }}>
              Order Balance
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusCol}>
            <Text style={styles.statusLabel}>Costing</Text>
            <Text
              style={[
                styles.statusValue,
                { color: getStatusColor(item.Costing_Status) },
              ]}
            >
              {item.Costing_Status || "Pending"}
            </Text>
          </View>
          <View style={styles.statusCol}>
            <Text style={styles.statusLabel}>Quotation</Text>
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
        <Eye size={18} color={G.white} />
        <Text style={styles.viewButtonText}>View Details</Text>
      </TouchableOpacity>
    </View>
  );

  const hasAnyFilter = searchText || filterStr || categoryFilter !== "All";

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={G.dark} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 44 }} />
        <Text style={styles.headerTitle}>
          {filterStr
            ? `${filterStr.charAt(0).toUpperCase() + filterStr.slice(1)} Orders`
            : "Sales Orders"}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.filterBanner}>
        <View style={styles.bannerInfo}>
          <Filter size={22} color={G.dark} />
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>
              {filterStr
                ? `${filterStr.charAt(0).toUpperCase() + filterStr.slice(1)} Orders`
                : "Sales Orders"}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {filteredOrders.length} orders • Page {currentPage} of{" "}
              {totalPages}
            </Text>
          </View>
        </View>
        {hasAnyFilter && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearAllFilters}>
            <RefreshCcw size={16} color={G.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Total Outstanding */}
      <View style={styles.totalSummary}>
        <Text style={styles.totalLabel}>Total Outstanding</Text>
        <Text style={styles.totalValue}>
          Rs. {getTotalOutstanding().toLocaleString()}
        </Text>
      </View>

      {/* Search & Category */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Order No, Customer or Product..."
          placeholderTextColor={G.muted}
          value={searchText}
          onChangeText={setSearchText}
        />

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

      <FlatList
        data={pagedOrders}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.S_Order}-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[G.dark]}
            onRefresh={fetchOrders}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationControls}>
              <TouchableOpacity
                disabled={currentPage === 1}
                onPress={() => setCurrentPage((p) => p - 1)}
                style={[
                  styles.pageButton,
                  currentPage === 1 && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageButtonText}>← Previous</Text>
              </TouchableOpacity>

              <Text style={styles.paginationText}>
                {currentPage} / {totalPages}
              </Text>

              <TouchableOpacity
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage((p) => p + 1)}
                style={[
                  styles.pageButton,
                  currentPage === totalPages && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Modal */}
      {modalVisible && (
        <Modal
          animationType="slide"
          transparent
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalGreenHeader}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>
                    Order: {selectedOrder?.S_Order}
                  </Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <X size={24} color={G.white} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>S_ORDER</Text>
                  <Text style={styles.detailValue}>{selectedOrder?.S_Order}</Text>

                  <Text style={styles.detailLabel}>CUSTOMER NAME</Text>
                  <Text style={styles.detailValue}>
                    {selectedOrder?.Customer_Name}
                  </Text>

                  <Text style={styles.detailLabel}>PRODUCT NAME</Text>
                  <Text style={styles.detailValue}>
                    {selectedOrder?.Product_Name}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLabel}>RATE</Text>
                      <Text style={[styles.detailValue, { color: G.red }]}>
                        Rs. {selectedOrder?.Rate?.toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLabel}>DATE</Text>
                      <Text style={styles.detailValue}>
                        {selectedOrder?.Tr_Date
                          ? new Date(selectedOrder.Tr_Date).toLocaleDateString()
                          : "N/A"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: G.border,
                      marginVertical: 20,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLabel}>COSTING </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          {
                            color: getStatusColor(selectedOrder?.Costing_Status),
                          },
                        ]}
                      >
                        {selectedOrder?.Costing_Status || "Pending"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLabel}>QUOTATION </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          {
                            color: getStatusColor(
                              selectedOrder?.Quatation_Status,
                            ),
                          },
                        ]}
                      >
                        {selectedOrder?.Quatation_Status || "Pending"}
                      </Text>
                    </View>
                  </View>

                  {/* Outstanding balance removed per request */}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

//css
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: G.offwhite,
    ...(Platform.OS === 'web' ? { maxWidth: 800, alignSelf: 'center', width: '100%' } : {})
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 52 : 22,
    paddingBottom: 14,
    backgroundColor: G.white,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: G.base,
    letterSpacing: 0.3,
  },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  filterBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: G.white,
    borderBottomWidth: 1,
    borderBottomColor: G.border,
  },
  bannerInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  bannerTextCol: { marginLeft: 12 },
  bannerTitle: { fontSize: 18, fontWeight: "700", color: G.text },
  bannerSubtitle: { fontSize: 13, color: G.sub },

  clearBtn: {
    backgroundColor: G.dark,
    padding: 10,
    borderRadius: 20,
  },

  totalSummary: {
    margin: 16,
    padding: 18,
    backgroundColor: G.pale,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: G.light,
  },
  totalLabel: { fontSize: 13, color: G.sub, fontWeight: "600" },
  totalValue: { fontSize: 28, fontWeight: "700", color: G.dark, marginTop: 4 },

  searchContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  searchInput: {
    backgroundColor: G.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: G.text,
  },

  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: G.white,
    borderWidth: 1,
    borderColor: G.border,
    flex: 1,
    marginHorizontal: 4,
    alignItems: "center",
  },
  categoryChipActive: { backgroundColor: G.dark, borderColor: G.dark },
  categoryChipText: { fontSize: 12.5, fontWeight: "600", color: G.sub },
  categoryChipTextActive: { color: G.white },

  listContent: { padding: 16, paddingBottom: Platform.OS === 'web' ? 30 : 100 },

  card: {
    backgroundColor: G.white,
    borderRadius: 20,
    marginBottom: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: G.border,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 10px rgba(0,0,0,0.07)' }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
          elevation: 4,
        }),
  },
  cardAccent: { height: 6, backgroundColor: G.dark },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    paddingBottom: 12,
  },
  orderNo: { fontSize: 17, fontWeight: "700", color: G.text },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: G.pale,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: G.base },
  statusText: { color: G.dark, fontSize: 11, fontWeight: "700" },

  cardBody: { paddingHorizontal: 18, paddingBottom: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  customerName: {
    marginLeft: 12,
    fontSize: 15,
    color: G.text,
    fontWeight: "600",
  },

  productsList: { marginBottom: 14 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  productText: { fontSize: 14, color: G.sub },
  moreText: { fontSize: 13, color: G.muted, marginTop: 4, fontStyle: "italic" },

  balanceBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: G.pale,
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  balanceText: {
    marginLeft: 12,
    fontSize: 17,
    fontWeight: "700",
    color: G.red,
  },

  statusRow: { flexDirection: "row", justifyContent: "space-between" },
  statusCol: { alignItems: "center" },
  statusLabel: {
    fontSize: 14,
    color: G.sub,
    marginBottom: 4,
    fontWeight: "800",
  },
  statusValue: { fontSize: 15, fontWeight: "800" },

  viewButton: {
    backgroundColor: G.dark,
    margin: 16,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewButtonText: {
    color: G.white,
    fontWeight: "700",
    fontSize: 14,
  },
  timeAgoText: {
    fontSize: 11,
    color: G.red,
    fontWeight: "600",
    marginTop: 2,
  },

  // Pagination
  paginationControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 10,
  },
  paginationText: { fontSize: 15, color: G.sub, fontWeight: "600" },
  pageButton: {
    backgroundColor: G.dark,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  pageButtonDisabled: { backgroundColor: G.light },
  pageButtonText: { color: G.white, fontWeight: "600", fontSize: 14 },

  emptyContainer: { alignItems: "center", marginTop: 100 },
  emptyText: { color: G.muted, fontSize: 16 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: G.white,
    borderRadius: 24,
    ...(Platform.OS === 'web' ? { maxWidth: 800, alignSelf: 'center', width: '100%', marginBottom: 20 } : {}),
    maxHeight: "85%",
    overflow: "hidden",
  },
  modalGreenHeader: { backgroundColor: G.dark, padding: 20 },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 19, fontWeight: "700", color: G.white },
  modalScroll: { padding: 20 },
  detailSection: {
    backgroundColor: G.faint,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: G.border,
  },
  detailLabel: {
    fontSize: 13.5,
    color: G.mid,
    fontWeight: "700",
    marginTop: 16,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 16.5,
    fontWeight: "700",
    color: G.text,
    marginTop: 4,
  },
});
