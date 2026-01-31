import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import WebRTCService from '../services/WebRTCService';
import CallSocketService from '../services/CallSocketService';

const CallContext = createContext();

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within CallProvider');
    }
    return context;
};

export const CallProvider = ({ socket, children }) => {
    // Call State
    const [callState, setCallState] = useState('idle'); // idle | outgoing | incoming | connecting | active
    const [caller, setCaller] = useState(null); // { id, name }
    const [recipient, setRecipient] = useState(null); // { id, name }
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [error, setError] = useState(null);
    const [isInitiator, setIsInitiator] = useState(false);

    // Services
    const webrtcService = useRef(null);
    const callSocketService = useRef(null);
    const callTimer = useRef(null);
    const currentPeerId = useRef(null);

    // Initialize services
    React.useEffect(() => {
        if (socket && !callSocketService.current) {
            callSocketService.current = new CallSocketService(socket);
            webrtcService.current = new WebRTCService();

            // Setup WebRTC callbacks
            webrtcService.current.onRemoteStream = (stream) => {
                console.log('🎥 Setting remote stream');
                setRemoteStream(stream);
                setCallState('active');
                startCallTimer();
            };

            webrtcService.current.onIceCandidate = (candidate) => {
                if (currentPeerId.current) {
                    callSocketService.current.sendIceCandidate(currentPeerId.current, candidate);
                }
            };

            webrtcService.current.onConnectionStateChange = (state) => {
                if (state === 'failed' || state === 'closed') {
                    endActiveCall();
                }
            };

            // Attach socket listeners
            callSocketService.current.attachListeners({
                onIncomingCall: handleIncomingCall,
                onCallAccepted: handleCallAccepted,
                onCallRejected: handleCallRejected,
                onCallEnded: handleCallEnded,
                onCallError: handleCallError,
                onOffer: handleOffer,
                onAnswer: handleAnswer,
                onIceCandidate: handleIceCandidate
            });
        }

        return () => {
            if (callSocketService.current) {
                callSocketService.current.detachListeners();
            }
            cleanup();
        };
    }, [socket]);

    // --- CALL LIFECYCLE ACTIONS ---

    /**
     * Initiate a call to another user
     */
    const initiateCall = useCallback((userId, userName) => {
        if (!socket || !socket.connected) {
            setError('Not connected to server');
            return;
        }

        if (callState !== 'idle') {
            setError('Already in a call');
            return;
        }

        console.log('📞 Initiating call to:', userId);
        setCallState('outgoing');
        setRecipient({ id: userId, name: userName });
        currentPeerId.current = userId;
        callSocketService.current.initiateCall(userId);
    }, [socket, callState]);

    /**
     * Accept incoming call
     */
    const acceptIncomingCall = useCallback(async () => {
        if (!caller) return;

        console.log('✅ Accepting call from:', caller.id);
        setCallState('connecting');
        callSocketService.current.acceptCall(caller.id);
    }, [caller]);

    /**
     * Reject incoming call
     */
    const rejectIncomingCall = useCallback(() => {
        if (!caller) return;

        console.log('❌ Rejecting call from:', caller.id);
        callSocketService.current.rejectCall(caller.id);
        cleanup();
    }, [caller]);

    /**
     * End active call
     */
    const endActiveCall = useCallback(() => {
        console.log('📴 Ending call');

        if (currentPeerId.current) {
            callSocketService.current.endCall(currentPeerId.current);
        }

        cleanup();
    }, []);

    // --- SOCKET EVENT HANDLERS ---

    const handleIncomingCall = useCallback(({ callerId, callerName }) => {
        console.log('📞 Incoming call from:', callerId);
        setCallState('incoming');
        setCaller({ id: callerId, name: callerName });
        currentPeerId.current = callerId;
    }, []);

    const handleCallAccepted = useCallback(async ({ recipientId, callerId, isInitiator: initiator }) => {
        console.log('✅ Call accepted, isInitiator:', initiator);
        setCallState('connecting');
        setIsInitiator(initiator);

        const peerId = recipientId || callerId;
        currentPeerId.current = peerId;

        try {
            // Initialize WebRTC connection
            await webrtcService.current.initializePeerConnection();

            // Get local media
            const stream = await webrtcService.current.getUserMedia();
            setLocalStream(stream);

            // If initiator, create and send offer
            if (initiator) {
                const offer = await webrtcService.current.createOffer();
                callSocketService.current.sendOffer(peerId, offer);
            }
        } catch (err) {
            console.error('❌ Failed to initialize call:', err);
            setError(err.message);
            endActiveCall();
        }
    }, [endActiveCall]);

    const handleCallRejected = useCallback(({ recipientId }) => {
        console.log('❌ Call rejected by:', recipientId);
        setError('Call was rejected');
        cleanup();
    }, []);

    const handleCallEnded = useCallback(({ peerId, reason }) => {
        console.log('📴 Call ended by:', peerId, 'reason:', reason);
        if (reason === 'disconnected') {
            setError('Call ended: connection lost');
        }
        cleanup();
    }, []);

    const handleCallError = useCallback(({ reason }) => {
        console.error('⚠️ Call error:', reason);

        const errorMessages = {
            'user_offline': 'User is offline',
            'user_busy': 'User is currently in another call',
            'already_in_call': 'You are already in a call',
            'invalid_recipient': 'Invalid recipient',
            'caller_offline': 'Caller went offline'
        };

        setError(errorMessages[reason] || 'Call failed');
        cleanup();
    }, []);

    // --- WEBRTC SIGNALING HANDLERS ---

    const handleOffer = useCallback(async ({ senderId, offer }) => {
        console.log('📥 Received offer from:', senderId);

        try {
            const answer = await webrtcService.current.handleOffer(offer);
            callSocketService.current.sendAnswer(senderId, answer);
        } catch (err) {
            console.error('❌ Failed to handle offer:', err);
            endActiveCall();
        }
    }, [endActiveCall]);

    const handleAnswer = useCallback(async ({ senderId, answer }) => {
        console.log('📥 Received answer from:', senderId);

        try {
            await webrtcService.current.handleAnswer(answer);
        } catch (err) {
            console.error('❌ Failed to handle answer:', err);
            endActiveCall();
        }
    }, [endActiveCall]);

    const handleIceCandidate = useCallback(({ senderId, candidate }) => {
        console.log('🧊 Received ICE candidate from:', senderId);
        webrtcService.current.addIceCandidate(candidate);
    }, []);

    // --- MEDIA CONTROLS ---

    const toggleMute = useCallback(() => {
        if (!webrtcService.current) return;
        const muted = webrtcService.current.toggleMute();
        setIsMuted(muted);
    }, []);

    const toggleVideo = useCallback(() => {
        if (!webrtcService.current) return;
        const videoOff = webrtcService.current.toggleVideo();
        setIsVideoOff(videoOff);
    }, []);

    // --- HELPERS ---

    const startCallTimer = () => {
        clearInterval(callTimer.current);
        setCallDuration(0);

        callTimer.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const cleanup = () => {
        console.log('🧹 Cleaning up call state...');

        // Stop timer
        if (callTimer.current) {
            clearInterval(callTimer.current);
            callTimer.current = null;
        }

        // Cleanup WebRTC
        if (webrtcService.current) {
            webrtcService.current.cleanup();
        }

        // Reset state
        setCallState('idle');
        setCaller(null);
        setRecipient(null);
        setLocalStream(null);
        setRemoteStream(null);
        setIsMuted(false);
        setIsVideoOff(false);
        setCallDuration(0);
        setError(null);
        setIsInitiator(false);
        currentPeerId.current = null;

        console.log('✅ Cleanup complete');
    };

    const value = {
        // State
        callState,
        caller,
        recipient,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        callDuration,
        error,

        // Actions
        initiateCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endActiveCall,
        toggleMute,
        toggleVideo,

        // Helpers
        clearError: () => setError(null)
    };

    return (
        <CallContext.Provider value={value}>
            {children}
        </CallContext.Provider>
    );
};

export default CallContext;
