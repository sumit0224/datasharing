import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import RoomInfo from './RoomInfo';
import TextShare from './TextShare';
import FileShare from './FileShare';
import CreateRoomModal from './modals/CreateRoomModal';
import JoinRoomModal from './modals/JoinRoomModal';
import Logo from './Logo';
import api from '../api';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function WebApp() {
    const [roomId, setRoomId] = useState('');
    const [userCount, setUserCount] = useState(0);
    const [texts, setTexts] = useState([]);
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeTab, setActiveTab] = useState('text');
    const [isConnected, setIsConnected] = useState(false);

    // Refs for stable state access in listeners
    const socketRef = useRef(null);
    const processedIdsRef = useRef(new Set()); // Deduplication
    const sessionStartTime = useRef(Date.now()); // Session start timestamp

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Stabilized Guest Identity
    const { deviceId, guestId } = useMemo(() => {
        let dId = localStorage.getItem('deviceId');
        let gId = localStorage.getItem('guestId');

        if (!dId) {
            dId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
            localStorage.setItem('deviceId', dId);
        }

        if (!gId) {
            gId = Math.random().toString(36).substring(2, 10);
            localStorage.setItem('guestId', gId);
        }

        return { deviceId: dId, guestId: gId };
    }, []);

    const toastOptions = useMemo(() => ({
        position: "top-center",
        theme: "light",
        autoClose: 3000,
        hideProgressBar: false
    }), []);

    // Fetch initial room info (REST API)
    const fetchRoomInfo = useCallback(async () => {
        try {
            const { data } = await api.get(`${SOCKET_URL}/api/room-info`);
            setRoomId(data.roomId);
            // We do NOT manually emit join_room here anymore; 
            // the socket connection effect handles joining based on roomId state.
        } catch (error) {
            console.error('Failed to fetch room info:', error);
            if (error.response?.status === 429) {
                toast.error('Too many requests. Please wait a moment.', toastOptions);
            } else {
                toast.error('Failed to connect to room server.', toastOptions);
            }
        }
    }, [toastOptions]);

    // 1. Socket Initialization & Lifecycle Effect
    useEffect(() => {
        // Initialize Socket only once
        if (!socketRef.current) {
            socketRef.current = io(SOCKET_URL, {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
                transports: ['websocket', 'polling']
            });
        }
        const socket = socketRef.current;

        const onConnect = () => {
            console.log('✅ Socket Connected:', socket.id);
            setIsConnected(true);
        };

        const onDisconnect = () => {
            console.log('❌ Socket Disconnected');
            setIsConnected(false);
            toast.warning('Connection lost. Reconnecting...', toastOptions);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        // Fetch initial room info on mount if needed
        fetchRoomInfo();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.disconnect();
            socketRef.current = null;
        };
    }, []); // Run ONCE on mount

    // 2. Room Joining & Event Listeners Effect
    // Runs when roomId changes (to switch rooms) or deviceId/guestId changes
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !roomId) return;

        console.log(`🔌 Registering listeners for room: ${roomId}`);

        // Join the room
        socket.emit('join_room', roomId, deviceId, guestId);

        // Event: Room State Sync (History)
        const handleRoomState = (data) => {
            if (data.roomId !== roomId) return; // Ignore events for other rooms
            console.log('📥 Room State Received:', data);

            setRoomId(data.roomId);
            setUserCount(data.userCount);

            // Sync Lists
            // Mark all existing IDs as processed to prevent duplicates
            data.texts?.forEach(t => processedIdsRef.current.add(t.id));
            data.files?.forEach(f => processedIdsRef.current.add(f.id));

            setTexts(data.texts || []);
            setFiles(data.files || []);

            // NOTE: We do NOT show "New Message" toasts for room_state history
        };

        // Event: User Count
        const handleUserCount = (count) => {
            setUserCount(count);
        };

        // Event: New Text Shared
        const handleTextShared = (text) => {
            // Deduplication Check
            if (processedIdsRef.current.has(text.id)) return;
            processedIdsRef.current.add(text.id);

            // Timestamp Check (Optional: Strict Session Mode)
            // If the text timestamp is OLDER than when we opened the app, 
            // and it wasn't in the initial sync, it might be a ghost/delayed packet.
            // However, usually we trust real-time events. 
            // We just ensure we don't duplicate.

            setTexts((prev) => [...prev, text]);
            toast.info('New text shared!', toastOptions);
        };

        // Event: Text Deleted
        const handleTextDeleted = ({ id }) => {
            setTexts((prev) => prev.filter(t => t.id !== id));
            processedIdsRef.current.delete(id); // Allow re-add if needed (unlikely)
            toast.info('Text deleted.', toastOptions);
        };

        // Event: Texts Cleared
        const handleTextsCleared = () => {
            setTexts([]);
            processedIdsRef.current.clear();
            toast.info('All texts cleared.', toastOptions);
        };

        // Event: File Shared
        const handleFileShared = (file) => {
            if (processedIdsRef.current.has(file.id)) return;
            processedIdsRef.current.add(file.id);

            setFiles((prev) => [...prev, file]);
            toast.info(`New file: ${file.originalName}`, toastOptions);
        };

        // Event: File Deleted
        const handleFileDeleted = ({ id, reason }) => {
            setFiles((prev) => prev.filter(f => f.id !== id));
            processedIdsRef.current.delete(id);
            if (reason === 'expired') {
                toast.info('🕒 File expired.', toastOptions);
            } else {
                toast.info('File deleted.', toastOptions);
            }
        };

        // Event: Room Closed
        const handleRoomClosed = () => {
            toast.warning('Room closed/expired.', toastOptions);
            setRoomId(''); // This will trigger cleanup of this effect
            fetchRoomInfo(); // Finds a new room
        };

        const handleRoomError = (err) => {
            toast.error(err.message, toastOptions);
        };

        // Register handlers
        socket.on('room_state', handleRoomState);
        socket.on('user_count', handleUserCount);
        socket.on('text_shared', handleTextShared);
        socket.on('text_deleted', handleTextDeleted);
        socket.on('texts_cleared', handleTextsCleared);
        socket.on('file_shared', handleFileShared);
        socket.on('file_deleted', handleFileDeleted);
        socket.on('room_closed', handleRoomClosed);
        socket.on('room_error', handleRoomError);

        // CLEANUP Listeners
        return () => {
            console.log(`🧹 Cleaning up listeners for room: ${roomId}`);
            socket.off('room_state', handleRoomState);
            socket.off('user_count', handleUserCount);
            socket.off('text_shared', handleTextShared);
            socket.off('text_deleted', handleTextDeleted);
            socket.off('texts_cleared', handleTextsCleared);
            socket.off('file_shared', handleFileShared);
            socket.off('file_deleted', handleFileDeleted);
            socket.off('room_closed', handleRoomClosed);
            socket.off('room_error', handleRoomError);

            // Note: We DO NOT disconnect the socket here, 
            // only remove listeners because we might just be switching rooms
        };
    }, [roomId, deviceId, guestId, toastOptions]); // Depend on roomId

    const handleRoomCreated = (newRoomId) => {
        setRoomId(newRoomId);
        // Effect will handle joining
    };

    const handleManualJoin = (manualRoomId) => {
        setRoomId(manualRoomId);
        // Effect will handle joining
    };

    const handleCloseRoom = useCallback(() => {
        if (socketRef.current) socketRef.current.emit('close_room');
    }, []);

    const handleSendText = useCallback((content) => {
        if (!isConnected || !socketRef.current) {
            toast.error('Not connected to server', toastOptions);
            return;
        }
        socketRef.current.emit('send_text', { content });
    }, [isConnected, toastOptions]);

    const handleDeleteText = useCallback((textId) => {
        if (socketRef.current) socketRef.current.emit('delete_text', textId);
    }, []);

    const handleUploadFile = useCallback(async (file) => {
        if (!isConnected) {
            toast.error('Not connected to server', toastOptions);
            return;
        }

        const formData = new FormData();
        formData.append('roomId', roomId);
        formData.append('file', file);
        if (guestId) formData.append('guestId', guestId);
        if (deviceId) formData.append('deviceId', deviceId);

        setIsUploading(true);
        setUploadProgress(0);

        try {
            await api.post(`${SOCKET_URL}/api/upload`, formData, {
                headers: {
                    'Content-Type': undefined, // Let browser set boundary
                    'x-client-source': 'web'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });
            toast.success('File uploaded!', toastOptions);
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error(error.response?.data?.error || 'Upload failed.', toastOptions);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    }, [isConnected, roomId, guestId, deviceId, toastOptions]);

    const handleDeleteFile = useCallback(async (fileId) => {
        try {
            await api.delete(`${SOCKET_URL}/api/file/${fileId}`, {
                data: { roomId }
            });
            toast.success('File deleted.', toastOptions);
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete file.', toastOptions);
        }
    }, [roomId, toastOptions]);

    const copyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Copied!', toastOptions);
        }).catch(() => {
            toast.error('Failed to copy', toastOptions);
        });
    }, [toastOptions]);

    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            <ToastContainer {...toastOptions} />

            <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="w-8 h-8 md:w-10 md:h-10" />
                        <div className="flex items-center gap-3 ml-4">
                            {isConnected ? (
                                <span className="flex items-center gap-1 text-xs text-green-600" title="Connected">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    Connected
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-red-600" title="Disconnected">
                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                    Disconnected
                                </span>
                            )}
                        </div>
                    </div>
                    <nav className="hidden md:flex items-center gap-4 text-sm text-gray-600" role="navigation" aria-label="Main navigation">
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition shadow-sm font-medium"
                        >
                            Join Room
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition shadow-sm font-medium"
                        >
                            + New Room
                        </button>
                    </nav>

                    <button
                        className="md:hidden p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        aria-label="Toggle mobile menu"
                    >
                        {showMobileMenu ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>

                {showMobileMenu && (
                    <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-xl z-50 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col p-4 space-y-3">
                            <button
                                onClick={() => { setShowJoinModal(true); setShowMobileMenu(false); }}
                                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium text-gray-700 transition"
                            >
                                Join Room
                            </button>
                            <button
                                onClick={() => { setShowCreateModal(true); setShowMobileMenu(false); }}
                                className="w-full text-left px-4 py-3 bg-black text-white hover:bg-gray-800 rounded-lg font-medium transition shadow-sm"
                            >
                                + New Room
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <div className="bg-white border-b border-gray-200 py-3 px-6 slide-down">
                <div className="max-w-7xl mx-auto">
                    <RoomInfo
                        roomId={roomId}
                        userCount={userCount}
                        onCopyRoom={copyToClipboard}
                        onCloseRoom={handleCloseRoom}
                        isPrivate={false}
                    />
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 py-12">
                <div className="flex gap-4 mb-6" role="tablist" aria-label="Content tabs">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'text'}
                        onClick={() => handleTabChange('text')}
                        className={`flex-1 justify-center flex items-center gap-2 px-6 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${activeTab === 'text'
                            ? 'bg-white shadow-md border border-gray-200 text-gray-900'
                            : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        Text
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'files'}
                        onClick={() => handleTabChange('files')}
                        className={`flex-1 justify-center flex items-center gap-2 px-6 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${activeTab === 'files'
                            ? 'bg-white shadow-md border border-gray-200 text-gray-900'
                            : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        Files
                    </button>
                </div>

                <div className="fade-in">
                    {activeTab === 'text' ? (
                        <div id="text-panel">
                            <TextShare
                                texts={texts}
                                onSendText={handleSendText}
                                onCopyText={copyToClipboard}
                                onDeleteText={handleDeleteText}
                                isConnected={isConnected}
                            />
                        </div>
                    ) : (
                        <div id="files-panel">
                            <FileShare
                                files={files}
                                onUpload={handleUploadFile}
                                onDeleteFile={handleDeleteFile}
                                isUploading={isUploading}
                                uploadProgress={uploadProgress}
                                isConnected={isConnected}
                            />
                        </div>
                    )}
                </div>
            </main>

            <footer className="text-center py-6 text-sm text-gray-500">
                <p>© {new Date().getFullYear()} Wifi Sharing</p>
            </footer>

            <CreateRoomModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onRoomCreated={handleRoomCreated}
                apiUrl={SOCKET_URL}
            />

            <JoinRoomModal
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                onJoinRoom={handleManualJoin}
            />
        </div>
    );
}

export default React.memo(WebApp);
