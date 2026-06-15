import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  CreditCard,
  Eye,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { useBadges } from "../../context/BadgeContext";
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

type PaymentType = "Supplier" | "Technician" | "General";

// ── Design tokens ────────────────────────────────────────────
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
  redPale: "#FFEBEE",
  redBorder: "#e30f24",
  yellow: "#cae30f",
  blue: "#0f44e3",
  bluelight: "#d8e0f7",
  orange: "#e3a70f",
};

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

export default function AllPaymentsScreen() {
  const router = useRouter();
  const { refreshCounts } = useBadges();
  const { tab } = useLocalSearchParams<{ tab: string }>();

  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [details, setDetails] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<PaymentType>("Supplier");
  const [actionLoading, setActionLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 2;

  useEffect(() => {
    if (tab && ["Supplier", "Technician", "General"].includes(tab)) {
      setActiveTab(tab as PaymentType);
      setCurrentPage(1);
    }
  }, [tab]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint =
        activeTab === "Supplier"
          ? "/supplier-payments"
          : activeTab === "Technician"
            ? "/technician-payments"
            : "/voucher-payments";
      const response = await api.get(endpoint);
      setPayments(response.data || []);
    } catch (error) {
      console.error(`Fetch ${activeTab} Payments Error:`, error);
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  const applyFilter = useCallback(() => {
    let filtered = [...payments];
    if (searchText.trim()) {
      const query = searchText.toLowerCase().trim();
      filtered = filtered.filter(
        (o) =>
          `${o.Pay_No ?? o.Voucher_No ?? ""}`.toLowerCase().includes(query) ||
          `${o.Supplier_Name ?? o.Technician_Name ?? o.Acc_Name ?? ""}`
            .toLowerCase()
            .includes(query),
      );
    }
    if (dateFilter) {
      const dateString = dateFilter.toISOString().split("T")[0];
      filtered = filtered.filter((o) =>
        `${o.Tr_Date ?? ""}`.includes(dateString),
      );
    }
    setFilteredPayments(filtered);
    setCurrentPage(1);
  }, [payments, searchText, dateFilter]);

  useEffect(() => {
    applyFilter();
  }, [applyFilter]);
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchPayments();
    }, [fetchPayments]),
  );

  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);
  const pagedPayments = filteredPayments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const fetchDetails = async (item: any) => {
    try {
      let endpoint = "";
      if (activeTab === "Supplier") {
        endpoint = `/supplier-payments/${encodeURIComponent(String(item.Pay_No).trim())}/details`;
      } else if (activeTab === "General") {
        endpoint = `/voucher-payments/${encodeURIComponent(String(item.Voucher_No).trim())}/details`;
      }
      if (endpoint) {
        const response = await api.get(endpoint);
        setDetails(response.data || []);
      } else {
        setDetails([]);
      }
    } catch (error) {
      console.error("Fetch Details Error:", error);
      setDetails([]);
    }
  };

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setActionLoading(true);
    try {
      const endpoint =
        activeTab === "Supplier"
          ? `/supplier-payments/${id}/${action}`
          : activeTab === "Technician"
            ? `/technician-payments/${id}/${action}`
            : `/voucher-payments/${id}/${action}`;
      await api.put(endpoint);
      Alert.alert("Success", `${activeTab} payment ${action}ed successfully`);
      await fetchPayments();
      await refreshCounts();
      setModalVisible(false);
    } catch (error) {
      console.error("Action Error:", error);
      Alert.alert("Error", `Failed to ${action} payment`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatCurrency = (amount: number) =>
    `Rs. ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const getPaymentMethod = (item: any) => {
    const type = (item.Pay_Type || item.Tr_Type || "").toLowerCase();
    const hasCheque =
      item.Pay_No?.startsWith("CHQ") ||
      item.Voucher_No?.startsWith("CHQ") ||
      (item.Chq_No && item.Chq_No !== "N/A");
    if (type.includes("bank") || type.includes("transfer"))
      return { label: "TRANSFER", color: G.mid, bg: G.pale };
    if (hasCheque || type.includes("chq") || type.includes("cheque"))
      return { label: "CHEQUE", color: G.blue, bg: G.bluelight };
    return { label: "CASH", color: "#E65100", bg: "#f4ece0" };
  };

  // ── Card ─────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: any }) => {
    const method = getPaymentMethod(item);
    return (
      <View style={styles.card}>
        {/* Card top accent */}
        <View style={styles.cardAccent} />

        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <Text style={styles.orderNo}>
                {item.Pay_No || item.Voucher_No}
              </Text>
              <View
                style={[
                  styles.methodBadge,
                  { backgroundColor: method.bg, marginLeft: 8 },
                ]}
              >
                <Text style={[styles.methodBadgeText, { color: method.color }]}>
                  {method.label}
                </Text>
              </View>
            </View>
            <Text style={styles.payeeName}>
              {item.Supplier_Name || item.Technician_Name || item.Acc_Name}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>READY</Text>
            </View>
            <Text style={styles.timeAgoText}>{getTimeAgo(item.Tr_Date || item.DOR)}</Text>
          </View>
        </View>

        <View style={styles.cardInfoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>TYPE</Text>
            <Text style={styles.infoValue}>
              {item.Pay_Type || item.Tr_Type || "General"}
            </Text>
          </View>
          <View style={[styles.infoCol, { alignItems: "center" }]}>
            <Text style={styles.infoLabel}>DATE</Text>
            <Text style={styles.infoValue}>{formatDate(item.Tr_Date)}</Text>
          </View>
          <View style={[styles.infoCol, { alignItems: "flex-end" }]}>
            <Text style={styles.infoLabel}>AMOUNT</Text>
            <Text
              style={[styles.infoValue, { color: G.dark, fontWeight: "700" }]}
            >
              {formatCurrency(item.Amount || item.Tobe_Paid || 0)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => {
            setSelectedPayment(item);
            fetchDetails(item);
            setModalVisible(true);
          }}
        >
          <Eye size={16} color={G.white} />
          <Text style={styles.viewButtonText}>View & Approve</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Screen ────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={22} color={G.base} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Approvals</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["Supplier", "Technician", "General"] as PaymentType[]).map((t) => {
          const Icon =
            t === "Supplier"
              ? ShoppingBag
              : t === "Technician"
                ? User
                : CreditCard;
          const active = activeTab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, active && styles.activeTab]}
              onPress={() => setActiveTab(t)}
            >
              <Icon size={15} color={active ? G.dark : G.muted} />
              <Text style={[styles.tabText, active && styles.activeTabText]}>
                {t}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search & Date */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color={G.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by No or Name..."
            placeholderTextColor={G.muted}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.dateBtn}
        >
          <Calendar size={18} color={G.dark} />
        </TouchableOpacity>
      </View>

      {/* Date active badge */}
      {dateFilter && (
        <View style={styles.activeDateBadge}>
          <Text style={styles.activeDateText}>
            📅 {formatDate(dateFilter.toISOString())}
          </Text>
          <TouchableOpacity onPress={() => setDateFilter(null)}>
            <X size={14} color={G.dark} />
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={G.dark} />
          <Text style={{ color: G.muted, marginTop: 10, fontSize: 13 }}>
            Loading payments…
          </Text>
        </View>
      ) : (
        <FlatList
          data={pagedPayments}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            `${activeTab}-${item.Pay_No || item.Voucher_No || index}`
          }
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 30 : 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[G.dark]}
              tintColor={G.dark}
              onRefresh={() => {
                setRefreshing(true);
                fetchPayments();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <CreditCard size={32} color={G.light} />
              </View>
              <Text style={styles.emptyTitle}>No pending payments</Text>
              <Text style={styles.emptyText}>
                No {activeTab.toLowerCase()} payments found
              </Text>
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
                  <Text style={styles.pageButtonText}>← Prev</Text>
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
      )}

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={dateFilter || new Date()}
          mode="date"
          onChange={(e, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDateFilter(selectedDate);
          }}
        />
      )}

      {/* ── Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Green header section */}
            <View style={styles.modalGreenHeader}>
              {/* Decorative circles */}
              <View style={styles.decorCircle1} />
              <View style={styles.decorCircle2} />

              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {activeTab} Payment Review
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <X size={16} color={G.white} />
                </TouchableOpacity>
              </View>

              {/* Payment details card inside green header */}
              <View style={styles.modalInfoCard}>
                <View style={styles.modalInfoTopRow}>
                  <View>
                    <Text style={styles.modalInfoLabel}>PAY_NO</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedPayment?.Pay_No || selectedPayment?.Voucher_No}
                    </Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                </View>

                <Text style={styles.modalInfoLabel}>PAYEE</Text>
                <Text style={styles.modalInfoValue}>
                  {selectedPayment?.Supplier_Name ||
                    selectedPayment?.Technician_Name ||
                    selectedPayment?.Acc_Name}
                </Text>

                <View style={styles.modalDivider} />

                <Text style={styles.modalAmountLabel}>TOTAL AMOUNT</Text>
                <Text style={styles.modalAmount}>
                  {formatCurrency(
                    selectedPayment?.Amount || selectedPayment?.Tobe_Paid || 0,
                  )}
                </Text>
              </View>
            </View>

            {/* White body */}
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Technician extras */}
              {activeTab === "Technician" && (
                <View style={styles.techRow}>
                  <View style={styles.techCell}>
                    <Text style={styles.techLabel}>Sales Order</Text>
                    <Text style={styles.techValue}>
                      {selectedPayment?.S_Order || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.techCell}>
                    <Text style={styles.techLabel}>Tr. Date</Text>
                    <Text style={styles.techValue}>
                      {formatDate(selectedPayment?.Tr_Date)}
                    </Text>
                  </View>
                  <View style={styles.techCell}>
                    <Text style={styles.techLabel}>Tr. Type</Text>
                    <Text style={styles.techValue}>
                      {selectedPayment?.Tr_Type || "N/A"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Cheque information */}
              {details && details.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Cheque Information</Text>
                  {details.map((d: any, i: number) => (
                    <View key={i} style={styles.chequeCard}>
                      <View style={styles.chequeRow}>
                        <View>
                          <Text style={styles.chequeLabel}>Chq No.</Text>
                          <Text style={styles.chequeValue}>{d.Chq_No}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.chequeLabel}>Acc No.</Text>
                          <Text style={styles.chequeValue}>{d.Acc_No}</Text>
                        </View>
                      </View>
                      <View style={styles.chequeDivider} />
                      <View style={styles.chequeRow}>
                        <View>
                          <Text style={styles.chequeLabel}>Amount</Text>
                          <Text style={[styles.chequeValue, { color: G.dark }]}>
                            {formatCurrency(d.Amount)}
                          </Text>
                        </View>
                        {!!d.DOR && (
                          <View style={{ alignItems: "flex-end" }}>
                            <Text
                              style={[styles.chequeLabel, { color: "#ef810c" }]}
                            >
                              Date Realized On
                            </Text>
                            <Text
                              style={[styles.chequeValue, { color: G.red }]}
                            >
                              {formatDate(d.DOR)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Awaiting notice */}
              <View style={styles.awaitingNotice}>
                <View style={styles.awaitingDot} />
                <Text style={styles.awaitingText}>
                  This payment is awaiting your approval
                </Text>
              </View>
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.approveBtn, actionLoading && { opacity: 0.6 }]}
                disabled={actionLoading}
                onPress={() => handleAction(selectedPayment?.ID, "approve")}
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
                onPress={() => handleAction(selectedPayment?.ID, "reject")}
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

// ── CSS Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: G.offwhite,
    ...(Platform.OS === 'web' ? { maxWidth: 800, alignSelf: 'center', width: '100%' } : {})
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 52 : 25,
    paddingBottom: 14,
    backgroundColor: G.white,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: G.white,
    borderWidth: 1,
    borderColor: G.base,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: G.base,
    letterSpacing: 0.3,
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: G.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: G.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
    backgroundColor: G.faint,
  },
  activeTab: { backgroundColor: G.pale, borderWidth: 1, borderColor: G.light },
  tabText: { fontSize: 11, fontWeight: "600", color: G.muted },
  activeTabText: { color: G.dark },

  // Search
  searchBarContainer: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: G.white,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: G.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: G.text },
  dateBtn: {
    width: 44,
    height: 44,
    backgroundColor: G.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 14,
    marginBottom: 4,
    marginTop: -4,
    backgroundColor: G.pale,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: G.light,
  },
  activeDateText: { fontSize: 12, color: G.dark, fontWeight: "500" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Card
  card: {
    backgroundColor: G.white,
    marginBottom: 14,
    borderRadius: 18,
    overflow: "hidden",
    borderBlockColor: G.dark,
    borderWidth: 2,
    borderColor: G.border,
    shadowColor: G.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardAccent: { height: 4, backgroundColor: G.dark },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    paddingBottom: 10,
  },
  orderNo: { fontSize: 15, fontWeight: "700", color: G.text },
  payeeName: { fontSize: 14, color: G.sub, marginTop: 2, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: G.pale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: G.light,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: G.base },
  statusText: { color: G.dark, fontSize: 9, fontWeight: "700" },
  methodBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  methodBadgeText: { fontSize: 9, fontWeight: "700" },

  cardInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: G.faint,
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: G.border,
  },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 11, color: G.sub, fontWeight: "700", marginBottom: 3 },
  infoValue: { fontSize: 12, fontWeight: "600", color: G.text },

  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: G.dark,
    marginHorizontal: 14,
    marginBottom: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 7,
  },
  viewButtonText: { color: G.white, fontWeight: "700", fontSize: 13 },
  timeAgoText: {
    fontSize: 10,
    color: G.red,
    fontWeight: "600",
    marginTop: 4,
  },

  // Empty
  emptyContainer: { alignItems: "center", marginTop: 80 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: G.pale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: G.text,
    marginBottom: 4,
  },
  emptyText: { color: G.muted, fontSize: 13 },

  // Pagination
  paginationControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  paginationText: { fontSize: 13, color: G.sub, fontWeight: "500" },
  pageButton: {
    backgroundColor: G.dark,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  pageButtonDisabled: { backgroundColor: G.light },
  pageButtonText: { color: G.white, fontWeight: "600", fontSize: 13 },

  // ── Modal ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: G.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...(Platform.OS === 'web' ? { maxWidth: 800, alignSelf: 'center', width: '100%', borderRadius: 28, marginBottom: 20 } : {}),
    maxHeight: "88%",
    overflow: "hidden",
  },

  // Green header
  modalGreenHeader: {
    backgroundColor: G.dark,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 22,
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -30,
    right: -20,
  },
  decorCircle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -25,
    right: 30,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: G.white, flex: 1 },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Info card inside green header
  modalInfoCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
  },
  modalInfoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  modalInfoLabel: {
    fontSize: 15,
    color: "rgba(231, 237, 109, 0.92)",
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  modalInfoValue: {
    fontSize: 18,
    fontWeight: "600",
    color: G.white,
    marginBottom: 8,
  },
  pendingBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: { fontSize: 11, color: G.white, fontWeight: "600" },
  modalDivider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 10,
  },
  modalAmountLabel: {
    fontSize: 15,
    color: "rgba(231, 237, 109, 0.92)",
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  modalAmount: { fontSize: 26, fontWeight: "700", color: G.white },

  // Modal scroll body
  modalScroll: { paddingHorizontal: 18, paddingTop: 16 },

  // Technician row
  techRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    backgroundColor: G.faint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border,
    padding: 12,
  },
  techCell: { flex: 1 },
  techLabel: {
    fontSize: 12,
    color: G.sub,
    fontWeight: "700",
    marginBottom: 2,
  },
  techValue: { fontSize: 13, fontWeight: "700", color: G.text },

  // Section
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: G.dark,
    marginBottom: 10,
    marginTop: 4,
  },

  // Cheque card
  chequeCard: {
    backgroundColor: G.faint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border,
    padding: 14,
    marginBottom: 10,
  },
  chequeRow: { flexDirection: "row", justifyContent: "space-between" },
  chequeLabel: {
    fontSize: 15,
    color: G.mid,
    fontWeight: "800",
    marginBottom: 3,
  },
  chequeValue: { fontSize: 14, fontWeight: "600", color: G.text },
  chequeDivider: { height: 0.5, backgroundColor: G.light, marginVertical: 10 },

  // Awaiting notice
  awaitingNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: G.redPale,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: G.red,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    marginTop: 4,
  },
  awaitingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: G.red },
  awaitingText: { fontSize: 12, color: G.red, fontWeight: "500", flex: 1 },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: G.border,
    backgroundColor: G.white,
  },
  approveBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: G.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  rejectBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: G.white,
    borderWidth: 1,
    borderColor: G.redBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { color: G.white, fontWeight: "700", fontSize: 14 },
});
