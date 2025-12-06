/**
 * Download API Route
 * 
 * Download the generated timelapse video
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/job-manager';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    // Get job
    const job = getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'complete' || !job.result?.videoPath) {
      return NextResponse.json(
        { error: 'Video not ready yet' },
        { status: 400 }
      );
    }

    const videoPath = job.result.videoPath;

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return NextResponse.json(
        { error: 'Video file not found' },
        { status: 404 }
      );
    }

    // Read file
    const videoBuffer = fs.readFileSync(videoPath);
    const fileName = `gitstory-${jobId}.mp4`;

    // Return video file
    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': videoBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('Error downloading video:', error);
    return NextResponse.json(
      { error: 'Failed to download video' },
      { status: 500 }
    );
  }
}