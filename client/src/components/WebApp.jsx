import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import RoomInfo from './RoomInfo';
import TextShare from './TextShare';
import FileShare from './FileShare';
import CreateRoomModal from './modals/CreateRoomModal';
import JoinRoomModal from './modals/JoinRoomModal';
import RandomVideoChat from './RandomVideoChat';
import Logo from './Logo';
import api from '../api';

// Video Call Components
import { CallProvider } from '../context/CallContext';
import IncomingCallModal from './call/IncomingCallModal';
import ActiveCallView from './call/ActiveCallView';
import CallButton from './call/CallButton';
import Dock from './Navigation/Dock';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function WebApp() {
    const [roomId, setRoomId] = useState('');
    const [userCount, setUserCount] = useState(0);
    const [users, setUsers] = useState([]);
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
    const [showCallMenu, setShowCallMenu] = useState(false);
    const [showRandomChat, setShowRandomChat] = useState(false);

    // Stabilized Guest Identity - Wrapped in try-catch for iOS Safari Private Mode
    const { deviceId, guestId } = useMemo(() => {
        let dId = null;
        let gId = null;

        try {
            dId = localStorage.getItem('deviceId');
            gId = localStorage.getItem('guestId');

            if (!dId) {
                dId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
                localStorage.setItem('deviceId', dId);
            }

            if (!gId) {
                gId = Math.random().toString(36).substring(2, 10);
                localStorage.setItem('guestId', gId);
            }
        } catch (e) {
            console.warn('⚠️ LocalStorage not available, using in-memory identity');
            dId = 'guest_' + Math.random().toString(36).substring(2, 11);
            gId = 'guest_' + Math.random().toString(36).substring(2, 10);
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
            // Check for room in URL first
            const params = new URLSearchParams(window.location.search);
            const urlRoomId = params.get('room');

            if (urlRoomId) {
                console.log('🌐 Joining room from URL:', urlRoomId);
                setRoomId(urlRoomId);
                return;
            }

            const { data } = await api.get(`${SOCKET_URL}/api/room-info`);
            setRoomId(data.roomId);

            // Sync URL without refreshing (optional but good for UX)
            const newUrl = `${window.location.pathname}?room=${data.roomId}`;
            window.history.pushState({ path: newUrl }, '', newUrl);

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
        socket.on('connect_error', (err) => {
            console.error('⚠️ Socket Connection Error:', err.message);
            // Don't show toast for every error to avoid spam
        });

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
            setUsers(data.users || []);

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
        // Sync URL
        const newUrl = `${window.location.pathname}?room=${newRoomId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    };

    const handleManualJoin = (manualRoomId) => {
        setRoomId(manualRoomId);
        // Sync URL
        const newUrl = `${window.location.pathname}?room=${manualRoomId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
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
        <CallProvider socket={socketRef.current}>
            <div className="min-h-screen bg-black text-white selection:bg-[#20B2AA]/30">
                <ToastContainer {...toastOptions} theme="dark" />

                <header className="bg-transparent pt-safe px-4 md:px-6 sticky top-0 z-50 pointer-events-none">
                    <div className="max-w-7xl mx-auto flex items-center justify-between py-4 pointer-events-auto">
                        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full shadow-xl">
                            <Logo className="w-6 h-6 md:w-8 md:h-8 text-white" />
                            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                                {isConnected ? (
                                    <span className="flex items-center gap-2 text-[10px] md:text-xs text-[#20B2AA] font-bold tracking-wide">
                                        <span className="w-1.5 h-1.5 bg-[#20B2AA] rounded-full animate-pulse shadow-[0_0_8px_#20B2AA]"></span>
                                        Connected
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 text-[10px] md:text-xs text-red-500 font-bold tracking-wide">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                        Offline
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Video Call Button (kept in header for quick access) */}
                        <div className="relative">
                            <button
                                onClick={() => setShowCallMenu(!showCallMenu)}
                                className="relative w-10 h-10 md:w-auto md:px-4 md:py-2 bg-black/40 text-gray-300 rounded-full hover:bg-white/10 hover:text-white transition border border-white/10 flex items-center justify-center gap-2 backdrop-blur-xl shadow-xl"
                            >
                                <svg className="w-5 h-5 text-[#20B2AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span className="hidden md:inline font-medium">Video Call</span>
                                {users.length > 1 && (
                                    <span className="absolute -top-1 -right-1 unread-badge w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold shadow-lg">
                                        {users.length - 1}
                                    </span>
                                )}
                            </button>

                            {/* Dropdown Menu */}
                            {showCallMenu && (
                                <div className="absolute right-0 mt-3 w-72 bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 glass-panel">
                                    <div className="p-4 border-b border-white/5">
                                        <h3 className="font-bold text-white text-sm">People Nearby ({users.length - 1})</h3>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                        {users.filter(user => user.id !== deviceId).length > 0 ? (
                                            users
                                                .filter(user => user.id !== deviceId)
                                                .map(user => (
                                                    <div key={user.id} className="p-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center justify-between transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#20B2AA] to-[#1C9D96] flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-gray-200 text-sm font-medium">{user.name}</span>
                                                        </div>
                                                        <CallButton userId={user.id} userName={user.name} className="text-[10px] px-3 py-1.5 h-8" />
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="p-8 text-center text-gray-500 text-xs">
                                                <div className="text-2xl mb-2 opacity-30">🔭</div>
                                                No users online
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto px-4 relative z-10 pt-2 pb-6">
                    <RoomInfo
                        roomId={roomId}
                        userCount={userCount}
                        onCopyRoom={copyToClipboard}
                        onCloseRoom={handleCloseRoom}
                        isPrivate={false}
                    />
                </div>

                <main className="max-w-4xl mx-auto px-4 pb-32 md:pb-40 relative z-10 min-h-[60vh]">


                    <div className="fade-in min-h-[400px]">
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


                <footer className="py-8 border-t border-white/5 mt-auto bg-black/40 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-center md:text-left">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <Logo className="w-5 h-5 opacity-50" />

                            </div>

                        </div>
                        <div className="flex gap-6 text-gray-500">
                            <Link to="/privacy" className="hover:text-[#20B2AA] transition-colors">Privacy Policy</Link>
                            <Link to="/terms" className="hover:text-[#20B2AA] transition-colors">Terms of Service</Link>
                            <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
                        </div>
                    </div>
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
                    socket={socketRef.current}
                    deviceId={deviceId}
                />

                <Dock
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    onNewRoom={() => setShowCreateModal(true)}
                    onJoinRoom={() => setShowJoinModal(true)}
                    onRandomChat={() => setShowRandomChat(true)}
                />

                {showRandomChat && (
                    <RandomVideoChat
                        socket={socketRef.current}
                        deviceId={deviceId}
                        onClose={() => setShowRandomChat(false)}
                    />
                )}

                {/* Video Call UI Components */}
                <IncomingCallModal />
                <ActiveCallView />
            </div>
        </CallProvider>
    );
}

export default React.memo(WebApp);
