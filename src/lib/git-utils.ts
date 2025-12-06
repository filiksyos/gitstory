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

export interface FetchBranchesResult {
  success: boolean;
  branches?: string[];
  error?: string;
}

/**
 * Clone a GitHub repository to a temporary directory
 * @param repositoryUrl - GitHub repository URL
 * @param jobId - Unique job identifier for temp directory
 * @param githubToken - Optional GitHub Personal Access Token for private repos
 */
export async function cloneRepository(repositoryUrl: string, jobId: string, githubToken?: string): Promise<CloneRepositoryResult> {
  try {
    console.log('📦 Cloning repository:', repositoryUrl);

    // Create temp directory for this job
    const tempDir = path.join(process.cwd(), 'temp-repos', jobId);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.dirname(tempDir))) {
      fs.mkdirSync(path.dirname(tempDir), { recursive: true });
    }

    // If token is provided, modify URL to include authentication
    let cloneUrl = repositoryUrl;
    if (githubToken) {
      // Insert token into URL: https://token@github.com/owner/repo.git
      cloneUrl = repositoryUrl.replace(
        /https:\/\/(github\.com\/)/,
        `https://${githubToken}@$1`
      );
      console.log('🔑 Using GitHub token for cloning private repository');
    }

    // Clone the repository
    const git: SimpleGit = simpleGit();
    await git.clone(cloneUrl, tempDir);

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
 * Fetch branches from a GitHub repository using GitHub API
 * This doesn't require cloning the repository
 * @param repositoryUrl - GitHub repository URL
 * @param githubToken - Optional GitHub Personal Access Token for private repos and higher rate limits
 */
export async function fetchBranches(repositoryUrl: string, githubToken?: string): Promise<FetchBranchesResult> {
  try {
    console.log('🔍 Fetching branches from:', repositoryUrl);

    // Parse GitHub URL to get owner and repo
    const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;
    
    // Use GitHub API to fetch branches
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/branches`;
    
    console.log('🌐 Fetching branches from GitHub API:', apiUrl);

    // Build headers with optional authentication
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitStory'
    };

    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
      console.log('🔑 Using GitHub token for authentication');
    }

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        const errorMsg = githubToken 
          ? 'Repository not found. Make sure it exists and you have access.'
          : 'Repository not found. Make sure it exists and is public, or set GITHUB_TOKEN for private repos.';
        throw new Error(errorMsg);
      }
      if (response.status === 403) {
        const errorMsg = githubToken
          ? 'Access forbidden. Check your GitHub token permissions.'
          : 'Rate limit exceeded or repository is private. Set GITHUB_TOKEN environment variable to access private repos and increase rate limits.';
        throw new Error(errorMsg);
      }
      if (response.status === 401) {
        throw new Error('Authentication failed. Check your GITHUB_TOKEN is valid.');
      }
      throw new Error(`Failed to fetch branches: ${response.statusText}`);
    }

    const branchesData = await response.json();
    
    // Extract branch names
    const branches = branchesData.map((branch: any) => branch.name);

    console.log('✅ Found branches:', branches);

    return {
      success: true,
      branches
    };

  } catch (error: any) {
    console.error('❌ Error fetching branches:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch branches'
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