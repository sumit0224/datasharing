import React, { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';

function ActiveCallView() {
    const {
        callState,
        caller,
        recipient,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        callDuration,
        disconnectReason,
        endActiveCall,
        toggleMute,
        toggleVideo
    } = useCall();

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            // Explicitly play for iOS fallback
            localVideoRef.current.play().catch(e => console.warn('Local video play failed:', e));
        }
    }, [localStream]);

    // Attach remote stream to video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            // Explicitly play for iOS fallback
            remoteVideoRef.current.play().catch(e => console.warn('Remote video play failed:', e));
        }
    }, [remoteStream]);

    // Format call duration
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Only render when there's an active call state
    if (callState === 'idle' || callState === 'incoming') return null;

    const peerName = caller?.name || recipient?.name || 'Unknown';

    // --- CALLING STATE (Outgoing Call) ---
    if (callState === 'outgoing') {
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="w-full h-full flex flex-col items-center justify-center">
                    {/* User Avatar with Pulsing Ring */}
                    <div className="relative mb-8">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#20B2AA] to-[#1C9D96] flex items-center justify-center text-white text-5xl font-bold shadow-2xl">
                            {peerName.charAt(0).toUpperCase()}
                        </div>
                        {/* Pulsing ring animation */}
                        <div className="absolute inset-0 rounded-full border-4 border-[#20B2AA] animate-ping opacity-50"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-[#20B2AA] animate-pulse opacity-30"></div>
                    </div>

                    {/* User Name */}
                    <h2 className="text-white text-3xl font-bold mb-2">{peerName}</h2>

                    {/* Calling Status */}
                    <p className="text-gray-300 text-xl mb-12 animate-pulse">Calling...</p>

                    {/* End Call Button */}
                    <button
                        onClick={endActiveCall}
                        className="w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg shadow-red-500/50"
                        title="Cancel Call"
                    >
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    // --- DISCONNECTED STATE ---
    if (callState === 'disconnected') {
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="w-full h-full flex flex-col items-center justify-center">
                    {/* Disconnected Icon */}
                    <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>

                    {/* Disconnected Message */}
                    <h2 className="text-white text-2xl font-bold mb-2">Call Ended</h2>
                    <p className="text-gray-400 text-lg">{disconnectReason || 'Disconnected'}</p>
                </div>
            </div>
        );
    }

    // --- CONNECTING/ACTIVE STATE (Existing Video UI) ---
    const isConnecting = callState === 'connecting';

    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Remote Video (Full Screen) */}
            <div className="relative w-full h-full">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    // On iOS, sometimes we need to ensure it's not strictly muted but allowed
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                        <div className="text-center">
                            {isConnecting ? (
                                <>
                                    <div className="w-20 h-20 border-4 border-[#20B2AA] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-white text-xl">Connecting...</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#20B2AA] to-[#1C9D96] flex items-center justify-center text-white text-4xl font-bold mb-4 mx-auto">
                                        {peerName.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="text-white text-xl">{peerName}</p>
                                    <p className="text-gray-400 mt-2">Waiting for video...</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Top Bar - Peer Name & Duration */}
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-white text-xl font-bold">{peerName}</h2>
                            {callState === 'active' && (
                                <p className="text-gray-300 text-sm">{formatDuration(callDuration)}</p>
                            )}
                            {callState === 'connecting' && (
                                <p className="text-gray-300 text-sm animate-pulse">Connecting...</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Local Video (Picture-in-Picture) */}
                {localStream && (
                    <div className="absolute top-24 sm:top-24 right-4 sm:right-6 w-32 h-44 sm:w-40 sm:h-32 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-900 group transition-all duration-300">
                        {isVideoOff ? (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    <line x1="2" y1="2" x2="22" y2="22" strokeWidth={2} />
                                </svg>
                            </div>
                        ) : (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover mirror"
                            />
                        )}
                    </div>
                )}

                {/* Control Bar (Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 sm:p-12">
                    <div className="flex items-center justify-center gap-6 sm:gap-8">
                        {/* Mute Toggle */}
                        <button
                            onClick={toggleMute}
                            className={`w-16 h-16 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${isMuted
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-white/20 hover:bg-white/30 backdrop-blur-md'
                                } shadow-lg`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? (
                                <svg className="w-8 h-8 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                            )}
                        </button>

                        {/* End Call */}
                        <button
                            onClick={endActiveCall}
                            className="w-20 h-20 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-xl shadow-red-500/50"
                            title="End Call"
                        >
                            <svg className="w-10 h-10 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                            </svg>
                        </button>

                        {/* Video Toggle */}
                        <button
                            onClick={toggleVideo}
                            className={`w-16 h-16 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${isVideoOff
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-white/20 hover:bg-white/30 backdrop-blur-md'
                                } shadow-lg`}
                            title={isVideoOff ? 'Enable Video' : 'Disable Video'}
                        >
                            {isVideoOff ? (
                                <svg className="w-8 h-8 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    <line x1="2" y1="2" x2="22" y2="22" strokeWidth={2} />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .mirror {
                    transform: scaleX(-1);
                }
            `}</style>
        </div>
    );
}

export default ActiveCallView;
