import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import WebRTCService from '../services/WebRTCService';

function LargeFileShare({ socket, onClose }) {
    // UI State
    const [step, setStep] = useState('join'); // join, waiting, connected, transferring
    const [roomId, setRoomId] = useState('');
    const [statusText, setStatusText] = useState('');
    const [progress, setProgress] = useState(0);
    const [transferType, setTransferType] = useState('');

    // Service
    const rtcService = useRef(null);

    // --- HANDLERS ---

    const handleStatusChange = useCallback((newStatus) => {
        console.log('RTC Status:', newStatus);
        if (newStatus === 'waiting') {
            setStep('waiting');
            setStatusText('Waiting for peer to join...');
        } else if (newStatus === 'connected') {
            setStep('connected'); // Establishing...
            setStatusText('Connecting securely...');
        } else if (newStatus === 'ready_to_transfer') {
            setStep('ready');
            setStatusText('Connected! Ready to send/receive.');
        } else if (newStatus === 'transferring') {
            setStep('transferring');
        } else if (newStatus === 'disconnected') {
            setStep('join');
            setStatusText('Peer disconnected.');
            toast.warn('Peer disconnected');
        }
    }, []);

    const handleProgress = useCallback((percent, type) => {
        setProgress(percent);
        setTransferType(type);
    }, []);

    const handleComplete = useCallback((name, fileBlob) => {
        if (fileBlob) {
            const url = URL.createObjectURL(fileBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Received ${name}!`);
        } else {
            toast.success(`Sent ${name}!`);
        }
        // Reset UI to ready state
        setStep('ready');
        setProgress(0);
    }, []);

    const handleError = useCallback((err) => {
        toast.error(err);
        setStep('join');
    }, []);

    // --- LIFECYCLE ---

    useEffect(() => {
        rtcService.current = new WebRTCService(
            socket,
            handleProgress,
            handleComplete,
            handleError,
            handleStatusChange
        );

        // Server Event Listeners
        const onP2PReady = (data) => {
            toast.info('Peer connected! Initializing encryption...');
            rtcService.current.handleP2PReady(data);
        };

        const onP2PError = (msg) => {
            toast.error(msg);
            setStep('join');
        };

        const onPeerLeft = () => {
            toast.warn('Peer left the room.');
            rtcService.current.reset(); // Stay in room, but reset connection? Or leave?
            // Spec says "Transfer fails gracefully".
            // Let's reset to Waiting state if we are still in room.
            setStep('waiting');
            setStatusText('Peer left. Waiting for new peer...');
        };

        const onOffer = (data) => rtcService.current.handleOffer(data.offer);
        const onAnswer = (data) => rtcService.current.handleAnswer(data.answer);
        const onCandidate = (data) => rtcService.current.handleCandidate(data.candidate);

        socket.on('p2p:ready', onP2PReady);
        socket.on('p2p:error', onP2PError);
        socket.on('p2p:peer-left', onPeerLeft);
        socket.on('webrtc:offer', onOffer);
        socket.on('webrtc:answer', onAnswer);
        socket.on('webrtc:ice-candidate', onCandidate);

        return () => {
            socket.off('p2p:ready', onP2PReady);
            socket.off('p2p:error', onP2PError);
            socket.off('p2p:peer-left', onPeerLeft);
            socket.off('webrtc:offer', onOffer);
            socket.off('webrtc:answer', onAnswer);
            socket.off('webrtc:ice-candidate', onCandidate);
            if (rtcService.current) rtcService.current.leaveP2PRoom();
        };
    }, [socket]);

    // --- ACTIONS ---

    const handleJoin = (e) => {
        e.preventDefault();
        if (!roomId.trim()) return;
        rtcService.current.joinP2PRoom(roomId.trim());
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            rtcService.current.sendFile(file);
        }
    };

    const handleCancel = () => {
        if (rtcService.current) rtcService.current.leaveP2PRoom();
        setStep('join');
        onClose();
    };

    return (
        <div className="fixed inset-0 min-h-screen z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#111] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">

                {/* Header */}
                <div className="bg-white/5 p-6 flex justify-between items-center border-b border-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-purple-400">⚡</span> P2P Transfer
                    </h2>
                    <button onClick={handleCancel} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="p-8">
                    {step === 'join' && (
                        <form onSubmit={handleJoin} className="space-y-6">
                            <div className="text-center">
                                <p className="text-gray-400 text-sm mb-4">
                                    Enter a unique Secret ID. Share this ID with one other person to connect directly.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Secret Request ID</label>
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg tracking-widest text-center focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-600"
                                    placeholder="e.g. SECRET-123"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)]"
                            >
                                Join Connection
                            </button>
                        </form>
                    )}

                    {step === 'waiting' && (
                        <div className="text-center py-8 space-y-4">
                            <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                            <h3 className="text-lg font-medium text-white">Waiting for Peer...</h3>
                            <p className="text-gray-400 text-sm">Tell your friend to join ID: <span className="text-purple-400 font-mono font-bold">{roomId}</span></p>
                            <button onClick={() => { rtcService.current.leaveP2PRoom(); setStep('join'); }} className="text-sm text-red-400 hover:text-red-300 underline">Cancel</button>
                        </div>
                    )}

                    {(step === 'connected' || step === 'ready') && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-center gap-2 text-green-400 bg-green-400/10 py-2 rounded-lg border border-green-400/20">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                <span className="text-sm font-bold">Securely Connected</span>
                            </div>

                            <label className="block w-full border-2 border-dashed border-white/10 rounded-xl p-8 text-center transition-all cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 group">
                                <input type="file" className="hidden" onChange={handleFileSelect} />
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <span className="text-3xl">📤</span>
                                </div>
                                <span className="text-white font-medium block">Send Large File</span>
                                <span className="text-gray-500 text-xs">Unlimited size • P2P</span>
                            </label>

                            <div className="text-center">
                                <p className="text-xs text-gray-500">Waiting for other user to send files...</p>
                            </div>
                        </div>
                    )}

                    {step === 'transferring' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-gray-300 capitalize">{transferType}...</span>
                                <span className="text-xs font-bold text-purple-400">{progress}%</span>
                            </div>
                            <div className="w-full bg-black/50 rounded-full h-3 overflow-hidden border border-white/5">
                                <div
                                    className="bg-gradient-to-r from-purple-600 to-blue-500 h-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <p className="text-center text-xs text-gray-400 animate-pulse">Do not close this window.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

LargeFileShare.propTypes = {
    socket: PropTypes.object,
    onClose: PropTypes.func.isRequired
};

export default LargeFileShare;
