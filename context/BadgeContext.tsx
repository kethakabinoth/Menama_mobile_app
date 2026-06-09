import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { socket, SOCKET_EVENTS } from '../services/socket';
import * as SecureStore from '../utils/storage';                   

interface BadgeCounts {
  quotations: number;
  costings: number;
  supplierPayments: number;
  techPayments: number;
  voucherPayments: number;
  totalPayments: number;
}
;
interface BadgeContextType {
  counts: BadgeCounts;
  dashboardData: any;
  loading: boolean;
  refreshCounts: () => Promise<void>;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<BadgeCounts>({
    quotations: 0,
    costings: 0,
    supplierPayments: 0,
    techPayments: 0,
    voucherPayments: 0,
    totalPayments: 0,
  });

  const refreshCounts = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return; // Prevent 401 if not logged in

      const response = await api.get('/dashboard');
      const data = response.data;
      const summary = data.summary;
      setDashboardData(data);
      setCounts({
        quotations: summary.ReadyQuotations || 0,
        costings: summary.ReadyCostings || 0,
        supplierPayments: summary.SupplierPending || 0,
        techPayments: summary.TechPending || 0,
        voucherPayments: summary.VoucherPending || 0,
        totalPayments: (summary.SupplierPending || 0) + (summary.TechPending || 0) + (summary.VoucherPending || 0),
      });
    } catch (error) {
      console.error('Failed to fetch badge counts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCounts();

    socket.on(SOCKET_EVENTS.DATA_UPDATED, () => {
      refreshCounts();
    });

    return () => {
      socket.off(SOCKET_EVENTS.DATA_UPDATED);
    };
  }, [refreshCounts]);

  return (
    <BadgeContext.Provider value={{ counts, dashboardData, loading, refreshCounts }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadges must be used within a BadgeProvider');
  }
  return context;
}
