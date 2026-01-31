import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Lazy load components for better initial load performance (Code Splitting)
const LandingPage = lazy(() => import('./components/LandingPage'));
const WebApp = lazy(() => import('./components/WebApp'));
const NotFound = lazy(() => import('./components/NotFound'));
const AppPrivacy = lazy(() => import('./components/AppPrivacy'));
const AppTerms = lazy(() => import('./components/AppTerms'));

// Minimal Loader Component (Matches index.html critical CSS)
const LoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div className="w-10 h-10 border-[3px] border-white/10 border-t-[#20B2AA] rounded-full animate-spin"></div>
  </div>
);

function App() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.dismiss('offline-toast');
      toast.success('You are back online!', {
        position: "bottom-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.info('You are offline. Local sharing works on the same Wi-Fi.', {
        toastId: 'offline-toast',
        position: "bottom-right",
        autoClose: false,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Router>
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<WebApp />} />
          <Route path="/privacy" element={<AppPrivacy />} />
          <Route path="/terms" element={<AppTerms />} />
          {/* 404 / Coming Soon Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
