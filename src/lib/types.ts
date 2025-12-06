/**
 * Type definitions for GitStory
 */

export interface Branch {
  name: string;
  selected: boolean;
}

export interface Screenshot {
  branch: string;
  path: string;
  timestamp: number;
}

export interface Job {
  id: string;
  status: 'initializing' | 'cloning' | 'processing' | 'creating-video' | 'complete' | 'error';
  progress: number;
  currentStep: string;
  totalBranches?: number;
  completedBranches?: number;
  screenshots?: Screenshot[];
  result?: {
    videoPath?: string;
    videoUrl?: string;
    screenshotCount?: number;
  };
  error?: string;
  createdAt: number;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface ProcessRequest {
  repositoryUrl: string;
  branches: string[];
  installCommand: string;
  runCommand: string;
  port: number;
  envVars?: Record<string, string>;
}

export interface ProcessResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface FetchEnvRequest {
  repositoryUrl: string;
}

export interface FetchEnvResponse {
  success: boolean;
  envVars?: string[];
  error?: string;
}