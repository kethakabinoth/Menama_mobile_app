import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// BASE_URL for the backend API
// according to the network u connected, url neet to be change while backend
const BASE_URL = 'https://august-azimuthal-semiclerically.ngrok-free.dev';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('SecureStore error', error);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear token and redirect to login if unauthorized
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('username');

    }
    return Promise.reject(error);
  }
);

export default api;
  

