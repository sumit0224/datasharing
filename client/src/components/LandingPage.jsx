import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from './Logo';
import MouseGlow from './MouseGlow';  // [NEW] Import MouseGlow
import HeroCanvas from './HeroCanvas'; // [NEW] Import 3D Canvas

const LandingPage = () => {
    const navigate = useNavigate();
    const [openIndex, setOpenIndex] = useState(0);

    const faqs = [
        {
            question: "How does it work offline?",
            answer: "Once you open the app for the first time, it's saved to your device via PWA technology. You can open it later without internet. File sharing works over your local Wi-Fi network, meaning devices communicate directly through your router even if the internet cable is unplugged."
        },
        {
            question: "How do I install the app?",
            answer: (
                <>
                    <strong>Mobile:</strong> Tap "Share" (iOS) or "Menu" (Android) and select "Add to Home Screen".<br />
                    <strong>Desktop:</strong> Click the Install icon <span className="inline-block bg-gray-200 rounded px-1 text-xs">⬇</span> in your browser's address bar.
                </>
            )
        },
        {
            question: "Is my data secure?",
            answer: "Yes. Your files are transferred directly between devices on your local network. We do not store your files on any cloud servers or external databases."
        }
    ];

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
        <div
            className="min-h-screen bg-black relative overflow-x-hidden text-white selection:bg-[#20B2AA]/30 select-none"
            onDragStart={(e) => e.preventDefault()}
        >
            {/* [NEW] Mouse Glow Effect (Background) */}
            <MouseGlow />

            {/* Ambient Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#20B2AA]/10 to-transparent pointer-events-none" />
            <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-[#20B2AA]/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-transparent backdrop-blur-none transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="w-9 h-9" />
                    </div>
                    <div className="flex items-center gap-6">
                        <button
                            onClick={handleUseWebApp}
                            className="text-gray-400 hover:text-white font-medium text-sm transition tracking-wide hidden sm:block"
                        >
                            Open Web App
                        </button>
                        <button
                            onClick={handleDownloadApk}
                            className="bg-[#20B2AA] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1C9D96] transition shadow-lg shadow-teal-500/20 active:scale-95 duration-200"
                        >
                            Get App
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 md:pt-48 md:pb-32 relative">
                <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
                    <div className="text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#20B2AA]/10 text-[#20B2AA] text-xs font-bold mb-8 border border-[#20B2AA]/20 tracking-wide uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#20B2AA] animate-pulse" />
                            Local P2P Sharing
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold tracking-wider text-white mb-6 leading-[1.1] font-orbitron">
                            Share freely. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#20B2AA] to-teal-200 drop-shadow-[0_0_15px_rgba(32,178,170,0.5)]">
                                No Internet needed.
                            </span>
                        </h1>

                        <p className="text-lg text-gray-400 mb-10 leading-relaxed max-w-lg font-light">
                            Transfer photos, videos, and huge files directly between devices on your Wi-Fi. Fast, secure, and private by default.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={handleUseWebApp}
                                className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition hover:-translate-y-1 shadow-xl shadow-white/5"
                            >
                                Start Sharing
                            </button>
                            <button
                                onClick={handleDownloadApk}
                                className="px-8 py-4 bg-white/5 backdrop-blur-sm text-white border border-white/10 rounded-xl font-bold text-lg hover:bg-white/10 transition flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.523 15.3414C17.523 15.3414 17.5644 15.3414 17.5644 15.3414C17.5644 15.3414 17.5644 15.3414 17.5644 15.3414C17.5644 15.3414 17.523 15.3414 17.523 15.3414ZM7.92554 21.9568C7.59528 22.4573 7.05834 22.7571 6.47995 22.7571C5.57143 22.7571 4.82857 22.0143 4.82857 21.1057V15.7429H1.42857C0.686257 15.7429 0.0483429 15.1583 0 14.4173V14.3986C0 14.3725 0.0016 14.3465 0.00474286 14.3204V14.2882C0.0210286 13.9877 0.126057 13.705 0.298914 13.4686L6.58457 4.86857C6.88377 4.45903 7.37126 4.21429 7.89257 4.21429C8.63543 4.21429 9.3248 4.67897 9.58554 5.37891L11.5273 10.5929L14.4728 2.68434C14.7335 1.9844 15.4229 1.51971 16.1658 1.51971C16.6871 1.51971 17.1746 1.76446 17.4738 2.174L23.7594 10.774C23.9323 11.0104 24.0373 11.2931 24.0536 11.5936V11.6258C24.0567 11.6519 24.0583 11.6779 24.0583 11.704V11.7227C24.01 12.4637 23.3721 13.0483 22.6298 13.0483H19.2298V18.4111C19.2298 19.3197 18.4869 20.0626 17.5784 20.0626C16.9999 20.0626 16.4631 19.7628 16.1329 19.2623L12.0292 13.0483H12.0292L7.92554 21.9568Z" />
                                </svg>
                                Android APK
                            </button>
                        </div>
                    </div>

                    {/* Right Side: 3D Canvas Container */}
                    <div className="relative h-[350px] lg:h-[600px] w-full block">
                        <div className="absolute inset-0 pointer-events-none">
                            <HeroCanvas />
                        </div>
                    </div>
                </div>
            </section>

            {/* Bento Grid Features */}
            <section className="py-24 px-4 bg-black relative">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16 text-left border-l-4 border-[#20B2AA] pl-6">
                        <h2 className="text-3xl font-bold text-white mb-2">Built for speed.</h2>
                        <p className="text-gray-400">Everything you need to share files securely.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
                        {/* Large Feature */}
                        <div className="md:col-span-2 row-span-1 bg-gradient-to-br from-gray-900 via-gray-900 to-black p-8 rounded-3xl border border-white/5 flex flex-col justify-between hover:border-[#20B2AA]/30 transition-colors group relative overflow-hidden">
                            <div className="bg-[#20B2AA]/10 absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[80px] pointer-events-none group-hover:bg-[#20B2AA]/20 transition-colors" />
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">Blazing Fast Transfer</h3>
                                <p className="text-gray-400 max-w-sm">Utilizes your router's maximum bandwidth. No throttling, no cloud uploads.</p>
                            </div>
                            <div className="text-5xl self-end">⚡</div>
                        </div>

                        {/* Tall Feature */}
                        <div className="md:col-span-1 row-span-2 bg-[#0F1629] p-8 rounded-3xl border border-white/5 flex flex-col justify-between hover:border-[#20B2AA]/30 transition-colors relative overflow-hidden">
                            <div className="bg-[#20B2AA]/10 absolute -left-10 -bottom-10 w-48 h-48 rounded-full blur-[60px] pointer-events-none" />
                            <div className="text-5xl mb-4">🔒</div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">End-to-End Local</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">Your data never leaves your four walls. It travels directly from Device A to Device B over your secure local network. Zero external access.</p>
                            </div>
                        </div>

                        {/* Standard Feature */}
                        <div className="md:col-span-1 row-span-1 bg-[#0F1629] p-8 rounded-3xl border border-white/5 flex flex-col justify-center hover:border-white/20 transition-colors">
                            <div className="text-4xl mb-4">🚀</div>
                            <h3 className="text-xl font-bold text-white mb-2">No Accounts</h3>
                            <p className="text-gray-400 text-sm">Just open the URL and start sharing.</p>
                        </div>

                        {/* Wide Feature */}
                        <div className="md:col-span-1 row-span-1 bg-[#0F1629] p-8 rounded-3xl border border-white/5 flex flex-col justify-center hover:border-white/20 transition-colors">
                            <div className="text-4xl mb-4">📱</div>
                            <h3 className="text-xl font-bold text-white mb-2">Cross Platform</h3>
                            <p className="text-gray-400 text-sm">Works on iOS, Android, Mac, Windows.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-24 bg-black border-t border-white/5">
                <div className="max-w-3xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-white mb-12">FAQ</h2>
                    <div className="space-y-4">
                        {faqs.map((faq, idx) => (
                            <div key={idx} className="border-b border-white/5 pb-4">
                                <button
                                    onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                                    className="w-full flex items-center justify-between py-4 text-left focus:outline-none group"
                                >
                                    <h3 className={`text-lg transition-colors font-medium ${openIndex === idx ? 'text-[#20B2AA]' : 'text-gray-300 group-hover:text-white'}`}>{faq.question}</h3>
                                    <span className={`transform transition-transform text-2xl ${openIndex === idx ? 'rotate-45 text-[#20B2AA]' : 'text-gray-500'}`}>+</span>
                                </button>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === idx ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                                        }`}
                                >
                                    <div className="pb-4 text-gray-400 leading-relaxed font-light">
                                        {faq.answer}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-black py-16 text-gray-500 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2">
                        <Logo className="w-7 h-7 text-gray-400" />
                    </div>
                    <div className="flex gap-8 text-sm font-medium">
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
                    </div>
                    <div className="text-xs font-mono opacity-50">
                        version 2.0
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
