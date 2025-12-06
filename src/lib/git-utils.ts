/**
 * Git Utilities
 * 
 * Clone repositories and manage branches using simple-git
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

export interface CloneRepositoryResult {
  success: boolean;
  repoPath?: string;
  branches?: string[];
  error?: string;
}

export interface CheckoutBranchResult {
  success: boolean;
  branch?: string;
  error?: string;
}

/**
 * Clone a GitHub repository to a temporary directory
 */
export async function cloneRepository(repositoryUrl: string, jobId: string): Promise<CloneRepositoryResult> {
  try {
    console.log('📦 Cloning repository:', repositoryUrl);

    // Create temp directory for this job
    const tempDir = path.join(process.cwd(), 'temp-repos', jobId);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.dirname(tempDir))) {
      fs.mkdirSync(path.dirname(tempDir), { recursive: true });
    }

    // Clone the repository
    const git: SimpleGit = simpleGit();
    await git.clone(repositoryUrl, tempDir);

    console.log('✅ Repository cloned to:', tempDir);

    // Get all branches
    const gitRepo: SimpleGit = simpleGit(tempDir);
    const branchSummary = await gitRepo.branch(['-r']);
    
    // Extract branch names (remove 'origin/' prefix)
    const branches = branchSummary.all
      .filter(b => b.startsWith('origin/'))
      .map(b => b.replace('origin/', ''))
      .filter(b => b !== 'HEAD');

    console.log('✅ Found branches:', branches);

    return {
      success: true,
      repoPath: tempDir,
      branches
    };

  } catch (error: any) {
    console.error('❌ Error cloning repository:', error);
    return {
      success: false,
      error: error.message || 'Failed to clone repository'
    };
  }
}

/**
 * Checkout a specific branch
 */
export async function checkoutBranch(repoPath: string, branchName: string): Promise<CheckoutBranchResult> {
  try {
    console.log('🔀 Checking out branch:', branchName);

    const git: SimpleGit = simpleGit(repoPath);
    
    // Checkout the branch
    await git.checkout(branchName);

    console.log('✅ Checked out branch:', branchName);

    return {
      success: true,
      branch: branchName
    };

  } catch (error: any) {
    console.error('❌ Error checking out branch:', error);
    return {
      success: false,
      error: error.message || 'Failed to checkout branch'
    };
  }
}

/**
 * Clean up temporary repository directory
 */
export async function cleanupRepository(repoPath: string): Promise<void> {
  try {
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
      console.log('🗑️ Cleaned up repository:', repoPath);
    }
  } catch (error) {
    console.error('⚠️ Error cleaning up repository:', error);
  }
}