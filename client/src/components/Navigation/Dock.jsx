import React from 'react';
import PropTypes from 'prop-types';

const Dock = ({ activeTab, onTabChange, onNewRoom, onJoinRoom, onRandomChat }) => {

    const dockItems = [
        { id: 'text', label: 'Text', icon: '💬' },
        { id: 'files', label: 'Files', icon: '📁' },
        { id: 'divider-1', type: 'divider' },
        { id: 'create', label: 'New', icon: '➕', action: onNewRoom, primary: true },
        { id: 'join', label: 'Join', icon: '🔗', action: onJoinRoom },
        { id: 'divider-2', type: 'divider' },
        { id: 'random', label: 'Random', icon: '🌍', action: onRandomChat, special: true },
    ];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[90%] md:max-w-fit pointer-events-none fade-in pb-safe">
            <div className="glass-dock rounded-[28px] p-2 flex items-center justify-between md:justify-center gap-1 md:gap-3 pointer-events-auto border border-white/10 shadow-2xl mx-auto overflow-x-auto no-scrollbar md:overflow-visible min-w-[320px] md:min-w-[400px]">

                {dockItems.map((item) => {
                    if (item.type === 'divider') {
                        return <div key={item.id} className="w-[1px] h-8 bg-white/10 mx-1 flex-shrink-0" />;
                    }

                    const isActive = activeTab === item.id;
                    const isPrimary = item.primary;
                    const isSpecial = item.special;

                    return (
                        <button
                            key={item.id}
                            onClick={() => item.action ? item.action() : onTabChange(item.id)}
                            className={`
                                relative group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 w-[56px] h-[56px] flex-shrink-0
                                ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}
                                ${isPrimary ? '!bg-[#20B2AA] !text-black shadow-[0_0_20px_rgba(32,178,170,0.4)] hover:!bg-[#1C9D96]' : ''}
                                ${isSpecial ? 'hover:bg-purple-500/20' : ''}
                            `}
                        >
                            {/* Active Indicator Dot */}
                            {isActive && !isPrimary && (
                                <span className="absolute -top-1 w-1 h-1 bg-[#20B2AA] rounded-full shadow-[0_0_8px_#20B2AA]" />
                            )}

                            {/* Icon */}
                            <span className={`text-xl mb-0.5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
                                {item.icon}
                            </span>

                            {/* Label (Micro) */}
                            <span className={`text-[9px] font-medium tracking-wide transition-colors ${isPrimary ? 'text-black/80 font-bold' :
                                    isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                                }`}>
                                {item.label}
                            </span>

                            {/* Tooltip for Desktop */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap hidden md:block border border-white/10">
                                {item.label}
                                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-black/80 rotate-45 border-r border-b border-white/10"></div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

Dock.propTypes = {
    activeTab: PropTypes.string.isRequired,
    onTabChange: PropTypes.func.isRequired,
    onNewRoom: PropTypes.func.isRequired,
    onJoinRoom: PropTypes.func.isRequired,
    onRandomChat: PropTypes.func.isRequired
};

export default Dock;
