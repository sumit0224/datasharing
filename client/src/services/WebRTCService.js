/**
 * WebRTCService (Room-Based)
 * Manages P2P connections via manual room joining.
 * 
 * Flow:
 * 1. joinP2PRoom(roomId)
 * 2. Wait for 'p2p:ready' event from server.
 * 3. If initiator: createDataChannel -> createOffer
 * 4. If receiver: wait for DataChannel -> (Automatic Answer via signaling)
 */

const CHUNK_SIZE = 16 * 1024; // 16KB per chunk
const EOF_SIGNAL = 'EOF::';

class WebRTCService {
    constructor(socket, onProgress, onComplete, onError, onStatusChange) {
        this.socket = socket;
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.onError = onError;
        this.onStatusChange = onStatusChange || (() => { });

        this.peerConnection = null;
        this.dataChannel = null;
        this.currentRoom = null;
        this.fileToSend = null;

        this.receiveBuffer = [];
        this.receivedSize = 0;
        this.incomingFileMeta = null;
    }

    // --- PUBLIC API ---

    joinP2PRoom(roomId) {
        this.reset();
        this.currentRoom = roomId;
        this.socket.emit('p2p:join', roomId);
        this.onStatusChange('waiting');
    }

    leaveP2PRoom() {
        if (this.currentRoom) {
            this.socket.emit('p2p:leave');
        }
        this.reset();
    }

    sendFile(file) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.onError('Connection not ready');
            return;
        }
        this.fileToSend = file;
        this.startSending();
    }

    reset() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        this.currentRoom = null;
        this.fileToSend = null;
        this.receiveBuffer = [];
        this.receivedSize = 0;
        this.incomingFileMeta = null;
        this.onStatusChange('idle');
    }

    // --- SIGNALING HANDLERS (To be called from Component) ---

    handleP2PReady({ isInitiator }) {
        console.log('P2P Ready. Initiator:', isInitiator);
        this.onStatusChange('connected');
        this.initConnection(isInitiator);
    }

    handleOffer(offer) {
        if (!this.peerConnection) this.initConnection(false); // Should already be initialized but safe check

        console.log('Received Offer');
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => this.peerConnection.createAnswer())
            .then(answer => this.peerConnection.setLocalDescription(answer))
            .then(() => {
                this.socket.emit('webrtc:answer', { answer: this.peerConnection.localDescription });
            })
            .catch(err => this.onError(`Handle Offer Error: ${err.message}`));
    }

    handleAnswer(answer) {
        console.log('Received Answer');
        if (this.peerConnection) {
            this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
                .catch(err => this.onError(`Handle Answer Error: ${err.message}`));
        }
    }

    handleCandidate(candidate) {
        if (this.peerConnection) {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(err => console.error('Error adding ICE:', err));
        }
    }

    // --- INTERNAL WEBRTC LOGIC ---

    initConnection(isInitiator) {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc:ice-candidate', { candidate: event.candidate });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection State:', this.peerConnection.connectionState);
            if (['disconnected', 'failed', 'closed'].includes(this.peerConnection.connectionState)) {
                this.onError('Peer disconnected');
                this.onStatusChange('disconnected');
            }
        };

        if (isInitiator) {
            const channel = this.peerConnection.createDataChannel("file-transfer");
            this.setupDataChannel(channel);
            this.dataChannel = channel;

            this.peerConnection.createOffer()
                .then(offer => this.peerConnection.setLocalDescription(offer))
                .then(() => {
                    this.socket.emit('webrtc:offer', { offer: this.peerConnection.localDescription });
                })
                .catch(err => this.onError(`Create Offer Error: ${err.message}`));
        } else {
            this.peerConnection.ondatachannel = (event) => {
                this.setupDataChannel(event.channel);
                this.dataChannel = event.channel;
            };
        }
    }

    setupDataChannel(channel) {
        channel.binaryType = 'arraybuffer';
        channel.onopen = () => {
            console.log('Data Channel OPEN');
            this.onStatusChange('ready_to_transfer');
        };
        channel.onclose = () => {
            console.log('Data Channel CLOSED');
            this.onStatusChange('connected'); // Fallback or discon?
        };
        channel.onmessage = this.handleDataMessage.bind(this);
        channel.onerror = (err) => this.onError(`DataChannel Error: ${err.message}`);
    }

    // --- TRANSFER LOGIC ---

    startSending() {
        if (!this.fileToSend || !this.dataChannel) return;

        const file = this.fileToSend;
        this.onStatusChange('transferring');

        // 1. Send Metadata
        const metadata = JSON.stringify({
            name: file.name,
            size: file.size,
            type: file.type
        });
        this.dataChannel.send(`META::${metadata}`);

        // 2. Start Chunking
        let offset = 0;
        const reader = new FileReader();

        const readSlice = (o) => {
            const slice = file.slice(o, o + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

            try {
                this.dataChannel.send(e.target.result);
                offset += e.target.result.byteLength;

                const progress = Math.round((offset / file.size) * 100);
                this.onProgress(progress, 'sending');

                if (offset < file.size) {
                    if (this.dataChannel.bufferedAmount > 10 * 1024 * 1024) {
                        const checkBuffer = setInterval(() => {
                            if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
                                clearInterval(checkBuffer);
                                return;
                            }
                            if (this.dataChannel.bufferedAmount < 1 * 1024 * 1024) {
                                clearInterval(checkBuffer);
                                readSlice(offset);
                            }
                        }, 50);
                    } else {
                        setTimeout(() => readSlice(offset), 0);
                    }
                } else {
                    this.dataChannel.send(EOF_SIGNAL);
                    this.onComplete(file.name);
                    this.onStatusChange('ready_to_transfer');
                    this.fileToSend = null;
                }
            } catch (err) {
                this.onError(`Send Error: ${err.message}`);
            }
        };

        readSlice(0);
    }

    handleDataMessage(event) {
        const data = event.data;

        if (typeof data === 'string') {
            if (data.startsWith('META::')) {
                this.incomingFileMeta = JSON.parse(data.substring(6));
                this.receiveBuffer = [];
                this.receivedSize = 0;
                this.onStatusChange('transferring');
                console.log('Receiving:', this.incomingFileMeta);
            } else if (data === EOF_SIGNAL) {
                this.finishReceiving();
            }
            return;
        }

        if (this.incomingFileMeta) {
            this.receiveBuffer.push(data);
            this.receivedSize += data.byteLength;
            const progress = Math.round((this.receivedSize / this.incomingFileMeta.size) * 100);
            this.onProgress(progress, 'receiving');
        }
    }

    finishReceiving() {
        if (!this.incomingFileMeta) return;
        const blob = new Blob(this.receiveBuffer, { type: this.incomingFileMeta.type });
        this.onComplete(this.incomingFileMeta.name, blob);
        this.receiveBuffer = [];
        this.incomingFileMeta = null;
        this.receivedSize = 0;
        this.onStatusChange('ready_to_transfer');
    }
}

export default WebRTCService;
