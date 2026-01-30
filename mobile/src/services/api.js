import axios from 'axios';

// Render production URL
const API_URL = 'https://datasharing-1.onrender.com';

const api = axios.create({
    baseURL: API_URL,
    timeout: 60000, // Increased timeout for cold starts (60s)
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add retry interceptor for cold starts
api.interceptors.response.use(null, async (error) => {
    const { config, message } = error;
    if (!config || !config.retry) {
        config.retry = 3; // Retry count
    }

    // Check for timeout or network error (common during cold start)
    if (config.retry > 0 && (message.includes('timeout') || message.includes('Network Error'))) {
        config.retry -= 1;
        const delay = 3000; // Wait 3s before retry

        console.log(`[API] Retrying request due to cold start/timeout. Attempts left: ${config.retry}`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
    }

    return Promise.reject(error);
});

export default api;
export { API_URL };
