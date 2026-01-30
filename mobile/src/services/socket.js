import io from 'socket.io-client';
import { API_URL } from './api';

let socket = null;

export const createSocket = () => {
    if (!socket) {
        socket = io(API_URL, {
            transports: ['websocket'], // Force websocket to avoid long-polling issues on mobile
            reconnection: true,
            reconnectionAttempts: Infinity, // Keep processing reconnection
            reconnectionDelay: 1000, // Start with 1s delay
            reconnectionDelayMax: 5000, // Max 5s delay
            timeout: 20000,
            autoConnect: true,
        });

        socket.on('connect_error', (err) => {
            console.log('Socket Connection Error:', err.message);
        });

        socket.on('reconnect_attempt', (val) => {
            console.log('Socket Reconnecting attempt:', val);
        });
    }
    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
