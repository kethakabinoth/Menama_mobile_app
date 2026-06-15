import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { BadgeProvider } from "../context/BadgeContext";
import * as SecureStore from "../utils/storage";

import { useColorScheme } from "@/hooks/use-color-scheme";

const customTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#F7F8FA",
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await SecureStore.getItemAsync("token");
        const inTabsGroup = segments[0] === "(tabs)";

        if (!token && inTabsGroup) {
          router.replace("/login");
        }
      } catch (error) {
        console.error(error);
      }
      setIsReady(true);
    };

    checkAuth();
  }, [segments, router]);

  if (!isReady) return null;

  return (
    <ThemeProvider value={customTheme}>
      <BadgeProvider>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
      </BadgeProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
