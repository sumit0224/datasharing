import React from 'react';
import PropTypes from 'prop-types';

const RoomInfo = React.memo(({ roomId, userCount, onCopyRoom }) => {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-gray-600">Room:</span>
                    <code className="bg-gray-100 px-3 py-1 rounded-md font-mono text-xs text-gray-800 select-all">
                        {roomId || <span className="bg-gray-200 animate-pulse rounded w-20 h-4 inline-block"></span>}
                    </code>
                    {roomId && (
                        <button
                            onClick={() => onCopyRoom(roomId)}
                            className="p-2 rounded transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-200"
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
                    <span className="text-gray-600">Online:</span>
                    <span className="font-semibold text-green-600" aria-label={`${userCount} users online`}>
                        {userCount}
                    </span>
                </div>
            </div>
        </div>
    );
});

RoomInfo.propTypes = {
    roomId: PropTypes.string,
    userCount: PropTypes.number.isRequired,
    onCopyRoom: PropTypes.func.isRequired
};

RoomInfo.displayName = 'RoomInfo';

export default RoomInfo;
