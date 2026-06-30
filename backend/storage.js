const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Ensure uploads directories exist
const uploadDir = path.join(__dirname, 'uploads');
const videosDir = path.join(uploadDir, 'videos');
const thumbnailsDir = path.join(uploadDir, 'thumbnails');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir);
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir);

// Initialize S3 Client if credentials are provided
const s3Enabled = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET;
let s3Client = null;

if (s3Enabled) {
  const s3Config = {
    region: process.env.AWS_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  };

  // Support Cloudflare R2 or other S3-compatible storage providers via custom endpoint URL
  if (process.env.AWS_ENDPOINT_URL) {
    s3Config.endpoint = process.env.AWS_ENDPOINT_URL;
  }

  s3Client = new S3Client(s3Config);
  console.log('Object Storage Client Integration Enabled.');
} else {
  console.log('Storage credentials not found. Using local filesystem storage.');
}

// Function to upload a local file to S3
async function uploadToS3(localFilePath, s3Key) {
  if (!s3Enabled) return null;

  const fileStream = fs.createReadStream(localFilePath);
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
    Body: fileStream,
    ContentType: s3Key.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4'
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));
    // If CloudFront or Cloudflare R2 Public URL Prefix is configured, rewrite URL
    const publicUrlPrefix = process.env.PUBLIC_URL_PREFIX || process.env.CLOUDFRONT_URL;
    if (publicUrlPrefix) {
      const basePrefix = publicUrlPrefix.endsWith('/') ? publicUrlPrefix.slice(0, -1) : publicUrlPrefix;
      return `${basePrefix}/${s3Key}`;
    }
    // Return the public S3 URL
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
  } catch (err) {
    console.error('AWS S3 Upload Error:', err);
    throw err;
  }
}

// Configure multer disk storage for video files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videosDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /mp4|mkv|avi|mov|wmv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only videos are allowed!'));
    }
  }
});

module.exports = {
  upload,
  uploadToS3,
  s3Enabled,
  videosDir,
  thumbnailsDir
};
