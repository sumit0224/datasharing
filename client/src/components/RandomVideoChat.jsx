import React, { useState, useEffect, useRef, useCallback } from 'react';
import CallSocketService from '../services/CallSocketService';
import WebRTCService from '../services/WebRTCService';
import './RandomVideoChat.scss';
import Globe3D from './Globe3D';

const RandomVideoChat = ({ socket, deviceId, onClose }) => {
    // State
    const [status, setStatus] = useState('idle'); // idle, searching, matched, in_call
    const [partnerId, setPartnerId] = useState(null);
    const [roomId, setRoomId] = useState(null);
    const [searchingCount, setSearchingCount] = useState(0);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [connectionState, setConnectionState] = useState('new');

    // Refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const callServiceRef = useRef(null);
    const webrtcServiceRef = useRef(null);

    // Initialize services
    useEffect(() => {
        if (!socket) return;

        callServiceRef.current = new CallSocketService(socket);
        webrtcServiceRef.current = new WebRTCService();

        // Setup event listeners
        callServiceRef.current.attachListeners({
            onRandomSearching: handleSearching,
            onRandomMatched: handleMatched,
            onRandomChatEnded: handleChatEnded,
            onRandomError: handleError,

            // WebRTC Signaling
            onOffer: handleOffer,
            onAnswer: handleAnswer,
            onIceCandidate: handleIceCandidate
        });

        // WebRTC Callbacks
        webrtcServiceRef.current.onRemoteStream = (stream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }
        };

        webrtcServiceRef.current.onConnectionStateChange = (state) => {
            setConnectionState(state);
            if (state === 'failed' || state === 'disconnected') {
                // handle unexpected drops
            }
        };

        return () => {
            if (status !== 'idle') {
                callServiceRef.current?.endRandomChat();
            }
            callServiceRef.current?.destroy();
            webrtcServiceRef.current?.cleanup();
        };
    }, [socket]); // Re-run if socket changes (unlikely)

    // --- EVENT HANDLERS ---

    const handleSearching = ({ searchingCount }) => {
        setSearchingCount(searchingCount);
    };

    const handleMatched = async ({ partnerId, roomId, partnerRegion }) => {
        console.log('✅ Matched with:', partnerId);
        setPartnerId(partnerId);
        setRoomId(roomId);
        setStatus('matched');

        try {
            // 1. Initialize WebRTC
            await webrtcServiceRef.current.initializePeerConnection();

            // 2. Get User Media
            const stream = await webrtcServiceRef.current.getUserMedia();
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // 3. Initiate Offer (if I am the one who initiates, usually alphabetically or random, but here let's say the one who got 'matched' first? 
            // Actually, `createRandomMatch` in server doesn't specify initiator.
            // Server emits `random:matched` to both.
            // We need a tie-breaker. Let's strictly use alphanumeric comparison of IDs.
            // If my ID > partner ID, I create offer.

            if (deviceId > partnerId) {
                console.log('🏁 I am the initiator');
                initiateCall(partnerId);
            } else {
                console.log('⏳ I am the receiver');
            }

            setStatus('in_call');
        } catch (error) {
            console.error('Failed to start video:', error);
            handleError({ message: 'Camera access denied or connection failed' });
        }
    };

    const handleChatEnded = ({ reason }) => {
        console.log('Chat ended:', reason);
        setStatus('idle');
        setPartnerId(null);
        setRoomId(null);
        webrtcServiceRef.current?.cleanup();

        // Maybe show a toast or transition
    };

    const handleError = ({ message }) => {
        console.error('Random chat error:', message);
        // Show error UI or Toast
        alert(`Error: ${message}`);
        setStatus('idle');
    };

    // --- SIGNALING HANDLERS ---

    const initiateCall = async (targetId) => {
        try {
            const offer = await webrtcServiceRef.current.createOffer();
            callServiceRef.current.sendOffer(targetId, offer);
        } catch (err) {
            console.error('Error initiating call:', err);
        }
    };

    const handleOffer = async ({ senderId, offer }) => {
        if (senderId !== partnerId && partnerId !== null) return; // Ignore offers from others
        if (!partnerId) setPartnerId(senderId); // Should already be set by 'matched'

        try {
            // Ensure WebRTC is ready (case: receiver)
            if (!webrtcServiceRef.current.peerConnection) {
                await webrtcServiceRef.current.initializePeerConnection();
                const stream = await webrtcServiceRef.current.getUserMedia();
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            }

            const answer = await webrtcServiceRef.current.handleOffer(offer);
            callServiceRef.current.sendAnswer(senderId, answer);
            setStatus('in_call');
        } catch (err) {
            console.error('Error handling offer:', err);
        }
    };

    const handleAnswer = async ({ senderId, answer }) => {
        try {
            await webrtcServiceRef.current.handleAnswer(answer);
        } catch (err) {
            console.error('Error handling answer:', err);
        }
    };

    const handleIceCandidate = async ({ senderId, candidate }) => {
        try {
            await webrtcServiceRef.current.addIceCandidate(candidate);
        } catch (err) {
            console.error('Error handling ICE candidate:', err);
        }
    };

    // --- USER ACTIONS ---

    // Start searching for random match
    const startSearch = () => {
        setStatus('searching');
        callServiceRef.current.startRandomSearch({
            region: 'global', // Could add geolocation logic here
            preferences: {
                nearbyPreferred: true
            }
        });
    };

    // Stop searching
    const stopSearch = () => {
        callServiceRef.current.stopRandomSearch();
        setStatus('idle');
    };

    // Skip to next partner
    const skipPartner = () => {
        webrtcServiceRef.current?.cleanup();
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        callServiceRef.current.skipRandomPartner();
        setStatus('searching');
        setPartnerId(null);
    };

    // End chat
    const endChat = () => {
        callServiceRef.current.endRandomChat();
        webrtcServiceRef.current?.cleanup();
        setStatus('idle');
        setPartnerId(null);
        setRoomId(null);
    };

    const toggleAudio = () => {
        const isMuted = webrtcServiceRef.current.toggleMute();
        setIsAudioEnabled(!isMuted);
    };

    const toggleVideo = () => {
        // Toggle video track
        const isOff = webrtcServiceRef.current.toggleVideo();
        setIsVideoEnabled(!isOff);
    };

    // --- RENDER HELPERS ---

    if (status === 'idle') {
        return (
            <div className="random-video-chat">
                <button className="exit-random-chat" onClick={onClose} title="Exit">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="idle-screen">
                    <div className="hero-section fade-in">
                        <div className="globe-icon">
                            <Globe3D size="200px" wireframe={true} color="#20B2AA" />
                        </div>
                        <h1>Random Video Chat</h1>
                        <p>Connect with people around the world instantly</p>

                        <button className="start-button" onClick={startSearch}>
                            🎥 Start Video Chat
                        </button>

                        <div className="features">
                            <div className="feature">
                                <span className="icon">⚡</span>
                                <span>Instant Matching</span>
                            </div>
                            <div className="feature">
                                <span className="icon">🔒</span>
                                <span>Anonymous</span>
                            </div>
                            <div className="feature">
                                <span className="icon">🌐</span>
                                <span>Global</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'searching') {
        return (
            <div className="random-video-chat">
                <div className="searching-screen">
                    <div className="search-container fade-in">
                        <div className="mb-8 inline-block">
                            <Globe3D size="160px" variant="online" color="#20B2AA" />
                        </div>

                        <h2>Finding a partner...</h2>
                        <p className="online-count">👥 {searchingCount > 0 ? `${searchingCount} people online` : 'Connecting...'}</p>

                        <div className="search-tips">
                            <p>💡 Tip: Please enable your camera and microphone permissions for the connection to work.</p>
                        </div>

                        <button className="cancel-button" onClick={stopSearch}>
                            Cancel Search
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Matched or In_Call
    return (
        <div className="random-video-chat">
            <div className="video-call-screen">
                {/* Remote Video (Full Screen) */}
                <div className="remote-video-container">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="remote-video"
                    />

                    {/* Connection Status */}
                    <div className="connection-status">
                        <span className={`status-dot ${connectionState === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        {connectionState === 'connected' ? 'Connected' : 'Connecting...'}
                    </div>

                    {/* Local Video (PIP) */}
                    <div className="local-video-pip">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="local-video"
                        />
                    </div>
                </div>

                {/* Controls */}
                <div className="controls-panel">
                    <button
                        className={`control-btn ${!isAudioEnabled ? 'active' : ''}`}
                        onClick={toggleAudio}
                        title={isAudioEnabled ? "Mute Mic" : "Unmute Mic"}
                    >
                        {isAudioEnabled ? '🎤' : '🔇'}
                    </button>

                    <button
                        className={`control-btn ${!isVideoEnabled ? 'active' : ''}`}
                        onClick={toggleVideo}
                        title={isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
                    >
                        {isVideoEnabled ? '📹' : '📵'}
                    </button>

                    <button
                        className="control-btn skip-btn"
                        onClick={skipPartner}
                        title="Skip to next partner"
                    >
                        <span>⏭️</span> Next
                    </button>

                    <button
                        className="control-btn end-btn"
                        onClick={endChat}
                        title="End Chat"
                    >
                        ❌
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(RandomVideoChat);
