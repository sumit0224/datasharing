const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../logger');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    logger.error('CRITICAL: R2 environment variables missing!');
}

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
    }
});

async function getSignedDownloadUrl(key, expiresIn = 3600) {
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key
        });
        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (err) {
        logger.error(`Failed to generate signed URL for ${key}:`, err);
        return null;
    }
}

async function deleteFile(key) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key
        });
        await s3Client.send(command);
        logger.info(`🗑️ R2: Deleted object ${key}`);
        return true;
    } catch (err) {
        logger.error(`Failed to delete file ${key} from R2:`, err);
        return false;
    }
}

module.exports = {
    s3Client,
    getSignedDownloadUrl,
    deleteFile,
    R2_BUCKET_NAME
};
