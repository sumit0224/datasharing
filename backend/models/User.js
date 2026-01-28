const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    anonymousName: {
        type: String,
        required: true,
        unique: true,
        immutable: true
    },
    avatarColor: {
        type: String,
        default: '#667eea'
    },
    lastLoginAt: {
        type: Date,
        default: Date.now
    },
    lastRefreshAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
