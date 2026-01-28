import React, { useState, useEffect, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

import RoomInfo from './components/RoomInfo';
import TextShare from './components/TextShare';
import FileShare from './components/FileShare';
import AuthModal from './components/modals/AuthModal';
import CreateRoomModal from './components/modals/CreateRoomModal';
import JoinRoomModal from './components/modals/JoinRoomModal';
import PasswordModal from './components/modals/PasswordModal';
import ProfileDropdown from './components/ProfileDropdown';
import { useAuth } from './context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket = null;

function createSocket() {
  return io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    withCredentials: true
  });
}

function App() {
  const { isAuthenticated } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [texts, setTexts] = useState([]);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('text');
  const [isConnected, setIsConnected] = useState(false);

  // Modals & Auth State
  // Modals & Auth State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Private Room State
  const [roomPassword, setRoomPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Generate or retrieve unique device ID
  // Stabilized Guest Identity
  const { deviceId, guestId } = useMemo(() => {
    let dId = localStorage.getItem('deviceId');
    let gId = localStorage.getItem('guestId');

    if (!dId) {
      dId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('deviceId', dId);
    }

    if (!gId) {
      // 8-char stable ID for guest names
      gId = Math.random().toString(36).substring(2, 10);
      localStorage.setItem('guestId', gId);
    }

    return { deviceId: dId, guestId: gId };
  }, []);

  const toastOptions = useMemo(() => ({
    position: "bottom-right",
    theme: "light",
    autoClose: 3000,
    hideProgressBar: false
  }), []);

  // Socket initialization and reconnection on auth change
  const fetchRoomInfo = useCallback(async () => {
    try {
      // Default to public room based on IP if no specific ID
      const { data } = await axios.get(`${SOCKET_URL}/api/room-info`);
      setRoomId(data.roomId);
      // Try joining without password first
      socket.emit('join_room', data.roomId, '', deviceId, guestId);
    } catch (error) {
      console.error('Failed to fetch room info:', error);
      toast.error('Failed to connect to room server.', toastOptions);
    }
  }, [toastOptions, deviceId, guestId]);

  // Socket initialization and reconnection on auth change
  useEffect(() => {
    if (socket) {
      socket.disconnect();
    }
    socket = createSocket();

    const handleConnect = () => {
      console.log('Connected to server');
      setIsConnected(true);
      if (roomId) {
        // Re-join logic if socket reconnects
        socket.emit('join_room', roomId, roomPassword, deviceId, guestId);
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
      setIsPrivate(data.isPrivate || false);

      // If we successfully joined, close password modal
      setShowPasswordModal(false);

      toast.success(`Joined room: ${data.roomId}`, toastOptions);
    };

    const handleRoomError = (err) => {
      if (err.code === 'INVALID_PASSWORD') {
        setShowPasswordModal(true);
        toast.error('Password required for private room', toastOptions);
      } else if (err.code === 'TOO_MANY_ATTEMPTS') {
        toast.error('Too many failed attempts. Please wait.', toastOptions);
      } else {
        toast.error(err.message || 'Room Error', toastOptions);
      }
    };

    const handleUserCount = (count) => {
      setUserCount(count);
    };

    const handleTextShared = (text) => {
      setTexts((prev) => [...prev, text]);
      toast.info('New text shared!', toastOptions);
    };

    const handleFileShared = (file) => {
      setFiles((prev) => [...prev, file]);
      toast.info(`New file: ${file.originalName}`, toastOptions);
    };

    const handleFileDeleted = ({ id }) => {
      setFiles((prev) => prev.filter(f => f.id !== id));
    };

    const handleRoomClosed = () => {
      toast.warning('This room has expired or been closed.', toastOptions);
      setRoomId('');
      setIsPrivate(false);
      fetchRoomInfo(); // Go back to default/new room
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room_state', handleRoomState);
    socket.on('room_error', handleRoomError);
    socket.on('user_count', handleUserCount);
    socket.on('text_shared', handleTextShared);
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
        socket.off('file_shared', handleFileShared);
        socket.off('file_deleted', handleFileDeleted);
        socket.off('room_closed', handleRoomClosed);
      }
    };
  }, [toastOptions, isAuthenticated, roomId, roomPassword, deviceId, guestId, fetchRoomInfo]); // Re-run if ID/Pass changes to re-bind reconnect logic? careful with loops

  // Private Room Logic
  const handleRoomCreated = (newRoomId, password) => {
    setRoomId(newRoomId);
    setRoomPassword(password || '');
    // Socket join
    socket.emit('join_room', newRoomId, password, deviceId, guestId);
  };

  const handleUnlockRoom = (password) => {
    setRoomPassword(password);
    socket.emit('join_room', roomId, password, deviceId, guestId);
  };

  const handleManualJoin = (manualRoomId) => {
    setRoomId(manualRoomId);
    setRoomPassword('');
    socket.emit('join_room', manualRoomId, '', deviceId, guestId);
  };

  const handleCloseRoom = useCallback(() => {
    if (window.confirm('Are you sure you want to CLOSE and DESTROY this room? Use this only if you want to kick everyone out.')) {
      socket.emit('close_room');
    }
  }, []);

  const handleSendText = useCallback((content) => {
    if (!isConnected) {
      toast.error('Not connected to server', toastOptions);
      return;
    }
    socket.emit('send_text', { content });
  }, [isConnected, toastOptions]);

  const handleUploadFile = useCallback(async (file) => {
    if (!isConnected) {
      toast.error('Not connected to server', toastOptions);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await axios.post(`${SOCKET_URL}/api/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      toast.success('File uploaded successfully!', toastOptions);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.error || 'File upload failed.', toastOptions);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [isConnected, roomId, toastOptions]);

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
            <h1 className="text-3xl font-bold italic bg-gradient-to-br from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
              matchingo
            </h1>
            <div className="flex items-center gap-2">
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
            {isPrivate && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full flex items-center gap-1">
                🔒 Private
              </span>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-4 text-sm text-gray-600" role="navigation" aria-label="Main navigation">
            {isAuthenticated && (
              <>
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
              </>
            )}
            {isAuthenticated ? (
              <ProfileDropdown />
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="text-blue-600 hover:text-blue-700 transition">Login / Register</button>
            )}
          </nav>

          {/* Mobile Menu Button */}
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

        {/* Mobile Menu Overlay */}
        {showMobileMenu && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-xl z-50 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col p-4 space-y-3">
              {isAuthenticated ? (
                <>
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
                  <div className="pt-2 border-t border-gray-100">
                    {/* We can re-use profile dropdown or simplified profile items here. For now, let's keep it simple or hide profile actions if complex. */}
                    <div className="flex justify-center pt-2">
                      <ProfileDropdown />
                    </div>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => { setShowAuthModal(true); setShowMobileMenu(false); }}
                  className="w-full text-center px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Login / Register
                </button>
              )}
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
            isPrivate={isPrivate}
          />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex gap-4 mb-6" role="tablist" aria-label="Content tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'text'}
            aria-controls="text-panel"
            onClick={() => handleTabChange('text')}
            className={`flex-1 justify-center flex items-center gap-2 px-6 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${activeTab === 'text'
              ? 'bg-white shadow-md border border-gray-200 text-gray-900'
              : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 4h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1z" />
            </svg>
            Text
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'files'}
            aria-controls="files-panel"
            onClick={() => handleTabChange('files')}
            className={`flex-1 justify-center flex items-center gap-2 px-6 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${activeTab === 'files'
              ? 'bg-white shadow-md border border-gray-200 text-gray-900'
              : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            Files
          </button>
        </div>

        <div className="fade-in">
          {activeTab === 'text' ? (
            <div id="text-panel" role="tabpanel" aria-labelledby="text-tab">
              <TextShare
                texts={texts}
                onSendText={handleSendText}
                onCopyText={copyToClipboard}
                isConnected={isConnected}
              />
            </div>
          ) : (
            <div id="files-panel" role="tabpanel" aria-labelledby="files-tab">
              <FileShare
                files={files}
                onUpload={handleUploadFile}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                isConnected={isConnected}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-6 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Matchingo</p>
        <p className="mt-1">Made by ❤️ sumit gautam</p>
      </footer>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* New Modals */}
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

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handleUnlockRoom}
      />
    </div>
  );
}

export default React.memo(App);
