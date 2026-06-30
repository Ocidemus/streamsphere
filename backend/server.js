require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { User, Video } = require('./models');
const { upload, uploadToS3, s3Enabled } = require('./storage');
const { generateThumbnail, getVideoAspectRatio, processVideoForFastStart } = require('./videoProcessor');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'streamsphere_super_secret_key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamsphere';

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static upload folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Ensure MongoDB is running locally or via Docker.');
  });

// --- Authentication Routes ---

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    user = new User({ username, email, password });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    await user.save();

    const payload = { user: { id: user.id } };
    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

    const payload = { user: { id: user.id } };
    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get User Detail
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// --- Video Routes ---

// Upload Video
app.post('/api/videos/upload', auth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a video file' });
    }

    const { title, description } = req.body;
    let localVideoPath = req.file.path;

    // 1. Detect aspect ratio using ffprobe
    const aspectRatio = await getVideoAspectRatio(localVideoPath);
    console.log(`Detected video aspect ratio: ${aspectRatio}`);

    // 2. Perform faststart encoding using ffmpeg
    console.log('Optimizing video encoding for Web Streaming (FastStart)...');
    const optimizedVideoPath = await processVideoForFastStart(localVideoPath);
    
    // If optimized successfully, replace local video path and delete old unoptimized file
    if (optimizedVideoPath !== localVideoPath) {
      try {
        fs.unlinkSync(localVideoPath); // Remove original unoptimized file
      } catch (err) {
        console.warn('Could not clean up original file:', err.message);
      }
      localVideoPath = optimizedVideoPath;
    }

    const videoFilename = path.basename(localVideoPath);
    let videoUrl = `/uploads/videos/${videoFilename}`;
    const thumbnailFilename = `thumb-${Date.now()}.jpg`;

    // 3. Generate Thumbnail locally using FFmpeg
    let thumbnailUrl = '';
    try {
      await generateThumbnail(localVideoPath, thumbnailFilename);
      thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
    } catch (ffmpegErr) {
      console.error('Error generating thumbnail:', ffmpegErr);
    }

    // 4. Upload to S3 (and use CloudFront mapping if configured)
    if (s3Enabled) {
      try {
        console.log('Uploading optimized video to AWS S3 / CloudFront...');
        const s3VideoUrl = await uploadToS3(localVideoPath, `videos/${videoFilename}`);
        if (s3VideoUrl) {
          videoUrl = s3VideoUrl;
          // Delete local file to save disk space when S3 is enabled
          try { fs.unlinkSync(localVideoPath); } catch (e) {}
        }

        if (thumbnailUrl) {
          console.log('Uploading thumbnail to AWS S3 / CloudFront...');
          const localThumbPath = path.join(__dirname, 'uploads', 'thumbnails', thumbnailFilename);
          const s3ThumbUrl = await uploadToS3(localThumbPath, `thumbnails/${thumbnailFilename}`);
          if (s3ThumbUrl) {
            thumbnailUrl = s3ThumbUrl;
            // Clean up local thumbnail
            try { fs.unlinkSync(localThumbPath); } catch (e) {}
          }
        }
      } catch (s3Err) {
        console.error('Failed to upload files to AWS S3, keeping local storage links:', s3Err);
      }
    }

    const newVideo = new Video({
      title: title || 'Untitled Video',
      description: description || '',
      videoUrl,
      thumbnailUrl,
      aspectRatio,
      uploader: req.user.id
    });

    const savedVideo = await newVideo.save();
    res.status(201).json(savedVideo);
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ message: 'Video upload failed' });
  }
});

// List and Search Videos
app.get('/api/videos', async (req, res) => {
  try {
    const search = req.query.search || '';
    const query = search 
      ? { $or: [{ title: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }] }
      : {};

    const videos = await Video.find(query)
      .populate('uploader', 'username')
      .sort({ createdAt: -1 });

    res.json(videos);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get Video details and stream metadata (Optionally increment views)
app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('uploader', 'username');
    if (!video) return res.status(404).json({ message: 'Video not found' });
    
    // Increment view
    video.views += 1;
    // Add dummy watch time for testing
    video.watchTime += Math.floor(Math.random() * 30) + 10;
    await video.save();

    res.json(video);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- Analytics Dashboard ---
app.get('/api/analytics', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userVideos = await Video.find({ uploader: userId });

    const totalUploads = userVideos.length;
    const totalViews = userVideos.reduce((sum, v) => sum + v.views, 0);
    const totalWatchTime = userVideos.reduce((sum, v) => sum + v.watchTime, 0);

    // Get overall system analytics too for side panel comparison
    const allVideos = await Video.find({});
    const globalUploads = allVideos.length;
    const globalViews = allVideos.reduce((sum, v) => sum + v.views, 0);

    res.json({
      personal: {
        totalUploads,
        totalViews,
        totalWatchTime
      },
      global: {
        globalUploads,
        globalViews
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`StreamSphere Backend running on port ${PORT}`);
});
