/**
 * Job Manager
 * 
 * In-memory job state management with auto-cleanup
 */

import { Job } from './types';

// In-memory job storage
const jobs = new Map<string, Job>();

// Auto-cleanup jobs after 1 hour
const CLEANUP_TIMEOUT = 60 * 60 * 1000;

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new job
 */
export function createJob(): Job {
  const jobId = generateJobId();
  const job: Job = {
    id: jobId,
    status: 'initializing',
    progress: 0,
    currentStep: 'Initializing...',
    createdAt: Date.now(),
    screenshots: []
  };

  jobs.set(jobId, job);

  // Schedule auto-cleanup
  setTimeout(() => {
    jobs.delete(jobId);
    console.log(`Cleaned up job ${jobId}`);
  }, CLEANUP_TIMEOUT);

  return job;
}

/**
 * Update an existing job
 */
export function updateJob(jobId: string, updates: Partial<Job>): Job | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }

  const updatedJob = { ...job, ...updates };
  jobs.set(jobId, updatedJob);
  return updatedJob;
}

/**
 * Get a job by ID
 */
export function getJob(jobId: string): Job | null {
  return jobs.get(jobId) || null;
}

/**
 * Delete a job
 */
export function deleteJob(jobId: string): boolean {
  return jobs.delete(jobId);
}