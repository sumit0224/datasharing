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
    const [showMobileMenu, setShowMobileMenu] = useState(false);
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

                <header className="bg-black/80 border-b border-white/5 py-3 md:py-4 px-4 md:px-6 sticky top-0 z-50 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Logo className="w-8 h-8 md:w-10 md:h-10 text-white" />
                            <div className="flex items-center gap-3 ml-4">
                                {isConnected ? (
                                    <span className="flex items-center gap-2 text-xs text-[#20B2AA] font-medium tracking-wide bg-[#20B2AA]/10 px-2 py-1 rounded-full border border-[#20B2AA]/20" title="Connected">
                                        <span className="w-1.5 h-1.5 bg-[#20B2AA] rounded-full animate-pulse shadow-[0_0_8px_#20B2AA]"></span>
                                        Connected
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 text-xs text-red-500 font-medium tracking-wide bg-red-500/10 px-2 py-1 rounded-full border border-red-500/20" title="Disconnected">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                        Disconnected
                                    </span>
                                )}
                            </div>
                        </div>
                        <nav className="hidden md:flex items-center gap-3 text-sm font-medium" role="navigation" aria-label="Main navigation">
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 hover:text-white transition border border-white/5 backdrop-blur-sm"
                            >
                                Join Room
                            </button>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2 bg-[#20B2AA] text-black rounded-lg hover:bg-[#1C9D96] transition shadow-[0_0_15px_-3px_rgba(32,178,170,0.3)] hover:shadow-[0_0_20px_-3px_rgba(32,178,170,0.5)] active:scale-95 duration-200 font-bold"
                            >
                                + New Room
                            </button>

                            {/* Random Chat Button */}
                            <button
                                onClick={() => setShowRandomChat(true)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 text-purple-200 rounded-lg transition border border-purple-500/20 flex items-center gap-2 group"
                            >
                                <span className="group-hover:scale-110 transition-transform">🌍</span>
                                <span className="text-white/90">Random Chat</span>
                            </button>

                            {/* Video Call Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowCallMenu(!showCallMenu)}
                                    className="relative px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 hover:text-white transition border border-white/5 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-[#20B2AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Video Call
                                    {users.length > 1 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                            {users.length - 1}
                                        </span>
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {showCallMenu && (
                                    <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                                        <div className="p-4 border-b border-white/10">
                                            <h3 className="font-bold text-white">People Nearby ({users.length - 1})</h3>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {users.filter(user => user.id !== deviceId).length > 0 ? (
                                                users
                                                    .filter(user => user.id !== deviceId)
                                                    .map(user => (
                                                        <div key={user.id} className="p-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#20B2AA] to-[#1C9D96] flex items-center justify-center text-white text-sm font-bold">
                                                                    {user.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-white text-sm">{user.name}</span>
                                                            </div>
                                                            <CallButton userId={user.id} userName={user.name} className="text-xs px-3 py-1.5" />
                                                        </div>
                                                    ))
                                            ) : (
                                                <div className="p-6 text-center text-gray-500 text-sm">
                                                    No users online
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </nav>

                        <button
                            className="md:hidden p-2 text-gray-400 hover:text-white focus:outline-none"
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

                    {/* Mobile Menu Backdrop */}
                    {showMobileMenu && (
                        <div
                            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                            onClick={() => setShowMobileMenu(false)}
                        />
                    )}

                    {showMobileMenu && (
                        <div className="md:hidden absolute top-full left-0 right-0 bg-[#0F1629] border-b border-white/10 shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200 overflow-hidden">
                            <div className="flex flex-col p-4 space-y-3">
                                <button
                                    onClick={() => { setShowJoinModal(true); setShowMobileMenu(false); }}
                                    className="w-full text-left px-5 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-medium text-gray-200 transition flex items-center justify-between group"
                                >
                                    <span>Join Room</span>
                                    <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => { setShowCreateModal(true); setShowMobileMenu(false); }}
                                    className="w-full text-left px-5 py-4 bg-[#20B2AA]/10 text-[#20B2AA] hover:bg-[#20B2AA]/20 rounded-2xl font-bold transition flex items-center justify-between group border border-[#20B2AA]/20"
                                >
                                    <span>+ New Room</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>

                                {/* Video Call in Mobile Menu */}
                                <div className="pt-2">
                                    <div className="px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Users ({users.length - 1})</div>
                                    <div className="space-y-2 mt-1">
                                        {users.filter(user => user.id !== deviceId).length > 0 ? (
                                            users
                                                .filter(user => user.id !== deviceId)
                                                .map(user => (
                                                    <div key={user.id} className="px-5 py-3 bg-white/5 rounded-2xl flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#20B2AA] to-[#1C9D96] flex items-center justify-center text-white text-sm font-bold">
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-white text-sm font-medium">{user.name}</span>
                                                        </div>
                                                        <CallButton userId={user.id} userName={user.name} className="text-xs px-3 py-1.5" />
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="px-5 py-4 text-gray-500 text-xs text-center bg-white/5 rounded-2xl border border-dashed border-white/5">
                                                No one online to call
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </header>

                <div className="bg-black border-b border-white/5 py-3 md:py-4 px-4 md:px-6 relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#20B2AA]/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="max-w-7xl mx-auto relative z-10">
                        <RoomInfo
                            roomId={roomId}
                            userCount={userCount}
                            onCopyRoom={copyToClipboard}
                            onCloseRoom={handleCloseRoom}
                            isPrivate={false}
                        />
                    </div>
                </div>

                <main className="max-w-4xl mx-auto px-4 py-6 md:py-12 relative z-10">
                    <div className="flex gap-4 mb-8 p-1 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm" role="tablist" aria-label="Content tabs">
                        <button
                            role="tab"
                            aria-selected={activeTab === 'text'}
                            onClick={() => handleTabChange('text')}
                            className={`flex-1 justify-center flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${activeTab === 'text'
                                ? 'bg-[#20B2AA] text-black shadow-lg shadow-[#20B2AA]/20 font-bold'
                                : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <svg className={`w-5 h-5 ${activeTab === 'text' ? 'text-black' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            Text Chat
                        </button>
                        <button
                            role="tab"
                            aria-selected={activeTab === 'files'}
                            onClick={() => handleTabChange('files')}
                            className={`flex-1 justify-center flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${activeTab === 'files'
                                ? 'bg-[#20B2AA] text-black shadow-lg shadow-[#20B2AA]/20 font-bold'
                                : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <svg className={`w-5 h-5 ${activeTab === 'files' ? 'text-black' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            File Transfer
                        </button>
                    </div>

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
