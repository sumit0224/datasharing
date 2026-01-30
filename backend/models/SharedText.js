const mongoose = require('mongoose');

const SenderSchema = new mongoose.Schema({
    id: String,
    name: String,
    avatarColor: String,
    isGuest: Boolean
}, { _id: false });

const SharedTextSchema = new mongoose.Schema({
    roomId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    sender: SenderSchema,
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

module.exports = mongoose.model('SharedText', SharedTextSchema);
