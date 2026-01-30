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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#111] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white tracking-tight">Join Existing Room</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Room ID</label>
                            <input
                                type="text"
                                required
                                autoFocus
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-[#20B2AA] focus:border-[#20B2AA] outline-none transition-all font-mono text-white placeholder-gray-500"
                                placeholder="e.g. public-xyz-123"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-[#20B2AA] text-black rounded-xl font-bold shadow-lg shadow-[#20B2AA]/20 hover:bg-[#1C9D96] transition-all uppercase tracking-wider text-sm hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Join Room
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default JoinRoomModal;
