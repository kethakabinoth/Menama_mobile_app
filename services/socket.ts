import { io } from 'socket.io-client';

const SOCKET_URL = 'https://menama.up.railway.app';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
});

export const SOCKET_EVENTS = {
  DATA_UPDATED: 'DATA_UPDATED',
};
