import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';

const AppTerms = () => {
    const navigate = useNavigate();

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-black text-white selection:bg-[#20B2AA]/30">
            <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                        <Logo className="w-8 h-8 text-white" />

                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-6 pt-32 pb-20">
                <h1 className="text-4xl md:text-5xl font-bold mb-8 text-[#20B2AA]">
                    Terms of Service
                </h1>

                <div className="space-y-8 text-gray-300 leading-relaxed text-lg">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            1. Acceptance of Terms
                        </h2>
                        <p>
                            By accessing or using WiFi Share, you agree to comply with and be bound by
                            these Terms of Service. If you do not agree to these terms, please do not
                            use the application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            2. Description of Service
                        </h2>
                        <p>
                            WiFi Share allows users to share files and text between devices connected
                            to the same local Wi-Fi network. The service is designed for temporary,
                            real-time sharing without requiring user accounts or cloud storage.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            3. Acceptable Use
                        </h2>
                        <p>
                            You agree to use WiFi Share only for lawful purposes. You are solely
                            responsible for the content you share. Sharing illegal, harmful,
                            copyrighted, malicious, or abusive content is strictly prohibited.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            4. User Responsibility
                        </h2>
                        <p>
                            All data shared using WiFi Share is transferred over local networks.
                            You are responsible for ensuring that you trust the network and devices
                            you are connected to before sharing any files.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            5. No Data Guarantee
                        </h2>
                        <p>
                            WiFi Share does not guarantee successful delivery, storage, or retention
                            of any files or messages. Data is not permanently stored, and transfers
                            may fail due to network conditions or device limitations.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            6. No Warranty
                        </h2>
                        <p>
                            The service is provided on an “as is” and “as available” basis without
                            warranties of any kind. We do not guarantee uninterrupted or error-free
                            operation and are not liable for any loss or damage arising from use of
                            the service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            7. Limitation of Liability
                        </h2>
                        <p>
                            To the maximum extent permitted by law, WiFi Share shall not be liable for
                            any indirect, incidental, or consequential damages resulting from the use
                            or inability to use the application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            8. Changes to These Terms
                        </h2>
                        <p>
                            We reserve the right to update or modify these Terms of Service at any
                            time. Continued use of the application after changes are made constitutes
                            acceptance of the updated terms.
                        </p>
                    </section>
                </div>


                <div className="mt-12 pt-12 border-t border-white/10">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-[#20B2AA] hover:text-white transition-colors font-mono"
                    >
                        ← Back
                    </button>
                </div>
            </main>
        </div>
    );
};

export default AppTerms;
