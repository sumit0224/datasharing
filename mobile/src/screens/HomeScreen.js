import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    SafeAreaView,
    StyleSheet,
    AppState,
    Platform,
    StatusBar,
    Clipboard,
    Alert,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import Toast from 'react-native-toast-message';

import AppHeader from '../components/AppHeader';
import ConnectionStatus from '../components/ConnectionStatus';
import TextShare from '../components/TextShare';
import FileShare from '../components/FileShare';
import NotificationBanner from '../components/NotificationBanner';

import { createSocket } from '../services/socket';
import api, { API_URL } from '../services/api';
import { getDeviceId, getGuestId } from '../utils/identity';

const Tab = createMaterialTopTabNavigator();

export default function HomeScreen() {
    const [roomId, setRoomId] = useState('');
    const [userCount, setUserCount] = useState(0);
    const [texts, setTexts] = useState([]);
    const [files, setFiles] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const [guestId, setGuestId] = useState('');
    const [notification, setNotification] = useState(null);

    const showNotification = useCallback((icon, text) => {
        setNotification({ icon, text, visible: true });
    }, []);



    useEffect(() => {
        // AppState handler for background/foreground
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                console.log('App has come to the foreground!');
                const socket = createSocket();
                if (!socket.connected) {
                    socket.connect();
                }
            }
        });

        // Initialize identity
        const initIdentity = async () => {
            const dId = await getDeviceId();
            const gId = await getGuestId();
            setDeviceId(dId);
            setGuestId(gId);
        };
        initIdentity();

        // Create socket connection
        const socket = createSocket();

        socket.on('connect', async () => {
            console.log('Connected to server');
            setIsConnected(true);

            // Fetch room info
            try {
                const response = await api.get('/api/room-info');
                const { roomId: fetchedRoomId } = response.data;
                setRoomId(fetchedRoomId);
                socket.emit('join_room', fetchedRoomId, deviceId, guestId);
            } catch (error) {
                console.error('Failed to fetch room info:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
        });

        socket.on('room_state', (data) => {
            setRoomId(data.roomId);
            setTexts(data.texts || []);
            setFiles(data.files || []);
            setUserCount(data.userCount || 0);

        });

        socket.on('user_count', (count) => {
            setUserCount(count);
        });

        socket.on('text_shared', (text) => {
            setTexts((prev) => [...prev, text]);
            showNotification('📝', 'New message shared');

        });

        socket.on('text_deleted', ({ id }) => {
            setTexts((prev) => prev.filter((t) => t.id !== id));
        });

        socket.on('file_shared', (file) => {
            setFiles((prev) => [...prev, file]);
            showNotification('📎', `${file.originalName}`);

        });

        socket.on('file_deleted', ({ id, reason }) => {
            setFiles((prev) => prev.filter((f) => f.id !== id));
            if (reason === 'expired') {
                Toast.show({
                    type: 'info',
                    text1: '🕒 File expired',
                });
            }
        });

        socket.on('room_error', (err) => {
            Toast.show({
                type: 'error',
                text1: 'Room Error',
                text2: err.message || 'An error occurred',
            });
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('room_state');
            socket.off('user_count');
            socket.off('text_shared');
            socket.off('text_deleted');
            socket.off('file_shared');
            socket.off('file_deleted');
            socket.off('room_error');
        };
    }, [deviceId, guestId]);

    const handleSendText = useCallback((content) => {
        if (!isConnected) {

            return;
        }
        const socket = createSocket();
        socket.emit('send_text', { content });
    }, [isConnected]);

    const handleDeleteText = useCallback((textId) => {
        const socket = createSocket();
        socket.emit('delete_text', textId);
    }, []);

    const handleUploadFile = useCallback(async (file) => {
        if (!isConnected) {
            Toast.show({
                type: 'error',
                text1: 'No Connection',
                text2: 'Connect to server to upload files',
            });
            return;
        }

        const formData = new FormData();
        formData.append('roomId', roomId);
        formData.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || 'application/octet-stream',
        });
        formData.append('guestId', guestId);
        formData.append('deviceId', deviceId);

        setIsUploading(true);

        try {
            await api.post('/api/upload', formData, {
                headers: {
                    'x-client-source': 'mobile',
                },
            });
            Toast.show({
                type: 'success',
                text1: 'Uploaded!',
            });
        } catch (error) {
            console.error('Upload failed:', error);
            Toast.show({
                type: 'error',
                text1: 'Upload failed',
                text2: error.response?.data?.error || 'Please try again',
            });
        } finally {
            setIsUploading(false);
        }
    }, [isConnected, roomId, guestId, deviceId]);

    const handleDeleteFile = useCallback(async (fileId) => {
        try {
            await api.delete(`/api/file/${fileId}`, {
                data: { roomId },
            });
            // Success handled by socket event
        } catch (error) {
            // If 404, it's already deleted, so we can ignore it
            if (error.response?.status === 404) {
                console.log('File already deleted on server');
                return;
            }
            console.error('Delete failed:', error);
            Toast.show({
                type: 'error',
                text1: 'Failed to delete file',
            });
        }
    }, [roomId]);

    const copyToClipboard = useCallback((text) => {
        Clipboard.setString(text);

    }, []);

    return (
        <View style={styles.container}>
            <AppHeader />
            <ConnectionStatus isConnected={isConnected} />

            <Tab.Navigator
                screenOptions={{
                    tabBarActiveTintColor: '#667eea',
                    tabBarInactiveTintColor: '#9ca3af',
                    tabBarIndicatorStyle: { backgroundColor: '#667eea', height: 3 },
                    tabBarStyle: {
                        backgroundColor: '#fff',
                        elevation: 0,
                        shadowOpacity: 0,
                        borderBottomWidth: 1,
                        borderBottomColor: '#f3f4f6'
                    },
                    tabBarLabelStyle: { fontWeight: '600', fontSize: 14, textTransform: 'none' },
                }}
            >
                <Tab.Screen name="Text">
                    {() => (
                        <TextShare
                            texts={texts}
                            onSendText={handleSendText}
                            onCopyText={copyToClipboard}
                            onDeleteText={handleDeleteText}
                            isConnected={isConnected}
                        />
                    )}
                </Tab.Screen>
                <Tab.Screen name="Files">
                    {() => (
                        <FileShare
                            files={files}
                            onUpload={handleUploadFile}
                            onDeleteFile={handleDeleteFile}
                            isUploading={isUploading}
                            isConnected={isConnected}
                        />
                    )}
                </Tab.Screen>
            </Tab.Navigator>

            <NotificationBanner
                message={notification}
                visible={notification?.visible}
                onHide={() => setNotification(null)}
            />

            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
});
