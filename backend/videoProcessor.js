const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { thumbnailsDir } = require('./storage');

function generateThumbnail(videoPath, outputFilename) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(thumbnailsDir, outputFilename);

    // Command to extract thumbnail at 00:00:01
    const command = `ffmpeg -y -i "${videoPath}" -ss 00:00:01 -vframes 1 "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.warn('FFmpeg thumbnail execution failed. Falling back to creating a dummy thumbnail.');
        const dummyGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        try {
          fs.writeFileSync(outputPath, dummyGif);
          resolve(outputFilename);
        } catch (fsErr) {
          reject(fsErr);
        }
      } else {
        resolve(outputFilename);
      }
    });
  });
}

function getVideoAspectRatio(videoPath) {
  return new Promise((resolve) => {
    const command = `ffprobe -v error -print_format json -show_streams "${videoPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.warn('ffprobe execution failed. Defaulting aspect ratio to other.');
        return resolve('other');
      }

      try {
        const info = JSON.parse(stdout);
        if (!info.streams || info.streams.length === 0) {
          return resolve('other');
        }

        const width = info.streams[0].width;
        const height = info.streams[0].height;

        if (!width || !height) {
          return resolve('other');
        }

        // Compare ratio to 16:9 and 9:16
        // Use standard tolerance to avoid floating point division mismatch issues
        const ratio = width / height;
        if (Math.abs(ratio - 16/9) < 0.05) {
          return resolve('16:9');
        } else if (Math.abs(ratio - 9/16) < 0.05) {
          return resolve('9:16');
        }
        return resolve('other');
      } catch (err) {
        return resolve('other');
      }
    });
  });
}

function processVideoForFastStart(videoPath) {
  return new Promise((resolve) => {
    const outputPath = videoPath + '.faststart.mp4';
    const command = `ffmpeg -y -i "${videoPath}" -c copy -movflags faststart -f mp4 "${outputPath}"`;

    exec(command, (error) => {
      if (error) {
        console.warn('FFmpeg faststart processing failed. Returning original video path.');
        return resolve(videoPath);
      }
      resolve(outputPath);
    });
  });
}

module.exports = {
  generateThumbnail,
  getVideoAspectRatio,
  processVideoForFastStart
};
