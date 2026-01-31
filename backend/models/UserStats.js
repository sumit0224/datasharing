const mongoose = require('mongoose');

const userStatsSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true, index: true },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    totalSessions: { type: Number, default: 1 },
    totalTextsShared: { type: Number, default: 0 },
    totalFilesShared: { type: Number, default: 0 }
});

module.exports = mongoose.model('UserStats', userStatsSchema);
