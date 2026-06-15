import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  HardHat,
  LogOut,
  ShoppingBag,
  TrendingUp,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useBadges } from "../../context/BadgeContext";
import api from "../../services/api";
import { socket, SOCKET_EVENTS } from "../../services/socket";
import * as SecureStore from "../../utils/storage";

export default function DashboardScreen() {
  const { dashboardData, loading: badgeLoading, refreshCounts } = useBadges();
  const [username, setUsername] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("All Customers");
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [historyDetailModalVisible, setHistoryDetailModalVisible] =
    useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  const [selectedOutstanding, setSelectedOutstanding] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const ITEMS_PER_PAGE = 3;
  const router = useRouter();

  const data = dashboardData;
  const loading = badgeLoading;

  const computeOutstanding = useCallback((dashboardData: any) => {
    const allItems = [
      ...(dashboardData?.salesOrders || []),
      ...(dashboardData?.quotations || []),
      ...(dashboardData?.costings || []),
    ];
    if (!allItems.length) {
      return { TotalNet: 0, TotalPaid: 0, TotalBalance: 0 };
    }
    return allItems.reduce(
      (acc: any, item: any) => {
        const net = Number(item.TotalNet ?? item.Net ?? item.NetAmount ?? 0);
        const paid = Number(
          item.TotalPaid ?? item.Paid ?? item.PaidAmount ?? 0,
        );
        const balance = Number(
          item.TotalBalance ?? item.Balance ?? item.Due ?? 0,
        );
        return {
          TotalNet: acc.TotalNet + net,
          TotalPaid: acc.TotalPaid + paid,
          TotalBalance: acc.TotalBalance + balance,
        };
      },
      { TotalNet: 0, TotalPaid: 0, TotalBalance: 0 },
    );
  }, []);

  const fetchData = useCallback(async () => {
    try {
      await refreshCounts();
      const storedUser = await SecureStore.getItemAsync("username");
      if (storedUser) setUsername(storedUser);
    } catch (error: any) {
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshCounts]);

  // Refresh data
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  useEffect(() => {
    socket.on(SOCKET_EVENTS.DATA_UPDATED, () => {
      console.log("Real-time update received! Refreshing dashboard...");
      fetchData();
    });

    return () => {
      socket.off(SOCKET_EVENTS.DATA_UPDATED);
    };
  }, [fetchData]);

  useEffect(() => {
    const loadUser = async () => {
      const storedUser = await SecureStore.getItemAsync("username");
      if (storedUser) setUsername(storedUser);
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?⚠️🔒", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          try {
            await api.post("/logout");
          } catch (e) {
            console.error("Backend logout error", e);
          }
          await SecureStore.deleteItemAsync("token");
          await SecureStore.deleteItemAsync("username");
          router.replace("/login");
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const summary = data?.summary || {
    TotalOrders: 0,
    ReadyCostings: 0,
    ReadyQuotations: 0,
    PendingPayments: 0,
    PendingCheques: 0,
    TotalValue: 0,
  };
  const outstanding = data?.outstanding || computeOutstanding(data);
  const outstandingList = data?.outstandingList || [];
  const uniqueCustomers = Array.from(
    new Set(outstandingList.map((item: any) => item.Customer_Name)),
  ).filter(Boolean);

  const filteredOutstandingList =
    customerFilter === "All Customers"
      ? outstandingList
      : outstandingList.filter(
          (item: any) => item.Customer_Name === customerFilter,
        );

  const totalFilteredNet = filteredOutstandingList.reduce(
    (acc: number, item: any) => acc + (item.Net_Amount || 0),
    0,
  );
  const totalFilteredPaid = filteredOutstandingList.reduce(
    (acc: number, item: any) => acc + (item.Paid_Amount || 0),
    0,
  );
  const totalFilteredBalance = totalFilteredNet - totalFilteredPaid;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 30 : 100,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome Back,</Text>
          <Text style={styles.usernameText}>{username || "User"}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <LogOut size={28} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Alerts Section */}
      <View style={styles.alertsContainer}>
        <View style={styles.alertsHeader}>
          <AlertCircle size={25} color="#FF3B30" />
          <Text style={styles.alertsTitle}>Latest Alerts</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.alertsScroll}
        >
          {summary.ReadyCostings > 0 ? (
            <TouchableOpacity
              style={styles.alertItem}
              onPress={() => router.push("/(tabs)/costings")}
            >
              <Clock size={18} color="#0a37ec" />
              <Text style={styles.alertText}>
                {summary.ReadyCostings} Costings Ready
              </Text>
            </TouchableOpacity>
          ) : null}
          {summary.ReadyQuotations > 0 ? (
            <TouchableOpacity
              style={styles.alertItem}
              onPress={() => router.push("/(tabs)/quotations")}
            >
              <Clock size={18} color="#eb4545fa" />
              <Text style={styles.alertText}>
                {summary.ReadyQuotations} Quotations Ready
              </Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.alertItem}>
            <Clock size={18} color="#0b871a" />
            <Text style={styles.alertText}>System Online</Text>
          </View>
        </ScrollView>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.mainCard, { backgroundColor: "#0b871a" }]}>
          <Text style={styles.mainCardLabel}>Total Sales Value</Text>
          <Text style={styles.mainCardValue}>
            Rs. {summary.TotalValue?.toLocaleString() || "0"}
          </Text>
          <View style={styles.mainCardFooter}>
            <TrendingUp size={25} color="rgb(255, 255, 255)" />
            <Text style={styles.mainCardSubtext}>
              {summary.TotalOrders} Active Orders
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.subCard}
            onPress={() => router.push("/(tabs)/costings")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#FF9500" }]}>
              <HardHat size={20} color="white" />
            </View>
            <Text style={styles.subCardValue}>{summary.ReadyCostings}</Text>
            <Text style={styles.subCardLabel}>Open Costing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subCard}
            onPress={() => router.push("/(tabs)/quotations")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#5856D6" }]}>
              <ClipboardList size={20} color="white" />
            </View>

            <Text style={styles.subCardValue}>{summary.ReadyQuotations}</Text>
            <Text style={styles.subCardLabel}>Open Quotation</Text>
          </TouchableOpacity>
        </View>

        {/* Grouped Payment Approvals Widget moved up below widgets */}
        <Text style={styles.sectionTitle}>Payment Approvals</Text>
        <View style={styles.approvalsWidget}>
          <TouchableOpacity
            style={styles.approvalMenuItem}
            onPress={() => router.push("/(tabs)/payments?tab=Supplier")}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: "#FF3B30", width: 45, height: 45 },
              ]}
            >
              <ShoppingBag size={22} color="white" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Supplier Payments</Text>
              <Text style={styles.menuSubtitle}>
                {summary.SupplierPending || 0} Pending Items
              </Text>
            </View>
            <View style={styles.chevronContainer}>
              <View
                style={[
                  styles.catBadge,
                  { position: "relative", top: 0, right: 0 },
                ]}
              >
                <Text style={styles.catBadgeText}>
                  {summary.SupplierPending || 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.approvalMenuItem}
            onPress={() => router.push("/(tabs)/payments?tab=Technician")}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: "#AF52DE", width: 45, height: 45 },
              ]}
            >
              <User size={22} color="white" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Outside Technicians</Text>
              <Text style={styles.menuSubtitle}>
                {summary.TechPending || 0} Pending Items
              </Text>
            </View>
            <View style={styles.chevronContainer}>
              <View
                style={[
                  styles.catBadge,
                  {
                    position: "relative",
                    top: 0,
                    right: 0,
                    backgroundColor: "#AF52DE",
                  },
                ]}
              >
                <Text style={styles.catBadgeText}>
                  {summary.TechPending || 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.approvalMenuItem}
            onPress={() => router.push("/(tabs)/payments?tab=General")}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: "#34C759", width: 45, height: 45 },
              ]}
            >
              <CreditCard size={22} color="white" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Payment Vouchers</Text>
              <Text style={styles.menuSubtitle}>
                {summary.VoucherPending || 0} Pending Items
              </Text>
            </View>
            <View style={styles.chevronContainer}>
              <View
                style={[
                  styles.catBadge,
                  {
                    position: "relative",
                    top: 0,
                    right: 0,
                    backgroundColor: "#34C759",
                  },
                ]}
              >
                <Text style={styles.catBadgeText}>
                  {summary.VoucherPending || 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Outstanding Summary  */}
        <Text style={styles.sectionTitle}>Outstanding Summary</Text>
        <TouchableOpacity
          style={styles.outstandingCard}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 15,
            }}
          >
            <Text style={{ fontWeight: "600", color: "#0ea043" }}>
              Click to View Details
            </Text>
            <ChevronRight size={25} color="#1cac51" />
          </View>
          <View style={styles.outRow}>
            <View style={styles.outCol}>
              <Text style={styles.outLabel}>Total Net</Text>
              <Text style={styles.outValue}>
                Rs. {outstanding.TotalNet?.toLocaleString() || "0"}
              </Text>
            </View>
            <View style={styles.outDivider} />
            <View style={styles.outCol}>
              <Text style={styles.outLabel}>Paid</Text>
              <Text style={styles.outValue}>
                Rs. {outstanding.TotalPaid?.toLocaleString() || "0"}
              </Text>
            </View>
          </View>
          <View style={styles.balanceContainer}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <View style={styles.balanceBadge}>
                <Text style={styles.balanceBadgeText}>Pending</Text>
              </View>
            </View>
            <Text style={styles.balanceValue}>
              Rs. {outstanding.TotalBalance?.toLocaleString() || "0"}
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, (outstanding.TotalPaid / (outstanding.TotalNet || 1)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Modal */}
        {modalVisible && (
          <Modal visible={modalVisible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Outstanding Details</Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeBtn}
                  >
                    <X size={20} color="white" />
                  </TouchableOpacity>
                </View>

                <View style={styles.filterContainer}>
                  <Text style={styles.filterTitle}>FILTER BY CUSTOMER</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        customerFilter === "All Customers" &&
                          styles.filterChipActive,
                      ]}
                      onPress={() => setCustomerFilter("All Customers")}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          customerFilter === "All Customers" &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        All Customers
                      </Text>
                    </TouchableOpacity>
                    {uniqueCustomers.map((cust: any, idx: number) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.filterChip,
                          customerFilter === cust && styles.filterChipActive,
                        ]}
                        onPress={() => setCustomerFilter(cust)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            customerFilter === cust &&
                              styles.filterChipTextActive,
                          ]}
                        >
                          {cust}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.tableContainer}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thText, { flex: 2 }]}>Customer</Text>
                    <Text style={[styles.thText, { flex: 1.5 }]}>Order</Text>
                    <Text
                      style={[styles.thText, { flex: 1.5, textAlign: "right" }]}
                    >
                      Net Amt
                    </Text>
                    <Text
                      style={[styles.thText, { flex: 1.5, textAlign: "right" }]}
                    >
                      Paid
                    </Text>
                    <Text
                      style={[styles.thText, { flex: 1.5, textAlign: "right" }]}
                    >
                      Balance
                    </Text>
                  </View>

                  <ScrollView
                    style={styles.tableBodyScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredOutstandingList.map((item: any, idx: number) => {
                      const balance =
                        (item.Net_Amount || 0) - (item.Paid_Amount || 0);
                      const isPaid = balance <= 0;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.tableRow,
                            idx % 2 === 1 && styles.tableRowAlt,
                          ]}
                          onPress={() => {
                            setSelectedOutstanding(item);
                            setDetailModalVisible(true);
                          }}
                        >
                          <View style={{ flex: 2 }}>
                            <View style={styles.rowBulletContainer}>
                              <View style={styles.rowBullet} />
                              <Text
                                style={[
                                  styles.tdText,
                                  { fontWeight: "700", color: "#1A1A1A" },
                                ]}
                                numberOfLines={1}
                              >
                                {item.Customer_Name}
                              </Text>
                            </View>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginTop: 2,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 9,
                                  color: "#888",
                                  fontWeight: "600",
                                }}
                              >
                                {item.Tr_Type} |{" "}
                              </Text>
                              <Text style={{ fontSize: 9, color: "#888" }}>
                                {new Date(item.Tr_Date).toLocaleDateString()}
                              </Text>
                            </View>
                          </View>

                          <View style={{ flex: 1.5 }}>
                            <Text
                              style={[styles.tdText, { color: "#444" }]}
                              numberOfLines={1}
                            >
                              {item.S_Order}
                            </Text>
                            <Text
                              style={{ fontSize: 9, color: "#AAA" }}
                              numberOfLines={1}
                            >
                              Ref: {item.Ref_No}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.tdText,
                              { flex: 1.2, textAlign: "right" },
                            ]}
                            numberOfLines={1}
                          >
                            Rs.{item.Net_Amount?.toLocaleString()}
                          </Text>
                          <Text
                            style={[
                              styles.tdText,
                              { flex: 1.2, textAlign: "right" },
                            ]}
                            numberOfLines={1}
                          >
                            Rs.{item.Paid_Amount?.toLocaleString()}
                          </Text>
                          <Text
                            style={[
                              styles.tdText,
                              {
                                flex: 1.5,
                                textAlign: "right",
                                color: isPaid ? "#0ea043" : "#D32F2F",
                                fontWeight: "bold",
                              },
                            ]}
                            numberOfLines={1}
                          >
                            Rs.{balance.toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {filteredOutstandingList.length === 0 && (
                      <View style={{ padding: 20, alignItems: "center" }}>
                        <Text style={{ color: "#666" }}>No records found.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>

                <View style={[styles.summaryFooter, { paddingBottom: 40 }]}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Records</Text>
                    <Text style={styles.summaryValue}>
                      {filteredOutstandingList.length}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Net Amount</Text>
                    <Text style={styles.summaryValue}>
                      Rs. {totalFilteredNet.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Paid</Text>
                    <Text style={styles.summaryValue}>
                      Rs. {totalFilteredPaid.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelBold}>
                      Remaining to Pay
                    </Text>
                    <Text style={styles.summaryValueBigRed}>
                      Rs. {totalFilteredBalance.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Detail Overlay replaces the second Modal to work properly on iOS */}
              {detailModalVisible && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: "rgba(0,0,0,0.6)",
                      justifyContent: "center",
                      padding: 25,
                      zIndex: 1000,
                    },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: "white",
                      borderRadius: 20,
                      overflow: "hidden",
                      ...(Platform.OS === "web"
                        ? { maxWidth: 600, alignSelf: "center", width: "100%" }
                        : {}),
                    }}
                  >
                    <View style={[styles.modalHeader, { padding: 15 }]}>
                      <Text style={styles.modalTitle}>Order Details</Text>
                      <TouchableOpacity
                        onPress={() => setDetailModalVisible(false)}
                        style={styles.closeBtn}
                      >
                        <X size={18} color="white" />
                      </TouchableOpacity>
                    </View>

                    {selectedOutstanding && (
                      <View style={{ padding: 20 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#888",
                            fontWeight: "bold",
                            marginBottom: 5,
                          }}
                        >
                          CUSTOMER NAME
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            color: "#333",
                            fontWeight: "bold",
                            marginBottom: 20,
                          }}
                        >
                          {selectedOutstanding.Customer_Name}
                        </Text>

                        <View
                          style={{ flexDirection: "row", marginBottom: 15 }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#AAA",
                                fontWeight: "bold",
                              }}
                            >
                              S_ORDER
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: "#333",
                                fontWeight: "600",
                              }}
                            >
                              {selectedOutstanding.S_Order}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#AAA",
                                fontWeight: "bold",
                              }}
                            >
                              REF_NO
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: "#333",
                                fontWeight: "600",
                              }}
                            >
                              {selectedOutstanding.Ref_No}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{ flexDirection: "row", marginBottom: 15 }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#AAA",
                                fontWeight: "bold",
                              }}
                            >
                              PAY TYPE
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: "#0ea043",
                                fontWeight: "bold",
                              }}
                            >
                              {selectedOutstanding.Tr_Type}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#AAA",
                                fontWeight: "bold",
                              }}
                            >
                              DATE
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: "#333",
                                fontWeight: "600",
                              }}
                            >
                              {new Date(
                                selectedOutstanding.Tr_Date,
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            height: 1,
                            backgroundColor: "#EEE",
                            marginVertical: 10,
                          }}
                        />

                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <Text style={{ color: "#100f0f", fontWeight: "600" }}>
                            Net Amount
                          </Text>
                          <Text style={{ fontWeight: "700", color: "#333" }}>
                            Rs.{" "}
                            {selectedOutstanding.Net_Amount?.toLocaleString()}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <Text style={{ color: "#020202", fontWeight: "600" }}>
                            Paid Amount
                          </Text>
                          <Text style={{ fontWeight: "700", color: "#0ea043" }}>
                            Rs.{" "}
                            {selectedOutstanding.Paid_Amount?.toLocaleString()}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginTop: 10,
                          }}
                        >
                          <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                            Balance
                          </Text>
                          <Text
                            style={{
                              fontWeight: "bold",
                              fontSize: 18,
                              color: "#D32F2F",
                            }}
                          >
                            Rs.{" "}
                            {(
                              selectedOutstanding.Net_Amount -
                              selectedOutstanding.Paid_Amount
                            ).toLocaleString()}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={{
                            backgroundColor: "#0ea043",
                            padding: 15,
                            borderRadius: 12,
                            alignItems: "center",
                            marginTop: 25,
                          }}
                          onPress={() => setDetailModalVisible(false)}
                        >
                          <Text style={{ color: "white", fontWeight: "bold" }}>
                            OK
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </Modal>
        )}

        {/* History Detail Modal */}
        {historyDetailModalVisible && (
          <Modal
            visible={historyDetailModalVisible}
            animationType="fade"
            transparent
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(0,0,0,0.6)",
                  justifyContent: "center",
                  padding: 25,
                  zIndex: 1000,
                },
              ]}
            >
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 20,
                  overflow: "hidden",
                  ...(Platform.OS === "web"
                    ? { maxWidth: 600, alignSelf: "center", width: "100%" }
                    : {}),
                }}
              >
                <View style={[styles.modalHeader, { padding: 15 }]}>
                  <Text style={styles.modalTitle}>History Details</Text>
                  <TouchableOpacity
                    onPress={() => setHistoryDetailModalVisible(false)}
                    style={styles.closeBtn}
                  >
                    <X size={18} color="white" />
                  </TouchableOpacity>
                </View>
                {selectedHistoryItem && (
                  <View style={{ padding: 20 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#888",
                        fontWeight: "bold",
                        marginBottom: 5,
                      }}
                    >
                      CUSTOMER NAME
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        color: "#333",
                        fontWeight: "bold",
                        marginBottom: 20,
                      }}
                    >
                      {selectedHistoryItem.Customer_Name}
                    </Text>

                    <View style={{ flexDirection: "row", marginBottom: 15 }}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#AAA",
                            fontWeight: "bold",
                          }}
                        >
                          ORDER NO
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "#333",
                            fontWeight: "600",
                          }}
                        >
                          {selectedHistoryItem.S_Order}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#AAA",
                            fontWeight: "bold",
                          }}
                        >
                          TYPE
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "#0ea043",
                            fontWeight: "bold",
                          }}
                        >
                          {selectedHistoryItem.ApprovedType}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", marginBottom: 15 }}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#AAA",
                            fontWeight: "bold",
                          }}
                        >
                          PRODUCT
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "#333",
                            fontWeight: "600",
                          }}
                        >
                          {selectedHistoryItem.Product_Name || "N/A"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#AAA",
                            fontWeight: "bold",
                          }}
                        >
                          DATE
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "#333",
                            fontWeight: "600",
                          }}
                        >
                          {new Date(
                            selectedHistoryItem.Tr_Date,
                          ).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        height: 1,
                        backgroundColor: "#EEE",
                        marginVertical: 10,
                      }}
                    />

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 10,
                      }}
                    >
                      <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                        Rate
                      </Text>
                      <Text
                        style={{
                          fontWeight: "bold",
                          fontSize: 18,
                          color: "#D32F2F",
                        }}
                      >
                        Rs. {selectedHistoryItem.Rate?.toLocaleString()}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{
                        backgroundColor: "#0ea043",
                        padding: 15,
                        borderRadius: 12,
                        alignItems: "center",
                        marginTop: 25,
                      }}
                      onPress={() => setHistoryDetailModalVisible(false)}
                    >
                      <Text style={{ color: "white", fontWeight: "bold" }}>
                        Close
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        )}

        <Text style={styles.sectionTitle}>Approved History</Text>
        {data?.history && data.history.length > 0 ? (
          <>
            {data.history
              .slice(
                (historyPage - 1) * ITEMS_PER_PAGE,
                historyPage * ITEMS_PER_PAGE,
              )
              .map((item: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyItem}
                  onPress={() => {
                    setSelectedHistoryItem(item);
                    setHistoryDetailModalVisible(true);
                  }}
                >
                  <View style={styles.historyInfo}>
                    <View
                      style={[
                        styles.historyIcon,
                        {
                          backgroundColor:
                            item.ApprovedType === "Costing"
                              ? "#FF9500"
                              : "#5856D6",
                        },
                      ]}
                    >
                      <Clock size={16} color="white" />
                    </View>
                    <View style={styles.historyTextContainer}>
                      <Text style={styles.historyOrderText}>
                        {item.S_Order} - {item.ApprovedType}
                      </Text>
                      <Text style={styles.historyCustomerText}>
                        {item.Customer_Name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyValueContainer}>
                    <Text style={styles.historyValueText}>
                      Rs. {item.Rate?.toLocaleString()}
                    </Text>
                    <Text style={styles.historyDateText}>
                      {new Date(item.Tr_Date).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

            <View style={styles.paginationControls}>
              <Text style={styles.paginationText}>
                Page {historyPage} of{" "}
                {Math.ceil(data.history.length / ITEMS_PER_PAGE)}
              </Text>
              <View style={styles.paginationButtons}>
                <TouchableOpacity
                  disabled={historyPage === 1}
                  onPress={() => setHistoryPage((p) => p - 1)}
                  style={[
                    styles.pageButton,
                    historyPage === 1 && styles.pageButtonDisabled,
                  ]}
                >
                  <Text style={styles.pageButtonText}>Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={
                    historyPage >=
                    Math.ceil(data.history.length / ITEMS_PER_PAGE)
                  }
                  onPress={() => setHistoryPage((p) => p + 1)}
                  style={[
                    styles.pageButton,
                    historyPage >=
                      Math.ceil(data.history.length / ITEMS_PER_PAGE) &&
                      styles.pageButtonDisabled,
                  ]}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryText}>
              No approved history found
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    ...(Platform.OS === "web"
      ? { maxWidth: 800, alignSelf: "center", width: "100%" }
      : {}),
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "web" ? 25 : 50,
    paddingBottom: 25,
    backgroundColor: "rgb(255, 255, 255)",
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 18px rgba(0,0,0,0.15)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 18,
        }),
  },
  welcomeText: {
    fontSize: 19,
    fontWeight: "500",
    color: "#8e9390",
  },
  usernameText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0ea043",
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  logoutButton: {
    padding: 5,
    backgroundColor: "#FFF0F0",
    borderRadius: 10,
  },
  alertsContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  alertsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  alertsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3B30",
    marginLeft: 5,
  },
  alertsScroll: {
    flexDirection: "row",
  },
  alertItem: {
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFEBEB",
  },
  alertText: {
    fontSize: 13,
    color: "#444",
    marginLeft: 8,
  },
  statsContainer: {
    padding: 20,
  },
  mainCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(0,0,0,0.1)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 5,
        }),
  },
  mainCardLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  mainCardValue: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginVertical: 10,
  },
  mainCardFooter: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainCardSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginLeft: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  subCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 15,
    width: "48%",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 10px rgba(0,0,0,0.1)" }
      : {
          elevation: 3,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        }),
    position: "relative",
  },
  badgeContainer: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    zIndex: 1,
  },
  iconBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  subCardValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  subCardLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
  },

  outstandingCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 5px rgba(0,0,0,0.05)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 5,
          elevation: 2,
        }),
  },
  outRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  outCol: {
    flex: 1,
    alignItems: "center",
  },
  outDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#eee",
  },
  outLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 5,
  },
  outValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  balanceContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 15,
    alignItems: "center",
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#8E8E93",
    marginLeft: 5,
  },
  balanceValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FF3B30",
  },
  balanceBadge: {
    backgroundColor: "#FF950015",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  balanceBadgeText: {
    color: "#FF9500",
    fontSize: 10,
    fontWeight: "bold",
  },
  progressBarBg: {
    width: "100%",
    height: 6,
    backgroundColor: "#F2F2F7",
    borderRadius: 3,
    marginTop: 15,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 3,
  },
  statusItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusItemText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 10,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeSuccess: {
    backgroundColor: "#E4F9E0",
  },
  badgeWarning: {
    backgroundColor: "#FFF1D1",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
  },

  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }),
  },
  historyInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyTextContainer: {
    flex: 1,
  },
  historyOrderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  historyCustomerText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  historyValueContainer: {
    alignItems: "flex-end",
  },
  historyValueText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#28a745",
  },
  historyDateText: {
    fontSize: 10,
    color: "#8E8E93",
    marginTop: 2,
  },
  emptyHistory: {
    padding: 30,
    alignItems: "center",
  },
  emptyHistoryText: {
    color: "#8E8E93",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginTop: 25,
    marginBottom: 15,
  },
  categoriesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 4px rgba(0,0,0,0.1)" }
      : {
          elevation: 2,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  categoryItem: {
    alignItems: "center",
    flex: 1,
  },
  catIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  approvalsWidget: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 15,
    marginBottom: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 6px rgba(0,0,0,0.1)" }
      : {
          elevation: 3,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
        }),
  },
  approvalMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuInfo: {
    flex: 1,
    marginLeft: 15,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1C1C1E",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F2F2F2",
    marginLeft: 60,
  },
  chevronContainer: {
    paddingLeft: 10,
  },
  catBadge: {
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  catBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  paginationControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    marginTop: 10,
    backgroundColor: "white",
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  paginationText: {
    fontSize: 14,
    color: "#666",
  },
  paginationButtons: {
    flexDirection: "row",
    gap: 10,
  },
  pageButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pageButtonDisabled: {
    backgroundColor: "#D1D1D6",
  },
  pageButtonText: {
    color: "#FFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#F7F8FA",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...(Platform.OS === "web"
      ? {
          maxWidth: 800,
          alignSelf: "center",
          width: "100%",
          borderRadius: 20,
          marginBottom: 20,
        }
      : {}),
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0ea043",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: { color: "white", fontSize: 18, fontWeight: "bold" },
  closeBtn: {
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 6,
    borderRadius: 15,
  },
  filterContainer: { padding: 15, paddingBottom: 5, backgroundColor: "white" },
  filterTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 10,
  },
  filterScroll: { paddingBottom: 10 },
  filterChip: {
    borderWidth: 1,
    borderColor: "#DDD",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: "white",
  },
  filterChipActive: { backgroundColor: "#0ea043", borderColor: "#0ea043" },
  filterChipText: { color: "#666", fontWeight: "600", fontSize: 13 },
  filterChipTextActive: { color: "white" },
  tableContainer: {
    flex: 1,
    backgroundColor: "white",
    marginTop: 10,
    marginHorizontal: 15,
    borderRadius: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 5px rgba(0,0,0,0.05)" }
      : {
          elevation: 2,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 5,
        }),
  },
  tableHeaderRow: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    backgroundColor: "#FAFAFA",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  thText: { fontSize: 12, fontWeight: "bold", color: "#444" },
  tableBodyScroll: { flex: 1 },
  tableRow: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#FAFAFA" },
  rowBulletContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  rowBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0b8e2e",
    marginRight: 8,
  },
  tdText: { fontSize: 12, color: "#333" },
  summaryFooter: {
    backgroundColor: "white",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    marginTop: 15,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  summaryLabel: { color: "#666", fontSize: 14 },
  summaryValue: { color: "#333", fontSize: 16, fontWeight: "bold" },
  summaryLabelBold: { color: "#666", fontSize: 15, fontWeight: "bold" },
  summaryValueBigRed: { color: "#D32F2F", fontSize: 22, fontWeight: "bold" },
  summaryDivider: { height: 1, backgroundColor: "#EEE", marginVertical: 10 },
});
