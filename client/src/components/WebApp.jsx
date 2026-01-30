import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

function createSocket() {
    return io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });
}

function WebApp() {
    const [roomId, setRoomId] = useState('');
    const [userCount, setUserCount] = useState(0);
    const [texts, setTexts] = useState([]);
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeTab, setActiveTab] = useState('text');
    const [isConnected, setIsConnected] = useState(false);

    // Socket Reference
    const socketRef = React.useRef(null);

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

    const fetchRoomInfo = useCallback(async () => {
        try {
            const { data } = await api.get(`${SOCKET_URL}/api/room-info`);
            setRoomId(data.roomId);
            if (socketRef.current) {
                socketRef.current.emit('join_room', data.roomId, deviceId, guestId);
            }
        } catch (error) {
            console.error('Failed to fetch room info:', error);
            if (error.response?.status === 429) {
                toast.error('Too many requests. Please wait a moment.', toastOptions);
            } else {
                toast.error('Failed to connect to room server.', toastOptions);
            }
        }
    }, [deviceId, guestId, toastOptions]);

    useEffect(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        socketRef.current = createSocket();
        const socket = socketRef.current;

        const handleConnect = () => {
            console.log('Connected to server');
            setIsConnected(true);
            if (roomId) {
                socket.emit('join_room', roomId, deviceId, guestId);
            } else {
                fetchRoomInfo();
            }
        };

        const handleDisconnect = () => {
            console.log('Disconnected from server');
            setIsConnected(false);
            toast.warning('Connection lost. Attempting to reconnect...', toastOptions);
        };

        const handleRoomState = (data) => {
            setRoomId(data.roomId);
            setTexts(data.texts || []);
            setFiles(data.files || []);
            setUserCount(data.userCount);
            toast.success(`Joined room: ${data.roomId}`, toastOptions);
        };

        const handleRoomError = (err) => {
            toast.error(err.message || 'Room Error', toastOptions);
        };

        const handleUserCount = (count) => {
            setUserCount(count);
        };

        const handleTextShared = (text) => {
            setTexts((prev) => [...prev, text]);
            toast.info('New text shared!', toastOptions);
        };

        const handleTextDeleted = ({ id }) => {
            setTexts((prev) => prev.filter(t => t.id !== id));
            toast.info('Text deleted.', toastOptions);
        };

        const handleTextsCleared = () => {
            setTexts([]);
            toast.info('All texts cleared.', toastOptions);
        };

        const handleFileShared = (file) => {
            setFiles((prev) => [...prev, file]);
            toast.info(`New file: ${file.originalName}`, toastOptions);
        };

        const handleFileDeleted = ({ id, reason }) => {
            setFiles((prev) => prev.filter(f => f.id !== id));
            if (reason === 'expired') {
                toast.info('🕒 File expired and was automatically deleted.', toastOptions);
            } else {
                toast.info('File deleted.', toastOptions);
            }
        };

        const handleRoomClosed = () => {
            toast.warning('This room has expired or been closed.', toastOptions);
            setRoomId('');
            fetchRoomInfo();
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('room_state', handleRoomState);
        socket.on('room_error', handleRoomError);
        socket.on('user_count', handleUserCount);
        socket.on('text_shared', handleTextShared);
        socket.on('text_deleted', handleTextDeleted);
        socket.on('texts_cleared', handleTextsCleared);
        socket.on('file_shared', handleFileShared);
        socket.on('file_deleted', handleFileDeleted);
        socket.on('room_closed', handleRoomClosed);

        return () => {
            if (socket) {
                socket.off('connect', handleConnect);
                socket.off('disconnect', handleDisconnect);
                socket.off('room_state', handleRoomState);
                socket.off('room_error', handleRoomError);
                socket.off('user_count', handleUserCount);
                socket.off('text_shared', handleTextShared);
                socket.off('text_deleted', handleTextDeleted);
                socket.off('texts_cleared', handleTextsCleared);
                socket.off('file_shared', handleFileShared);
                socket.off('file_deleted', handleFileDeleted);
                socket.off('room_closed', handleRoomClosed);
                socket.disconnect();
            }
        };
    }, [toastOptions, roomId, deviceId, guestId, fetchRoomInfo]);

    const handleRoomCreated = (newRoomId) => {
        setRoomId(newRoomId);
        if (socketRef.current) {
            socketRef.current.emit('join_room', newRoomId, deviceId, guestId);
        }
    };

    const handleManualJoin = (manualRoomId) => {
        setRoomId(manualRoomId);
        if (socketRef.current) {
            socketRef.current.emit('join_room', manualRoomId, deviceId, guestId);
        }
    };

    const handleCloseRoom = useCallback(() => {
        if (socketRef.current) socketRef.current.emit('close_room');
    }, []);

    const handleSendText = useCallback((content) => {
        if (!isConnected) {
            toast.error('Not connected to server', toastOptions);
            return;
        }
        if (socketRef.current) socketRef.current.emit('send_text', { content });
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
            toast.success('File uploaded successfully!', toastOptions);
        } catch (error) {
            console.error('Upload failed:', error);
            if (error.response?.status === 429) {
                toast.error('Upload limit reached. Please wait before uploading again.', toastOptions);
            } else {
                toast.error(error.response?.data?.error || 'File upload failed.', toastOptions);
            }
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
            toast.success('Copied to clipboard!', toastOptions);
        }).catch((err) => {
            console.error('Copy failed:', err);
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
