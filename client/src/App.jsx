import React, { useState, useEffect, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

import RoomInfo from './components/RoomInfo';
import TextShare from './components/TextShare';
import FileShare from './components/FileShare';
import AuthModal from './components/modals/AuthModal';
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
  const { user, isAuthenticated, logout } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [texts, setTexts] = useState([]);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('text');
  const [isConnected, setIsConnected] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
  useEffect(() => {
    if (socket) {
      socket.disconnect();
    }
    socket = createSocket();

    const handleConnect = () => {
      console.log('Connected to server');
      setIsConnected(true);
      fetchRoomInfo();
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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room_state', handleRoomState);
    socket.on('user_count', handleUserCount);
    socket.on('text_shared', handleTextShared);
    socket.on('file_shared', handleFileShared);
    socket.on('file_deleted', handleFileDeleted);

    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('room_state', handleRoomState);
        socket.off('user_count', handleUserCount);
        socket.off('text_shared', handleTextShared);
        socket.off('file_shared', handleFileShared);
        socket.off('file_deleted', handleFileDeleted);
      }
    };
  }, [toastOptions, isAuthenticated]);

  const fetchRoomInfo = useCallback(async () => {
    try {
      const { data } = await axios.get(`${SOCKET_URL}/api/room-info`);
      setRoomId(data.roomId);
      socket.emit('join_room', data.roomId, deviceId, guestId);
    } catch (error) {
      console.error('Failed to fetch room info:', error);
      toast.error('Failed to connect to room server.', toastOptions);
    }
  }, [toastOptions, deviceId, guestId]);

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
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600" role="navigation" aria-label="Main navigation">
            <button className="hover:text-gray-900 transition">How it works</button>
            <button className="hover:text-gray-900 transition">Download</button>
            <button className="hover:text-gray-900 transition">Upgrade</button>
            <button className="hover:text-gray-900 transition">Feedback</button>
            {isAuthenticated ? (
              <ProfileDropdown />
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="text-blue-600 hover:text-blue-700 transition">Login / Register</button>
            )}
          </nav>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 py-3 px-6 slide-down">
        <div className="max-w-7xl mx-auto">
          <RoomInfo
            roomId={roomId}
            userCount={userCount}
            onCopyRoom={copyToClipboard}
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
            className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${activeTab === 'text'
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
            className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${activeTab === 'files'
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
    </div>
  );
}

export default React.memo(App);
