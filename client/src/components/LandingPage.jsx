import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';
import MouseGlow from './MouseGlow';  // [NEW] Import MouseGlow
import HeroCanvas from './HeroCanvas'; // [NEW] Import 3D Canvas

const LandingPage = () => {
    const navigate = useNavigate();

    const handleUseWebApp = () => {
        navigate('/app');
    };

    const handleDownloadApk = () => {
        const link = document.createElement('a');
        link.href = '/wifishare.apk'; // File in public folder
        link.download = 'wifishare.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-white relative overflow-x-hidden">
            {/* [NEW] Mouse Glow Effect (Background) */}
            <MouseGlow />

            {/* Navigation */}
            <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <Logo className="w-8 h-8" />

                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleUseWebApp}
                                className="text-gray-600 hover:text-black font-medium text-sm transition"
                            >
                                Use Web App
                            </button>
                            <button
                                onClick={handleDownloadApk}
                                className="bg-black text-white px-5 py-2 rounded-full font-medium text-sm hover:bg-gray-800 transition shadow-lg shadow-gray-200"
                            >
                                Download App
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-20 pb-32 overflow-hidden relative">
                {/* [NEW] 3D Hero Background */}
                <HeroCanvas />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-700 text-sm font-medium mb-8 border border-purple-100">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                        </span>
                        Real-time local file sharing
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                        Share files instantly <br />
                        <span className="text-purple-600">without the internet.</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-xl text-gray-500 mb-10 leading-relaxed">
                        The fastest way to transfer text and files between devices on the same network.
                        No logins, no clouds, no tracking. Just simple, secure sharing.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={handleUseWebApp}
                            className="px-8 py-4 bg-purple-600 text-white rounded-xl font-bold text-lg hover:bg-purple-700 transition shadow-xl shadow-purple-200 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
                        >
                            Start Sharing Now
                        </button>
                        <button
                            onClick={handleDownloadApk}
                            className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-xl font-bold text-lg hover:bg-gray-50 transition w-full sm:w-auto flex items-center justify-center gap-2"
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.523 15.3414C17.523 15.3414 17.5644 15.3414 17.5644 15.3414C17.5644 15.3414 17.5644 15.3414 17.5644 15.3414C17.5644 15.3414 17.523 15.3414 17.523 15.3414ZM7.92554 21.9568C7.59528 22.4573 7.05834 22.7571 6.47995 22.7571C5.57143 22.7571 4.82857 22.0143 4.82857 21.1057V15.7429H1.42857C0.686257 15.7429 0.0483429 15.1583 0 14.4173V14.3986C0 14.3725 0.0016 14.3465 0.00474286 14.3204V14.2882C0.0210286 13.9877 0.126057 13.705 0.298914 13.4686L6.58457 4.86857C6.88377 4.45903 7.37126 4.21429 7.89257 4.21429C8.63543 4.21429 9.3248 4.67897 9.58554 5.37891L11.5273 10.5929L14.4728 2.68434C14.7335 1.9844 15.4229 1.51971 16.1658 1.51971C16.6871 1.51971 17.1746 1.76446 17.4738 2.174L23.7594 10.774C23.9323 11.0104 24.0373 11.2931 24.0536 11.5936V11.6258C24.0567 11.6519 24.0583 11.6779 24.0583 11.704V11.7227C24.01 12.4637 23.3721 13.0483 22.6298 13.0483H19.2298V18.4111C19.2298 19.3197 18.4869 20.0626 17.5784 20.0626C16.9999 20.0626 16.4631 19.7628 16.1329 19.2623L12.0292 13.0483H12.0292L7.92554 21.9568Z" />
                            </svg>
                            Download APK
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-3 gap-12">
                        {[
                            {
                                icon: "⚡",
                                title: "Instant Transfer",
                                desc: "Send text and files instantly to anyone on the same Wi-Fi network. No waiting for uploads."
                            },
                            {
                                icon: "🔒",
                                title: "Secure & Private",
                                desc: "Your data never leaves your local network. No external servers (unless you share globally)."
                            },
                            {
                                icon: "🚀",
                                title: "No Login Required",
                                desc: "Just open the app and start sharing. No accounts, no passwords, no friction."
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition">
                                <div className="text-4xl mb-4 bg-gray-50 w-16 h-16 flex items-center justify-center rounded-xl">{feature.icon}</div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white py-12 border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-500">
                    <p>© {new Date().getFullYear()} wifi share. Built for speed.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
