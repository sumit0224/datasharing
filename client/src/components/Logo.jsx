import React from 'react';

const Logo = ({ className = "w-10 h-10" }) => {
    return (
        <div className="flex items-center gap-2 shrink-0">
            <div className={className}>
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full"
                >
                    <defs>
                        <linearGradient id="logo-gradient-v2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="50%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#4f46e5" />
                        </linearGradient>
                        <filter id="logo-glow-v2" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Outer Hexagon Shape (Subtle Background) */}
                    <path
                        d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z"
                        fill="url(#logo-gradient-v2)"
                        fillOpacity="0.1"
                        stroke="url(#logo-gradient-v2)"
                        strokeWidth="1"
                        strokeOpacity="0.2"
                    />

                    {/* Central Pulse Node */}
                    <circle cx="50" cy="75" r="8" fill="url(#logo-gradient-v2)" filter="url(#logo-glow-v2)" />
                    <circle cx="50" cy="75" r="12" stroke="url(#logo-gradient-v2)" strokeWidth="1" strokeOpacity="0.3">
                        <animate attributeName="r" values="8;16;8" dur="3s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
                    </circle>

                    {/* Wi-Fi Arcs with Connectivity Nodes */}
                    <path
                        d="M30 55 C38 45 62 45 70 55"
                        stroke="url(#logo-gradient-v2)"
                        strokeWidth="7"
                        strokeLinecap="round"
                    />
                    <circle cx="30" cy="55" r="3" fill="#4f46e5" />
                    <circle cx="70" cy="55" r="3" fill="#4f46e5" />

                    <path
                        d="M20 40 C35 25 65 25 80 40"
                        stroke="url(#logo-gradient-v2)"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeOpacity="0.7"
                    />
                    <circle cx="20" cy="40" r="3" fill="#6366f1" />
                    <circle cx="80" cy="40" r="3" fill="#6366f1" />

                    <path
                        d="M10 25 C30 5 70 5 90 25"
                        stroke="url(#logo-gradient-v2)"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeOpacity="0.4"
                    />

                </svg>
            </div>
            <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
                Wifi Share
            </span>
        </div>
    );
};

export default Logo;
