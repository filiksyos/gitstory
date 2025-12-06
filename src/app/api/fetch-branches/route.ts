/**
 * Fetch Branches API
 * 
 * Fetch branches from a GitHub repository using GitHub API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchBranches } from '@/lib/git-utils';

const FetchBranchesSchema = z.object({
  repositoryUrl: z.string().min(1, 'Repository URL is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const { repositoryUrl } = FetchBranchesSchema.parse(body);

    // Get GitHub token from environment variable (optional)
    const githubToken = process.env.GITHUB_TOKEN;

    // Fetch branches
    const result = await fetchBranches(repositoryUrl, githubToken);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch branches' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      branches: result.branches || []
    });

  } catch (error: any) {
    console.error('Error in fetch-branches API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}

