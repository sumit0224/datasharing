import React, { useState } from 'react';

const JoinRoomModal = ({ isOpen, onClose, onJoinRoom }) => {
    const [roomIdInput, setRoomIdInput] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanedId = roomIdInput.trim();
        if (cleanedId) {
            onJoinRoom(cleanedId);
            onClose();
            setRoomIdInput('');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-sm rounded-[32px] overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl relative">
                {/* Decorative Blur */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#20B2AA]/20 rounded-full blur-[50px] pointer-events-none -mr-16 -mt-16" />

                <div className="p-6 md:p-8 relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Join Room</h2>
                            <p className="text-gray-400 text-sm mt-1">Enter a Room ID to connect</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-white/5 hover:bg-white/10 p-2 rounded-full text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#20B2AA] uppercase tracking-widest ml-1">Room ID</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={roomIdInput}
                                    onChange={(e) => setRoomIdInput(e.target.value)}
                                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#20B2AA]/50 focus:border-[#20B2AA] outline-none transition-all font-mono text-lg text-white placeholder-gray-600 group-hover:border-white/20"
                                    placeholder="e.g. public-xyz-123"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-[#20B2AA] text-black rounded-2xl font-bold shadow-[0_0_20px_-5px_rgba(32,178,170,0.4)] hover:bg-[#1C9D96] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 uppercase tracking-wider text-sm flex items-center justify-center gap-2"
                        >
                            <span>Connect</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default JoinRoomModal;
