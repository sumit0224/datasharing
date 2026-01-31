import React from 'react';
import PropTypes from 'prop-types';

const RoomInfo = React.memo(({ roomId, userCount, onCopyRoom, onCloseRoom, isPrivate }) => {
    return (
        <div className="w-full flex items-center justify-between bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-2 md:p-3 shadow-2xl animate-scale-in">
            {/* Left: Room Status */}
            <div className="flex items-center gap-3 pl-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Current Room</span>
                    <div className="flex items-center gap-2">
                        <code className="text-xl md:text-2xl font-orbitron text-white tracking-wider">
                            {roomId || '...'}
                        </code>
                        <div className="flex items-center gap-1.5 bg-[#20B2AA]/10 px-2 py-0.5 rounded-full border border-[#20B2AA]/20">
                            <span className="w-1.5 h-1.5 bg-[#20B2AA] rounded-full animate-pulse shadow-[0_0_6px_#20B2AA]"></span>
                            <span className="text-[10px] font-bold text-[#20B2AA]">{userCount} Online</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {roomId && (
                    <>
                        <button
                            onClick={() => {
                                const shareUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${roomId}`;
                                onCopyRoom(shareUrl);
                            }}
                            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 hover:border-white/20 transition-all flex items-center justify-center active:scale-95"
                            title="Copy Link"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <button
                            onClick={onCloseRoom}
                            className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 hover:border-red-500/30 transition-all flex items-center justify-center active:scale-95"
                            title="Exit Room"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});

RoomInfo.propTypes = {
    roomId: PropTypes.string,
    userCount: PropTypes.number.isRequired,
    onCopyRoom: PropTypes.func.isRequired,
    onCloseRoom: PropTypes.func
};

RoomInfo.displayName = 'RoomInfo';

export default RoomInfo;
