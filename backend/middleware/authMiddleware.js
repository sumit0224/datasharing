const { verifyAccessToken } = require('../utils/jwt');
const logger = require('../logger');

async function authMiddleware(req, res, next) {
    const token = req.cookies.accessToken;

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = {
            id: payload.sub,
            anonymousName: payload.anonymousName,
            avatarColor: payload.avatarColor,
            isGuest: false
        };
        next();
    } catch (err) {
        req.user = null;
        // We don't block here because anonymous access is allowed
        // But we might want to clear the invalid cookie
        if (err.name === 'TokenExpiredError') {
            logger.debug('Access token expired');
        } else {
            logger.warn('Invalid access token');
        }
        next();
    }
}

// Middleware for routes that REQUIRE authentication
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

module.exports = {
    authMiddleware,
    requireAuth
};
