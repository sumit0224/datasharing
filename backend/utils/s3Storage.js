const { Upload } = require('@aws-sdk/lib-storage');
const { R2_BUCKET_NAME, s3Client } = require('./r2Client');
const path = require('path');

class S3Storage {
    constructor(options) {
        this.options = options || {};
    }

    _handleFile(req, file, cb) {
        const roomId = req.body.roomId || 'local-room'; // Multer parses body fields if coming before file
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);

        // Key Format: rooms/{roomId}/{timestamp}-{random}.{ext}
        const key = `rooms/${roomId}/${uniqueSuffix}${ext}`;

        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: R2_BUCKET_NAME,
                Key: key,
                Body: file.stream,
                ContentType: file.mimetype
            }
        });

        upload.done()
            .then(result => {
                cb(null, {
                    key: key,
                    bucket: R2_BUCKET_NAME,
                    location: result.Location, // R2 might not return this standardly but SDK does
                    etag: result.ETag,
                    size: result.size || file.size // Upload result might contain size? Checked: sometimes not in done()
                });
            })
            .catch(err => {
                cb(err);
            });
    }

    _removeFile(req, file, cb) {
        // Multer calls this if an error occurs later in the request (cleanup)
        const { deleteFile } = require('./r2Client');
        deleteFile(file.key).then(() => cb(null)).catch(cb);
    }
}

module.exports = (options) => new S3Storage(options);
