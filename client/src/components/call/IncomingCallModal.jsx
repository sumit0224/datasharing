import React, { useEffect, useState } from 'react';
import { useCall } from '../../context/CallContext';

function IncomingCallModal() {
    const { caller, acceptIncomingCall, rejectIncomingCall } = useCall();
    const [timeLeft, setTimeLeft] = useState(30);

    // Auto-reject timeout
    useEffect(() => {
        if (!caller) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    rejectIncomingCall();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [caller, rejectIncomingCall]);

    if (!caller) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 shadow-2xl border border-white/10 max-w-md w-full mx-4 animate-scale-in">
                {/* Caller Avatar */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#20B2AA] to-[#1C9D96] flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {caller.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        {/* Ringing animation */}
                        <div className="absolute inset-0 rounded-full border-4 border-[#20B2AA] animate-ping opacity-50"></div>
                    </div>
                </div>

                {/* Caller Info */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Incoming Video Call
                    </h2>
                    <p className="text-gray-300 text-lg">
                        {caller.name || 'Unknown'}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                        Auto-reject in {timeLeft}s
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    {/* Reject Button */}
                    <button
                        onClick={rejectIncomingCall}
                        className="flex-1 py-4 px-6 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-2xl text-red-400 font-bold transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Decline
                    </button>

                    {/* Accept Button */}
                    <button
                        onClick={acceptIncomingCall}
                        className="flex-1 py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-2xl text-white font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Accept
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .animate-scale-in {
                    animation: scale-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}

export default IncomingCallModal;
