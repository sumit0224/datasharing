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
    /**
     * @param {import('socket.io-client').Socket} socket
     */
    constructor(socket) {
        if (!socket) {
            throw new Error('CallSocketService: Socket instance is required');
        }
        this.socket = socket;
        this.listeners = new Map();

        // Handle reconnection
        this._setupReconnectionHandler();
    }

    /**
     * Set up reconnection event listener
     * @private
     */
    _setupReconnectionHandler() {
        this.socket.on('connect', () => {
            console.log('🔄 CallSocketService: Socket connected/reconnected');
        });

        this.socket.on('disconnect', (reason) => {
            console.warn(`⚠️ CallSocketService: Socket disconnected. Reason: ${reason}`);
        });
    }

    /**
     * Private helper to emit events with connection check and validation
     * @private
     * @param {string} event 
     * @param {Object} data 
     * @throws {Error} If socket is not connected
     */
    _safeEmit(event, data) {
        if (!this.isConnected()) {
            console.error(`❌ Cannot emit ${event}: Socket not connected`);
            throw new Error('Socket not connected');
        }

        try {
            this.socket.emit(event, data);
        } catch (error) {
            console.error(`❌ Error emitting ${event}:`, error);
            throw error;
        }
    }

    // --- CALL LIFECYCLE EVENTS ---

    /**
     * Initiate a call to another user
     * @param {string} recipientId - The ID of the user to call
     * @throws {Error} If recipientId is missing or socket disconnected
     */
    initiateCall(recipientId) {
        if (!recipientId) throw new Error('recipientId is required');
        console.log('📞 Initiating call to:', recipientId);
        this._safeEmit('call:request', { recipientId });
    }

    /**
     * Accept an incoming call
     * @param {string} callerId - The ID of the caller to accept
     * @throws {Error} If callerId is missing or socket disconnected
     */
    acceptCall(callerId) {
        if (!callerId) throw new Error('callerId is required');
        console.log('✅ Accepting call from:', callerId);
        // Rename to 'call:accept' to avoid conflict with 'call:accepted' listener
        this._safeEmit('call:accept', { callerId });
    }

    /**
     * Reject an incoming call
     * @param {string} callerId - The ID of the caller to reject
     * @throws {Error} If callerId is missing or socket disconnected
     */
    rejectCall(callerId) {
        if (!callerId) throw new Error('callerId is required');
        console.log('❌ Rejecting call from:', callerId);
        // Rename to 'call:reject' to avoid conflict with 'call:rejected' listener
        this._safeEmit('call:reject', { callerId });
    }

    /**
     * End an active call
     * @param {string} peerId - The ID of the peer to end call with
     * @throws {Error} If peerId is missing or socket disconnected
     */
    endCall(peerId) {
        if (!peerId) throw new Error('peerId is required');
        console.log('📴 Ending call with:', peerId);
        this._safeEmit('call:ended', { peerId });
    }

    // --- RANDOM VIDEO CHAT EVENTS ---

    /**
     * Start searching for a random partner
     * @param {Object} options - Search options
     * @param {string} options.region - Preferred region
     * @param {Object} options.preferences - Match preferences
     */
    startRandomSearch(options = {}) {
        console.log('🌍 Starting random search', options);
        this._safeEmit('random:start_search', options);
    }

    /**
     * Stop searching for a random partner
     */
    stopRandomSearch() {
        console.log('🛑 Stopping random search');
        this._safeEmit('random:stop_search');
    }

    /**
     * Skip current partner and find new one
     */
    skipRandomPartner() {
        console.log('⏭️ Skipping random partner');
        this._safeEmit('random:skip');
    }

    /**
     * End random chat session
     */
    endRandomChat() {
        console.log('❌ Ending random chat');
        this._safeEmit('random:end_chat');
    }

    /**
     * Report current random partner
     * @param {string} partnerId 
     * @param {string} reason 
     */
    reportRandomPartner(partnerId, reason) {
        console.log('🚨 Reporting partner:', partnerId);
        this._safeEmit('random:report', { partnerId, reason });
    }

    // --- WEBRTC SIGNALING EVENTS ---

    /**
     * Send SDP offer to peer
     * @param {string} recipientId 
     * @param {RTCSessionDescriptionInit} offer 
     */
    sendOffer(recipientId, offer) {
        if (!recipientId || !offer) throw new Error('recipientId and offer are required');
        console.log('📤 Sending offer to:', recipientId);
        this._safeEmit('webrtc:offer', { recipientId, offer });
    }

    /**
     * Send SDP answer to peer
     * @param {string} recipientId 
     * @param {RTCSessionDescriptionInit} answer 
     */
    sendAnswer(recipientId, answer) {
        if (!recipientId || !answer) throw new Error('recipientId and answer are required');
        console.log('📤 Sending answer to:', recipientId);
        this._safeEmit('webrtc:answer', { recipientId, answer });
    }

    /**
     * Send ICE candidate to peer
     * @param {string} recipientId 
     * @param {RTCIceCandidate} candidate 
     */
    sendIceCandidate(recipientId, candidate) {
        if (!recipientId || !candidate) throw new Error('recipientId and candidate are required');
        console.log('🧊 Sending ICE candidate to:', recipientId);
        this._safeEmit('webrtc:ice-candidate', { recipientId, candidate });
    }

    // --- LISTENER MANAGEMENT ---

    /**
     * Attach all call-related listeners
     * @param {Object} callbacks - Object containing callback functions
     */
    attachListeners(callbacks) {
        // Prevent duplicate listeners and memory leaks
        this.detachListeners();

        const {
            onIncomingCall,
            onCallAccepted,
            onCallRejected,
            onCallEnded,
            onCallError,
            onOffer,
            onAnswer,
            onIceCandidate,
            // Random Chat Callbacks
            onRandomSearching,
            onRandomMatched,
            onRandomChatEnded,
            onRandomError
        } = callbacks;

        // Helper to register a listener
        const register = (event, callback, logMsg) => {
            if (callback) {
                const handler = (data) => {
                    if (logMsg) console.log(logMsg, data);
                    callback(data);
                };
                this.socket.on(event, handler);
                this.listeners.set(event, handler);
            }
        };

        register('call:incoming', onIncomingCall, '📞 Incoming call from:');
        register('call:accepted', onCallAccepted, '✅ Call accepted:');
        register('call:rejected', onCallRejected, '❌ Call rejected:');
        register('call:ended', onCallEnded, '📴 Call ended:');
        register('call:error', onCallError, '⚠️ Call error:');
        register('webrtc:offer', onOffer, '📥 Received offer from:');
        register('webrtc:answer', onAnswer, '📥 Received answer from:');
        register('webrtc:ice-candidate', onIceCandidate, '🧊 Received ICE candidate from:');

        // Random Chat Listeners
        register('random:searching', onRandomSearching, '🔍 Searching status:');
        register('random:matched', onRandomMatched, '🎲 Random match found:');
        register('random:chat_ended', onRandomChatEnded, '👋 Random chat ended:');
        register('random:error', onRandomError, '⚠️ Random chat error:');

        console.log(`✅ Attached ${this.listeners.size} call listeners`);
    }

    /**
     * Detach all listeners - CRITICAL for cleanup
     */
    detachListeners() {
        if (!this.listeners.size) return;

        console.log(`🧹 Detaching ${this.listeners.size} call listeners...`);

        this.listeners.forEach((handler, event) => {
            this.socket.off(event, handler);
        });

        this.listeners.clear();
        console.log('✅ All call listeners detached');
    }

    /**
     * Fully destroy the service instance
     */
    destroy() {
        console.log('🗑️ Destroying CallSocketService...');
        this.detachListeners();
        this.socket.off('connect');
        this.socket.off('disconnect');
        this.socket = null;
    }

    /**
     * Check if socket is connected
     * @returns {boolean}
     */
    isConnected() {
        return !!(this.socket && this.socket.connected);
    }

    /**
     * Get socket ID
     * @returns {string|undefined}
     */
    getSocketId() {
        return this.socket?.id;
    }
}

export default CallSocketService;
