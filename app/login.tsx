import { useRouter } from "expo-router";
import { LogIn } from "lucide-react-native";
import React, { useState } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import api from "../services/api";
import * as SecureStore from "../utils/storage";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const clearToken = async () => {
      await SecureStore.deleteItemAsync("token");
      await SecureStore.deleteItemAsync("username");
    };
    clearToken();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter username and password");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/login", { username, password });
      const { token } = response.data;
      await SecureStore.setItemAsync("token", token);
      await SecureStore.setItemAsync("username", username);
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Login Failed",
        error.response?.data?.message || "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Image
          source={require("../assets/images/logo.jpeg")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#3c4041af"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#3c4041af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            <LogIn color="white" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>
              {loading ? "Logging in..." : "Login"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 30,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? { maxWidth: 450, alignSelf: "center", width: "100%" }
      : {}),
  },
  logo: {
    width: 200,
    height: 250,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#666",
    marginBottom: 30,
  },
  inputContainer: {
    width: "100%",
  },
  input: {
    height: 55,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eee",
    fontSize: 16,
  },
  button: {
    height: 55,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 5px rgba(0, 122, 255, 0.3)" }
      : {
          shadowColor: "#007AFF",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 5,
        }),
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
