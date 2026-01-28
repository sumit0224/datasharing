require('dotenv').config();
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_ACCOUNT_ID) {
    console.error('❌ R2_ACCOUNT_ID missing');
    process.exit(1);
}

console.log(`🔑 Account ID: ${R2_ACCOUNT_ID}`);
console.log(`🔑 Access Key: ${R2_ACCESS_KEY_ID ? R2_ACCESS_KEY_ID.substring(0, 4) + '...' : 'MISSING'}`);
console.log(`🔑 Secret Key: ${R2_SECRET_ACCESS_KEY ? R2_SECRET_ACCESS_KEY.substring(0, 4) + '...' : 'MISSING'}`);
console.log(`🪣 Bucket: ${process.env.R2_BUCKET_NAME}`);

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
    }
});

async function testConnection() {
    try {
        console.log(`📡 Connecting to Cloudflare R2 Bucket: ${process.env.R2_BUCKET_NAME}...`);

        // Try listing objects in the SPECIFIC bucket
        // This works even if the token is scoped to just this bucket (ListBuckets requires account-level perm)
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const command = new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME,
            MaxKeys: 1
        });

        await s3Client.send(command);
        console.log('✅ Connection Successful! (Bucket access confirmed)');
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        if (err.name === 'InvalidAccessKeyId') console.error('   -> Check ACCESS_KEY_ID');
        if (err.name === 'SignatureDoesNotMatch') console.error('   -> Check SECRET_ACCESS_KEY');
        if (err.statusCode === 403) console.error('   -> Token likely missing "Object Read/Write" or bucket permissions');
        if (err.statusCode === 404) console.error('   -> Bucket name might be wrong');
    }
}

testConnection();
