import React from 'react';
import PropTypes from 'prop-types';

const RoomInfo = React.memo(({ roomId, userCount, onCopyRoom, onCloseRoom, isPrivate }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                {/* Room ID Badge */}
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 uppercase text-[10px] font-bold tracking-widest">Room:</span>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
                        <code className="font-mono text-sm text-[#20B2AA] font-bold select-all tracking-wider">
                            {roomId || <span className="bg-white/10 animate-pulse rounded w-20 h-4 inline-block"></span>}
                        </code>
                        {roomId && (
                            <button
                                onClick={() => onCopyRoom(roomId)}
                                className="p-1.5 rounded-lg transition-all text-gray-500 hover:text-white hover:bg-white/10 active:scale-95 border border-transparent hover:border-white/10"
                                title="Copy Room ID"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Online Badge */}
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 uppercase text-[10px] font-bold tracking-widest">Online:</span>
                    <div className="flex items-center gap-2 bg-[#20B2AA]/5 border border-[#20B2AA]/20 px-3 py-2 rounded-xl">
                        <span className="w-1.5 h-1.5 bg-[#20B2AA] rounded-full animate-pulse shadow-[0_0_8px_#20B2AA]"></span>
                        <span className="font-bold text-[#20B2AA] text-sm" aria-label={`${userCount} users online`}>
                            {userCount}/100
                        </span>
                    </div>
                </div>
            </div>

            {/* Exit/Close Button */}
            {roomId && (
                <div className="flex justify-end">
                    <button
                        onClick={onCloseRoom}
                        className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-500/10 bg-red-500/5 border border-red-500/10 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                        title="Exit this room"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Exit Room
                    </button>
                </div>
            )}
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
