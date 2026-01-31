import React from 'react';
import { useCall } from '../../context/CallContext';

function CallButton({ userId, userName, className = '' }) {
    const { callState, initiateCall } = useCall();

    const handleCall = () => {
        if (!userId) {
            console.warn('No user ID provided');
            return;
        }
        initiateCall(userId, userName || userId);
    };

    const isDisabled = !userId || callState !== 'idle';

    return (
        <button
            onClick={handleCall}
            disabled={isDisabled}
            className={`group relative px-4 py-2 bg-gradient-to-r from-[#20B2AA] to-[#1C9D96] hover:from-[#1C9D96] hover:to-[#178A86] text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-[#20B2AA]/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none ${className}`}
            title={isDisabled ? (callState !== 'idle' ? 'Already in a call' : 'User not available') : 'Start video call'}
        >
            <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Video Call</span>
            </div>
        </button>
    );
}

export default CallButton;
