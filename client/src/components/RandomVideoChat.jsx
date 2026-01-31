import React, { useState, useEffect, useRef, useCallback } from 'react';
import CallSocketService from '../services/CallSocketService';
import WebRTCService from '../services/WebRTCService';
// SCSS removed in favor of Tailwind
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
            <div className="fixed inset-0 z-[9999] bg-black text-white font-sans overflow-hidden w-screen h-screen">
                <button
                    className="absolute top-6 right-6 z-[100] bg-black/50 border border-white/10 text-white w-11 h-11 rounded-xl cursor-pointer flex items-center justify-center transition-all duration-200 backdrop-blur-sm hover:bg-white/10 hover:rotate-90"
                    onClick={onClose}
                    title="Exit"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center z-10 relative text-white px-6 md:px-0 animate-[fadeIn_0.4s_ease-out_forwards]">
                        <div className="inline-block mb-6 drop-shadow-[0_0_30px_rgba(32,178,170,0.3)]">
                            <Globe3D size="200px" wireframe={true} color="#20B2AA" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-white">Random Video Chat</h1>
                        <p className="text-lg md:text-xl mb-10 opacity-80 font-normal text-white/70">Connect with people around the world instantly</p>

                        <button
                            className="bg-[#20B2AA] text-black border-none py-[18px] px-[50px] text-lg rounded-2xl cursor-pointer shadow-[0_0_20px_-5px_rgba(32,178,170,0.4)] font-bold transition-all duration-200 tracking-wide uppercase hover:bg-[#1C9D96] hover:-translate-y-0.5 hover:shadow-[0_0_30px_-5px_rgba(32,178,170,0.6)] active:translate-y-[1px] w-full max-w-xs md:w-auto"
                            onClick={startSearch}
                        >
                            🎥 Start Video Chat
                        </button>

                        <div className="flex gap-6 mt-[60px] justify-center flex-wrap md:flex-nowrap">
                            <div className="flex flex-col items-center gap-3 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md min-w-[140px] transition-transform duration-200 hover:-translate-y-1 hover:bg-white/[0.08] hover:border-[#20B2AA]/30">
                                <span className="text-2xl">⚡</span>
                                <span className="text-sm font-semibold text-[#20B2AA] opacity-90">Instant Matching</span>
                            </div>
                            <div className="flex flex-col items-center gap-3 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md min-w-[140px] transition-transform duration-200 hover:-translate-y-1 hover:bg-white/[0.08] hover:border-[#20B2AA]/30">
                                <span className="text-2xl">🔒</span>
                                <span className="text-sm font-semibold text-[#20B2AA] opacity-90">Anonymous</span>
                            </div>
                            <div className="flex flex-col items-center gap-3 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md min-w-[140px] transition-transform duration-200 hover:-translate-y-1 hover:bg-white/[0.08] hover:border-[#20B2AA]/30">
                                <span className="text-2xl">🌐</span>
                                <span className="text-sm font-semibold text-[#20B2AA] opacity-90">Global</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'searching') {
        return (
            <div className="fixed inset-0 z-[9999] bg-black text-white font-sans overflow-hidden w-screen h-screen">
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white animate-[fadeIn_0.4s_ease-out_forwards]">
                        <div className="mb-8 inline-block">
                            <Globe3D size="160px" variant="online" color="#20B2AA" />
                        </div>

                        <h2 className="text-[28px] font-bold mb-4">Finding a partner...</h2>
                        <p className="text-base text-[#20B2AA] mb-10 bg-[#20B2AA]/10 px-4 py-2 rounded-full inline-block border border-[#20B2AA]/20">
                            👥 {searchingCount > 0 ? `${searchingCount} people online` : 'Connecting...'}
                        </p>

                        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 mb-10 border border-white/10 max-w-[400px] mx-auto">
                            <p className="text-sm m-0 leading-relaxed text-white/70">
                                💡 Tip: Please enable your camera and microphone permissions for the connection to work.
                            </p>
                        </div>

                        <button
                            className="bg-transparent text-white/70 border border-white/20 py-3 px-[30px] text-sm rounded-xl cursor-pointer transition-all duration-200 font-semibold uppercase tracking-wide hover:bg-white/10 hover:text-white hover:border-white/40"
                            onClick={stopSearch}
                        >
                            Cancel Search
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Matched or In_Call
    return (
        <div className="fixed inset-0 z-[9999] bg-black text-white font-sans overflow-hidden w-screen h-screen">
            <div className="relative w-full h-full bg-black">
                {/* Remote Video (Full Screen) */}
                <div className="w-full h-full relative">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover transform-none"
                    />

                    {/* Connection Status */}
                    <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 text-xs font-semibold border border-white/10">
                        <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${connectionState === 'connected' ? 'bg-[#10b981] shadow-[#10b981]' : 'bg-yellow-500 shadow-yellow-500'}`}></span>
                        {connectionState === 'connected' ? 'Connected' : 'Connecting...'}
                    </div>

                    {/* Local Video (PIP) */}
                    <div className="absolute bottom-[120px] right-6 w-[160px] md:bottom-[100px] md:right-4 md:w-[100px] aspect-video rounded-xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-white/20 bg-[#111] transition-all duration-300 z-10 hover:scale-105 hover:border-[#20B2AA]">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                        />
                    </div>
                </div>

                {/* Controls */}
                <div className="absolute bottom-[30px] left-1/2 -translate-x-1/2 flex gap-3 bg-[#0a0a0a]/90 backdrop-blur-xl p-3 md:p-3 rounded-[20px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-20 w-[calc(100%-32px)] md:w-auto justify-between md:justify-center">
                    <button
                        className={`w-12 h-12 rounded-xl border-none bg-white/10 text-white text-xl cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-white/20 hover:-translate-y-0.5 active:translate-y-0 ${!isAudioEnabled ? '!bg-red-500 text-white' : ''}`}
                        onClick={toggleAudio}
                        title={isAudioEnabled ? "Mute Mic" : "Unmute Mic"}
                    >
                        {isAudioEnabled ? '🎤' : '🔇'}
                    </button>

                    <button
                        className={`w-12 h-12 rounded-xl border-none bg-white/10 text-white text-xl cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-white/20 hover:-translate-y-0.5 active:translate-y-0 ${!isVideoEnabled ? '!bg-red-500 text-white' : ''}`}
                        onClick={toggleVideo}
                        title={isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
                    >
                        {isVideoEnabled ? '📹' : '📵'}
                    </button>

                    <button
                        className="bg-[#20B2AA] text-black w-auto px-6 text-base font-bold gap-2 hover:bg-[#1C9D96] flex-grow md:flex-grow-0 h-12 rounded-xl border-none cursor-pointer transition-all duration-200 flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0"
                        onClick={skipPartner}
                        title="Skip to next partner"
                    >
                        <span>⏭️</span> Next
                    </button>

                    <button
                        className="bg-red-500/15 text-red-500 border border-red-500/30 w-12 h-12 rounded-xl text-xl cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 hover:-translate-y-0.5 active:translate-y-0"
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
