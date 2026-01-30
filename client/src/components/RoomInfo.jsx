import React from 'react';
import PropTypes from 'prop-types';

const RoomInfo = React.memo(({ roomId, userCount, onCopyRoom, onCloseRoom, isPrivate }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 uppercase text-xs font-bold tracking-wider">Room:</span>
                    <code className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-mono text-sm text-[#20B2AA] font-bold select-all tracking-wide">
                        {roomId || <span className="bg-white/10 animate-pulse rounded w-20 h-4 inline-block"></span>}
                    </code>
                    {roomId && (
                        <button
                            onClick={() => onCopyRoom(roomId)}
                            className="p-2 rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/10 active:scale-95"
                            title="Copy Room ID"
                            aria-label="Copy room ID to clipboard"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 uppercase text-xs font-bold tracking-wider">Online:</span>
                    <span className="font-bold text-[#20B2AA] bg-[#20B2AA]/10 px-2 py-0.5 rounded-md border border-[#20B2AA]/20" aria-label={`${userCount} users online`}>
                        {userCount}
                    </span>
                </div>
            </div>

            {roomId && isPrivate && (
                <button
                    onClick={onCloseRoom}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                    title="Destroy this room"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Close Room
                </button>
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
