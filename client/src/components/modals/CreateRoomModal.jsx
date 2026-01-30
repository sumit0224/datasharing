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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#111] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white tracking-tight">Create New Room</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Expires In</label>
                            <div className="relative">
                                <select
                                    value={expiresIn}
                                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-[#20B2AA] focus:border-[#20B2AA] outline-none transition-all text-white appearance-none"
                                >
                                    <option value={10} className="bg-[#111]">10 Minutes</option>
                                    <option value={30} className="bg-[#111]">30 Minutes</option>
                                    <option value={60} className="bg-[#111]">1 Hour</option>
                                    <option value={1440} className="bg-[#111]">24 Hours</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-[#20B2AA] text-black rounded-xl font-bold shadow-lg shadow-[#20B2AA]/20 hover:bg-[#1C9D96] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Room'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateRoomModal;
