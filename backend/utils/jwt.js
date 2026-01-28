const jwt = require('jsonwebtoken');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

function signAccessToken(user) {
    return jwt.sign(
        {
            sub: user._id,
            anonymousName: user.anonymousName,
            avatarColor: user.avatarColor
        },
        JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
    );
}

function signRefreshToken(user) {
    return jwt.sign(
        { sub: user._id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
    return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};
