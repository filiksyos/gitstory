/**
 * Video Utilities
 * 
 * Create timelapse videos from screenshot sequences using FFmpeg
 */

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { Screenshot } from './types';

export interface CreateTimelapseResult {
  success: boolean;
  videoPath?: string;
  error?: string;
}

/**
 * Create a timelapse video from screenshots
 */
export async function createTimelapse(
  screenshots: Screenshot[],
  jobId: string,
  fps: number = 1
): Promise<CreateTimelapseResult> {
  return new Promise((resolve) => {
    try {
      console.log('🎬 Creating timelapse video from', screenshots.length, 'screenshots');

      if (screenshots.length === 0) {
        resolve({
          success: false,
          error: 'No screenshots to create video from'
        });
        return;
      }

      // Prepare output directory
      const videoDir = path.join(process.cwd(), 'videos');
      if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
      }

      const outputPath = path.join(videoDir, `${jobId}.mp4`);

      // Create a temporary file list for ffmpeg concat
      const screenshotDir = path.dirname(screenshots[0].path);
      const listFile = path.join(screenshotDir, 'filelist.txt');
      
      // Write file list (each image shown for 1/fps seconds)
      const duration = 1 / fps;
      const fileListContent = screenshots
        .map(s => `file '${path.basename(s.path)}'\nduration ${duration}`)
        .join('\n');
      
      fs.writeFileSync(listFile, fileListContent);

      console.log('📝 Created file list for ffmpeg');

      // Create video using ffmpeg concat demuxer
      ffmpeg()
        .input(listFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r ' + fps,
          '-y'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🎥 FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing:', progress.percent ? progress.percent.toFixed(2) + '%' : 'processing...');
        })
        .on('end', () => {
          console.log('✅ Video created successfully:', outputPath);
          
          // Clean up list file
          try {
            fs.unlinkSync(listFile);
          } catch (e) {
            // Ignore cleanup errors
          }
          
          resolve({
            success: true,
            videoPath: outputPath
          });
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err.message);
          resolve({
            success: false,
            error: err.message || 'Failed to create video'
          });
        })
        .run();

    } catch (error: any) {
      console.error('❌ Error creating timelapse:', error);
      resolve({
        success: false,
        error: error.message || 'Unknown error'
      });
    }
  });
}