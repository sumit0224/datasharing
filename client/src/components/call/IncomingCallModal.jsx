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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#20B2AA]/20 rounded-full blur-[100px] animate-pulse" />
            </div>

            <div className="relative w-full max-w-sm flex flex-col items-center justify-between py-12 h-[80vh] max-h-[700px]">

                {/* Caller Info */}
                <div className="flex flex-col items-center gap-6 animate-in slide-in-from-top-10 duration-700">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#20B2AA] to-[#1C9D96] flex items-center justify-center text-white text-5xl font-bold shadow-2xl relative z-10 p-1 border-4 border-black/20">
                            {caller.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        {/* Ripples */}
                        <div className="absolute inset-0 rounded-full border-2 border-[#20B2AA] animate-[ping_1.5s_ease-out_infinite] opacity-50 z-0 scale-150"></div>
                        <div className="absolute inset-0 rounded-full border-2 border-[#20B2AA] animate-[ping_1.5s_ease-out_infinite_0.5s] opacity-30 z-0 scale-125"></div>
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold text-white tracking-tight text-shadow-lg">
                            {caller.name || 'Unknown User'}
                        </h2>
                        <div className="text-[#20B2AA] font-medium tracking-widest text-sm uppercase bg-[#20B2AA]/10 px-3 py-1 rounded-full border border-[#20B2AA]/20 inline-block animate-pulse">
                            Incoming Video Call...
                        </div>
                    </div>
                </div>

                {/* Status / Timer */}
                <div className="text-gray-500 font-mono text-xs tracking-widest uppercase">
                    Auto-reject in {timeLeft}s
                </div>

                {/* Action Buttons */}
                <div className="w-full grid grid-cols-2 gap-6 px-4 animate-in slide-in-from-bottom-10 duration-700 delay-200">
                    {/* Decline */}
                    <button
                        onClick={rejectIncomingCall}
                        className="group flex flex-col items-center gap-3 transition-transform active:scale-95"
                    >
                        <div className="w-20 h-20 rounded-full bg-red-500/20 glass-panel border border-red-500/30 flex items-center justify-center text-red-500 group-hover:bg-red-500/30 group-hover:scale-110 transition-all duration-300 shadow-[0_0_30px_-10px_rgba(239,68,68,0.4)]">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <span className="text-gray-400 font-medium tracking-wide">Decline</span>
                    </button>

                    {/* Accept */}
                    <button
                        onClick={acceptIncomingCall}
                        className="group flex flex-col items-center gap-3 transition-transform active:scale-95"
                    >
                        <div className="w-20 h-20 rounded-full bg-[#20B2AA] text-black flex items-center justify-center group-hover:bg-[#1C9D96] group-hover:scale-110 transition-all duration-300 shadow-[0_0_40px_-5px_rgba(32,178,170,0.5)]">
                            <svg className="w-8 h-8 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="text-white font-bold tracking-wide">Accept</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default IncomingCallModal;
