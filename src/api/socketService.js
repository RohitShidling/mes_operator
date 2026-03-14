import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000/machines';

let socket = null;

export const socketService = {
  connect: (token) => {
    if (socket?.connected) return socket;

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    return socket;
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  getSocket: () => socket,

  // Emit events
  emit: (event, data = {}) => {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  },

  // Listen for events
  on: (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  },

  // Remove listener
  off: (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  },

  // Subscribe to machine updates
  subscribeMachine: (machineId) => {
    socketService.emit('machine:subscribe', { machineId });
  },

  // Unsubscribe from machine updates
  unsubscribeMachine: (machineId) => {
    socketService.emit('machine:unsubscribe', { machineId });
  },
};
