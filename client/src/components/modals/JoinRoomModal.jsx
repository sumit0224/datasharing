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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Join Existing Room</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Room ID</label>
                            <input
                                type="text"
                                required
                                autoFocus
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all font-mono"
                                placeholder="e.g. public-xyz-123"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-all"
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
