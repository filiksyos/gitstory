/**
 * Process API Route
 * 
 * Main endpoint that orchestrates:
 * 1. Clone repository
 * 2. For each branch: checkout -> install -> run -> screenshot
 * 3. Create timelapse video
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createJob, updateJob } from '@/lib/job-manager';
import { cloneRepository, checkoutBranch, cleanupRepository } from '@/lib/git-utils';
import { runAndScreenshot } from '@/lib/screenshot-utils';
import { createTimelapse } from '@/lib/video-utils';
import { Screenshot } from '@/lib/types';

const ProcessSchema = z.object({
  repositoryUrl: z.string().min(1, 'Repository URL is required'),
  branches: z.array(z.string()).min(1, 'At least one branch is required'),
  installCommand: z.string().min(1, 'Install command is required'),
  runCommand: z.string().min(1, 'Run command is required'),
  port: z.number().min(1).max(65535),
  envVars: z.record(z.string(), z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validatedData = ProcessSchema.parse(body);
    const { repositoryUrl, branches, installCommand, runCommand, port, envVars } = validatedData;

    // Create job
    const job = createJob();
    console.log('📋 Created job:', job.id);

    // Start async processing
    processRepository(job.id, repositoryUrl, branches, installCommand, runCommand, port, envVars);

    // Return job ID immediately
    return NextResponse.json({
      success: true,
      jobId: job.id
    });

  } catch (error: any) {
    console.error('Error in process API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start processing' },
      { status: 500 }
    );
  }
}

/**
 * Process repository asynchronously
 */
async function processRepository(
  jobId: string,
  repositoryUrl: string,
  branches: string[],
  installCommand: string,
  runCommand: string,
  port: number,
  envVars?: Record<string, string>
) {
  let repoPath: string | undefined;

  try {
    // Update: Cloning
    updateJob(jobId, {
      status: 'cloning',
      progress: 10,
      currentStep: 'Cloning repository...',
      totalBranches: branches.length,
      completedBranches: 0
    });

    // Clone repository
    const cloneResult = await cloneRepository(repositoryUrl, jobId);
    if (!cloneResult.success || !cloneResult.repoPath) {
      throw new Error(cloneResult.error || 'Failed to clone repository');
    }

    repoPath = cloneResult.repoPath;

    // Update: Processing branches
    updateJob(jobId, {
      status: 'processing',
      progress: 20,
      currentStep: `Processing ${branches.length} branches...`
    });

    const screenshots: Screenshot[] = [];
    const progressPerBranch = 60 / branches.length;

    // Process each branch
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      
      updateJob(jobId, {
        currentStep: `Processing branch ${i + 1}/${branches.length}: ${branch}`,
        progress: 20 + (i * progressPerBranch),
        completedBranches: i
      });

      // Checkout branch
      const checkoutResult = await checkoutBranch(repoPath, branch);
      if (!checkoutResult.success) {
        console.warn(`⚠️ Failed to checkout branch ${branch}, skipping...`);
        continue;
      }

      // Run and screenshot
      const screenshotResult = await runAndScreenshot(
        repoPath,
        branch,
        installCommand,
        runCommand,
        port,
        jobId,
        envVars
      );

      if (screenshotResult.success && screenshotResult.screenshotPath) {
        screenshots.push({
          branch,
          path: screenshotResult.screenshotPath,
          timestamp: Date.now()
        });
      } else {
        console.warn(`⚠️ Failed to screenshot branch ${branch}:`, screenshotResult.error);
      }
    }

    if (screenshots.length === 0) {
      throw new Error('No screenshots were captured successfully');
    }

    // Update: Creating video
    updateJob(jobId, {
      status: 'creating-video',
      progress: 80,
      currentStep: 'Creating timelapse video...',
      completedBranches: branches.length,
      screenshots
    });

    // Create timelapse video
    const videoResult = await createTimelapse(screenshots, jobId, 1);
    if (!videoResult.success || !videoResult.videoPath) {
      throw new Error(videoResult.error || 'Failed to create video');
    }

    // Update: Complete
    updateJob(jobId, {
      status: 'complete',
      progress: 100,
      currentStep: 'Timelapse video created successfully!',
      result: {
        videoPath: videoResult.videoPath,
        videoUrl: `/api/download/${jobId}`,
        screenshotCount: screenshots.length
      }
    });

    console.log('✅ Job completed successfully:', jobId);

  } catch (error: any) {
    console.error('❌ Error processing repository:', error);
    
    updateJob(jobId, {
      status: 'error',
      error: error.message || 'An unknown error occurred',
      currentStep: 'Error occurred'
    });
  } finally {
    // Cleanup repository
    if (repoPath) {
      setTimeout(() => {
        cleanupRepository(repoPath!);
      }, 5000); // Give some time for any pending operations
    }
  }
}