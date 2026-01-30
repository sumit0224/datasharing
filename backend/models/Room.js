const mongoose = require('mongoose');

const SenderSchema = new mongoose.Schema({
    id: String,
    name: String,
    avatarColor: String,
    isGuest: Boolean
}, { _id: false });

const FileSchema = new mongoose.Schema({
    id: String,
    originalName: String,
    key: String,
    size: Number,
    mimetype: String,
    uploadedAt: Date,
    downloadUrl: String,
    sender: SenderSchema,
    expiresAt: Date  // Track file expiry time (2 minutes from upload)
}, { _id: false });

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true, index: true },
    type: { type: String, default: 'public' },
    passwordHash: String,
    files: [FileSchema],
    expiresAt: { type: Date, expires: 0 }, // Room TTL index
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', RoomSchema);
