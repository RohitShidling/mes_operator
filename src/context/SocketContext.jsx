import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { socketService } from '../api/socketService';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [listeners, setListeners] = useState({});

  useEffect(() => {
    if (!isAuthenticated) {
      setConnected(false);
      return;
    }

    const token = localStorage.getItem('operator_token');
    if (!token) return;

    const socket = socketService.connect(token);

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [isAuthenticated]);

  const subscribe = useCallback((event, callback) => {
    socketService.on(event, callback);
    return () => socketService.off(event, callback);
  }, []);

  const emit = useCallback((event, data) => {
    socketService.emit(event, data);
  }, []);

  const value = {
    connected,
    subscribe,
    emit,
    subscribeMachine: socketService.subscribeMachine,
    unsubscribeMachine: socketService.unsubscribeMachine,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
