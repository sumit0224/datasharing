const mongoose = require('mongoose');

const PushTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
    },
    deviceId: {
        type: String,
        required: true,
    },
    lastUsed: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('PushToken', PushTokenSchema);
