/**
 * CallSocketService - Socket.io Signaling Abstraction
 * 
 * Responsibilities:
 * - Emit call lifecycle events (request, accept, reject, end)
 * - Emit WebRTC signaling (offer, answer, ICE candidates)
 * - Attach/detach socket listeners
 * - Clean separation from WebRTC logic
 */

class CallSocketService {
    constructor(socket) {
        this.socket = socket;
        this.listeners = new Map();
    }

    // --- CALL LIFECYCLE EVENTS ---

    /**
     * Initiate a call to another user
     */
    initiateCall(recipientId) {
        console.log('📞 Initiating call to:', recipientId);
        this.socket.emit('call:request', { recipientId });
    }

    /**
     * Accept an incoming call
     */
    acceptCall(callerId) {
        console.log('✅ Accepting call from:', callerId);
        this.socket.emit('call:accepted', { callerId });
    }

    /**
     * Reject an incoming call
     */
    rejectCall(callerId) {
        console.log('❌ Rejecting call from:', callerId);
        this.socket.emit('call:rejected', { callerId });
    }

    /**
     * End an active call
     */
    endCall(peerId) {
        console.log('📴 Ending call with:', peerId);
        this.socket.emit('call:ended', { peerId });
    }

    // --- WEBRTC SIGNALING EVENTS ---

    /**
     * Send SDP offer to peer
     */
    sendOffer(recipientId, offer) {
        console.log('📤 Sending offer to:', recipientId);
        this.socket.emit('webrtc:offer', { recipientId, offer });
    }

    /**
     * Send SDP answer to peer
     */
    sendAnswer(recipientId, answer) {
        console.log('📤 Sending answer to:', recipientId);
        this.socket.emit('webrtc:answer', { recipientId, answer });
    }

    /**
     * Send ICE candidate to peer
     */
    sendIceCandidate(recipientId, candidate) {
        console.log('🧊 Sending ICE candidate to:', recipientId);
        this.socket.emit('webrtc:ice-candidate', { recipientId, candidate });
    }

    // --- LISTENER MANAGEMENT ---

    /**
     * Attach all call-related listeners
     */
    attachListeners(callbacks) {
        const {
            onIncomingCall,
            onCallAccepted,
            onCallRejected,
            onCallEnded,
            onCallError,
            onOffer,
            onAnswer,
            onIceCandidate
        } = callbacks;

        // Call lifecycle listeners
        if (onIncomingCall) {
            const handler = (data) => {
                console.log('📞 Incoming call from:', data.callerId);
                onIncomingCall(data);
            };
            this.socket.on('call:incoming', handler);
            this.listeners.set('call:incoming', handler);
        }

        if (onCallAccepted) {
            const handler = (data) => {
                console.log('✅ Call accepted:', data);
                onCallAccepted(data);
            };
            this.socket.on('call:accepted', handler);
            this.listeners.set('call:accepted', handler);
        }

        if (onCallRejected) {
            const handler = (data) => {
                console.log('❌ Call rejected:', data);
                onCallRejected(data);
            };
            this.socket.on('call:rejected', handler);
            this.listeners.set('call:rejected', handler);
        }

        if (onCallEnded) {
            const handler = (data) => {
                console.log('📴 Call ended:', data);
                onCallEnded(data);
            };
            this.socket.on('call:ended', handler);
            this.listeners.set('call:ended', handler);
        }

        if (onCallError) {
            const handler = (data) => {
                console.error('⚠️ Call error:', data);
                onCallError(data);
            };
            this.socket.on('call:error', handler);
            this.listeners.set('call:error', handler);
        }

        // WebRTC signaling listeners
        if (onOffer) {
            const handler = (data) => {
                console.log('📥 Received offer from:', data.senderId);
                onOffer(data);
            };
            this.socket.on('webrtc:offer', handler);
            this.listeners.set('webrtc:offer', handler);
        }

        if (onAnswer) {
            const handler = (data) => {
                console.log('📥 Received answer from:', data.senderId);
                onAnswer(data);
            };
            this.socket.on('webrtc:answer', handler);
            this.listeners.set('webrtc:answer', handler);
        }

        if (onIceCandidate) {
            const handler = (data) => {
                console.log('🧊 Received ICE candidate from:', data.senderId);
                onIceCandidate(data);
            };
            this.socket.on('webrtc:ice-candidate', handler);
            this.listeners.set('webrtc:ice-candidate', handler);
        }

        console.log(`✅ Attached ${this.listeners.size} call listeners`);
    }

    /**
     * Detach all listeners - CRITICAL for cleanup
     */
    detachListeners() {
        console.log(`🧹 Detaching ${this.listeners.size} call listeners...`);

        this.listeners.forEach((handler, event) => {
            this.socket.off(event, handler);
        });

        this.listeners.clear();
        console.log('✅ All call listeners detached');
    }

    /**
     * Check if socket is connected
     */
    isConnected() {
        return this.socket && this.socket.connected;
    }

    /**
     * Get socket ID
     */
    getSocketId() {
        return this.socket?.id;
    }
}

export default CallSocketService;
