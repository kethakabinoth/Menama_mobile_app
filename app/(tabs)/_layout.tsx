import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
// TabBarBackground and Colors were pointing to missing files. 
// Using theme.ts for Colors and removing TabBarBackground.
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FileText, HandCoins, HardHat, LayoutDashboard, TrendingUp } from 'lucide-react-native';
import { useBadges } from '../../context/BadgeContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { counts } = useBadges();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: true,
        headerTitle: '',
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales-orders"
        options={{
          title: 'Sales Orders',
          tabBarIcon: ({ color }) => <TrendingUp size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quotations"
        options={{
          title: 'Quotations',
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
          tabBarBadge: counts.quotations > 0 ? counts.quotations : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF3B30' },
        }}
      />
      <Tabs.Screen
        name="costings"
        options={{
          title: 'Costings',
          tabBarIcon: ({ color }) => <HardHat size={24} color={color} />,
          tabBarBadge: counts.costings > 0 ? counts.costings : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF3B30' },
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'All Payments',
          tabBarIcon: ({ color }) => <HandCoins size={24} color={color} />,
          tabBarBadge: counts.totalPayments > 0 ? counts.totalPayments : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF3B30' },
        }}
      />
    </Tabs>
  );
}
