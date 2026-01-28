const bcrypt = require('bcrypt');
const { z } = require('zod');
const User = require('../models/User');
const { signAccessToken, signRefreshToken } = require('../utils/jwt');
const { generateAnonymousName, getRandomColor } = require('../utils/identity');
const logger = require('../logger');

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None', // Required for cross-site (Vercel to Render)
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

async function register(req, res) {
    try {
        const { email, password } = registerSchema.parse(req.body);

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const anonymousName = generateAnonymousName();
        const avatarColor = getRandomColor();

        const user = new User({
            email,
            passwordHash,
            anonymousName,
            avatarColor
        });

        await user.save();

        logger.info(`New user registered: ${anonymousName}`);
        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: user._id,
                anonymousName: user.anonymousName,
                avatarColor: user.avatarColor
            }
        });
    } catch (err) {
        // 1. Zod Validation Error
        if (err instanceof z.ZodError) {
            const message = err.errors?.[0]?.message || 'Validation failed';
            return res.status(400).json({ error: message });
        }

        // 2. Mongoose Duplicate Key Error (Unique Constraint)
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue || {})[0] || 'Unknown';
            return res.status(400).json({
                error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            });
        }

        // 3. Mongoose Validation Error
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors || {}).map(val => val.message);
            return res.status(400).json({
                error: messages[0] || 'Database validation failed'
            });
        }

        // 4. Generic Server Error
        logger.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function login(req, res) {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const accessToken = signAccessToken(user);
        const refreshToken = signRefreshToken(user);

        res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', refreshToken, cookieOptions);

        logger.info(`User logged in: ${user.anonymousName}`);
        res.json({
            user: {
                id: user._id,
                anonymousName: user.anonymousName,
                avatarColor: user.avatarColor
            }
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: err.errors[0].message });
        }
        logger.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

async function logout(req, res) {
    const { maxAge, ...logoutOptions } = cookieOptions;
    res.clearCookie('accessToken', logoutOptions);
    res.clearCookie('refreshToken', logoutOptions);
    res.json({ message: 'Logged out successfully' });
}

async function me(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user: req.user });
}

async function refreshToken(req, res) {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'Refresh token missing' });

    try {
        const payload = require('../utils/jwt').verifyRefreshToken(token);
        const user = await User.findById(payload.sub);

        // Hardening: Token reuse protection
        // If the token was issued BEFORE the last refresh, it's reused/stolen -> BLOCK
        if (!user) return res.status(401).json({ error: 'User not found' });

        // Allow 1 second clock skew
        if (user.lastRefreshAt && (payload.iat * 1000) < (user.lastRefreshAt.getTime() - 1000)) {
            logger.warn(`Potential token reuse detected for user ${user._id}`);
            return res.status(403).json({ error: 'Invalid token' });
        }

        // Update refresh timestamp
        user.lastRefreshAt = new Date();
        await user.save();

        const newAccessToken = signAccessToken(user);
        const newRefreshToken = signRefreshToken(user);

        res.cookie('accessToken', newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', newRefreshToken, cookieOptions);

        res.json({ success: true });
    } catch (err) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
}

module.exports = {
    register,
    login,
    logout,
    me,
    refreshToken
};
