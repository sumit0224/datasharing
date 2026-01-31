/**
 * WebRTCService - Pure WebRTC Connection Management
 * 
 * Responsibilities:
 * - Create and manage RTCPeerConnection
 * - Access user media (camera/microphone)
 * - Handle SDP offer/answer exchange
 * - Process ICE candidates
 * - Cleanup on call end
 */

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];

class WebRTCService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.pendingIceCandidates = [];
        this.remoteDescriptionSet = false;

        // Event callbacks
        this.onRemoteStream = null;
        this.onIceCandidate = null;
        this.onConnectionStateChange = null;
    }

    /**
     * Initialize peer connection with ICE servers
     */
    async initializePeerConnection() {
        if (this.peerConnection) {
            console.warn('Peer connection already exists');
            return;
        }

        this.peerConnection = new RTCPeerConnection({
            iceServers: ICE_SERVERS
        });

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('📺 Received remote track:', event.track.kind);
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }
            this.remoteStream.addTrack(event.track);

            if (this.onRemoteStream) {
                this.onRemoteStream(this.remoteStream);
            }
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.onIceCandidate) {
                console.log('🧊 ICE candidate generated');
                this.onIceCandidate(event.candidate);
            }
        };

        // Monitor connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('🔗 Connection state:', state);

            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }

            // Auto-cleanup on failed connection
            if (state === 'failed' || state === 'closed') {
                console.error('❌ Connection failed or closed');
                this.cleanup();
            }
        };

        console.log('✅ Peer connection initialized');
    }

    /**
     * Access user's camera and microphone
     */
    async getUserMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            console.log('🎥 Got local media stream');

            // Add local tracks to peer connection
            if (this.peerConnection) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                    console.log('➕ Added local track:', track.kind);
                });
            }

            return this.localStream;
        } catch (error) {
            console.error('❌ Failed to get user media:', error);
            throw new Error(`Camera/Microphone access denied: ${error.message}`);
        }
    }

    /**
     * Create SDP offer (caller side)
     */
    async createOffer() {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await this.peerConnection.setLocalDescription(offer);
            console.log('📤 Created and set local offer');

            return offer;
        } catch (error) {
            console.error('❌ Failed to create offer:', error);
            throw error;
        }
    }

    /**
     * Handle incoming SDP offer (recipient side)
     */
    async handleOffer(offer) {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            this.remoteDescriptionSet = true;
            console.log('📥 Set remote offer');

            // Process any pending ICE candidates
            this.processPendingIceCandidates();

            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('📤 Created and set local answer');

            return answer;
        } catch (error) {
            console.error('❌ Failed to handle offer:', error);
            throw error;
        }
    }

    /**
     * Handle incoming SDP answer (caller side)
     */
    async handleAnswer(answer) {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            this.remoteDescriptionSet = true;
            console.log('📥 Set remote answer');

            // Process any pending ICE candidates
            this.processPendingIceCandidates();
        } catch (error) {
            console.error('❌ Failed to handle answer:', error);
            throw error;
        }
    }

    /**
     * Add ICE candidate
     */
    async addIceCandidate(candidate) {
        if (!this.peerConnection) {
            console.warn('Peer connection not ready, ignoring ICE candidate');
            return;
        }

        // Queue candidates if remote description not set yet
        if (!this.remoteDescriptionSet) {
            console.log('🧊 Queueing ICE candidate (remote description not set)');
            this.pendingIceCandidates.push(candidate);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('🧊 Added ICE candidate');
        } catch (error) {
            console.error('❌ Failed to add ICE candidate:', error);
        }
    }

    /**
     * Process queued ICE candidates
     */
    processPendingIceCandidates() {
        console.log(`🧊 Processing ${this.pendingIceCandidates.length} pending ICE candidates`);

        this.pendingIceCandidates.forEach(candidate => {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(err => console.error('Failed to add queued ICE candidate:', err));
        });

        this.pendingIceCandidates = [];
    }

    /**
     * Toggle local audio mute
     */
    toggleMute() {
        if (!this.localStream) return false;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            console.log('🎤 Audio:', audioTrack.enabled ? 'unmuted' : 'muted');
            return !audioTrack.enabled; // Return muted state
        }
        return false;
    }

    /**
     * Toggle local video
     */
    toggleVideo() {
        if (!this.localStream) return false;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            console.log('📹 Video:', videoTrack.enabled ? 'enabled' : 'disabled');
            return !videoTrack.enabled; // Return video off state
        }
        return false;
    }

    /**
     * Complete cleanup - CRITICAL
     */
    cleanup() {
        console.log('🧹 Cleaning up WebRTC resources...');

        // Stop all local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log('⏹️  Stopped local track:', track.kind);
            });
            this.localStream = null;
        }

        // Stop all remote tracks
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
                track.stop();
            });
            this.remoteStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            console.log('🔌 Peer connection closed');
        }

        // Reset state
        this.pendingIceCandidates = [];
        this.remoteDescriptionSet = false;

        console.log('✅ Cleanup complete');
    }

    /**
     * Get connection statistics (optional, for monitoring)
     */
    async getStats() {
        if (!this.peerConnection) return null;

        try {
            const stats = await this.peerConnection.getStats();
            return stats;
        } catch (error) {
            console.error('Failed to get stats:', error);
            return null;
        }
    }
}

export default WebRTCService;
