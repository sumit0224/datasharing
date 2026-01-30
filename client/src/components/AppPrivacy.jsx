import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';

const AppPrivacy = () => {
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
  Privacy Policy
</h1>

<div className="space-y-8 text-gray-300 leading-relaxed text-lg">
  <section>
    <h2 className="text-2xl font-bold text-white mb-4">
      1. Privacy by Design
    </h2>
    <p>
      WiFi Share is built with privacy as a core principle. The app is designed
      to work on the same local Wi-Fi network, allowing users to share files and
      text directly without uploading data to the cloud or external servers.
    </p>
  </section>

  <section>
    <h2 className="text-2xl font-bold text-white mb-4">
      2. No Account & No Personal Data
    </h2>
    <p>
      We do not require account creation, email addresses, phone numbers, or
      any form of personal identification. Users can open the app and start
      sharing instantly without providing personal information.
    </p>
  </section>

  <section>
    <h2 className="text-2xl font-bold text-white mb-4">
      3. Local Network Data Transfer
    </h2>
    <p>
      All file and message transfers occur over the local Wi-Fi network.
      Shared data is transmitted only between connected devices and is not
      permanently stored on our servers.
    </p>
  </section>

  <section>
    <h2 className="text-2xl font-bold text-white mb-4">
      4. Temporary Session Data
    </h2>
    <p>
      Any session-related information (such as room identifiers or connection
      tokens) exists only for the duration of an active session. Once the
      session ends or the app is closed, this data is automatically cleared.
    </p>
  </section>

  <section>
    <h2 className="text-2xl font-bold text-white mb-4">
      5. Browser Storage Usage
    </h2>
    <p>
      We may use limited browser storage (such as localStorage) only to maintain
      session continuity and basic app functionality. This data is not used for
      tracking, analytics profiling, or advertising purposes.
    </p>
  </section>

  <section>
    <h2 className="text-2xl font-bold text-white mb-4">
      6. Internet & Offline Usage
    </h2>
    <p>
      An internet connection may be required to open the web app for the first
      time. Once loaded, the app can function without internet access for local
      Wi-Fi sharing. File transfers do not rely on cloud services or external
      networks.
    </p>
  </section>

  <section>
    <h2 className="text-2xl font-bold text-white mb-4">
      7. Security
    </h2>
    <p>
      We take reasonable measures to ensure secure data transmission within the
      local network. However, users are encouraged to use trusted Wi-Fi networks
      and avoid sharing sensitive files on public or unsecured connections.
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

export default AppPrivacy;
