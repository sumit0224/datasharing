import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api';

const CreateRoomModal = ({ isOpen, onClose, onRoomCreated, apiUrl }) => {
    const [expiresIn, setExpiresIn] = useState(30);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Always public, no password
            const payload = {
                type: 'public',
                expiresIn: expiresIn
            };

            const { data } = await api.post(`${apiUrl}/api/room/create`, payload);
            toast.success(`Room created! ID: ${data.roomId}`);
            onRoomCreated(data.roomId, null);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create room');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-sm rounded-[32px] overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl relative">
                {/* Decorative Blur */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] pointer-events-none -ml-16 -mt-16" />

                <div className="p-6 md:p-8 relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Create Room</h2>
                            <p className="text-gray-400 text-sm mt-1">Start a new sharing session</p>
                        </div>
                        <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-full text-gray-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-purple-400 uppercase tracking-widest ml-1">Expires In</label>
                            <div className="relative group">
                                <select
                                    value={expiresIn}
                                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all text-white appearance-none cursor-pointer hover:border-white/20"
                                >
                                    <option value={10} className="bg-[#111]">10 Minutes</option>
                                    <option value={30} className="bg-[#111]">30 Minutes</option>
                                    <option value={60} className="bg-[#111]">1 Hour</option>
                                    <option value={1440} className="bg-[#111]">24 Hours</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 ml-1">Room will be automatically deleted after this time.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-[#20B2AA] to-[#1C9D96] text-black rounded-2xl font-bold shadow-[0_0_20px_-5px_rgba(32,178,170,0.4)] hover:shadow-[0_0_25px_-5px_rgba(32,178,170,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 uppercase tracking-wider text-sm disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Creating...</span>
                                </>
                            ) : (
                                <>
                                    <span>Create Room</span>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateRoomModal;
