/**
 * Fetch Environment Variables API
 * 
 * Fetch .env.example from a GitHub repository
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchEnvExample } from '@/lib/env-utils';

const FetchEnvSchema = z.object({
  repositoryUrl: z.string().min(1, 'Repository URL is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const { repositoryUrl } = FetchEnvSchema.parse(body);

    // Fetch environment variables
    const envVars = await fetchEnvExample(repositoryUrl);

    return NextResponse.json({
      success: true,
      envVars
    });

  } catch (error: any) {
    console.error('Error in fetch-env API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch environment variables' },
      { status: 500 }
    );
  }
}