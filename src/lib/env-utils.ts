/**
 * Environment Variable Utilities
 * 
 * Fetch and parse .env.example files from GitHub repositories
 */

/**
 * Fetch and parse .env.example file from a GitHub repository
 */
export async function fetchEnvExample(repositoryUrl: string): Promise<string[]> {
  try {
    console.log('🔍 Fetching .env.example from:', repositoryUrl);

    // Parse GitHub URL to get owner and repo
    const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;
    
    // Construct raw.githubusercontent.com URL
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/.env.example`;
    
    console.log('🌐 Fetching from:', rawUrl);

    // Fetch the file
    const response = await fetch(rawUrl);
    
    if (response.status === 404) {
      // Try 'master' branch as fallback
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/.env.example`;
      const masterResponse = await fetch(masterUrl);
      
      if (masterResponse.status === 404) {
        console.log('ℹ️ No .env.example file found in repository');
        return [];
      }
      
      const content = await masterResponse.text();
      return parseEnvFile(content);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch .env.example: ${response.statusText}`);
    }

    const content = await response.text();
    return parseEnvFile(content);

  } catch (error: any) {
    console.error('❌ Error fetching .env.example:', error);
    return [];
  }
}

/**
 * Parse .env file content and extract variable names
 */
function parseEnvFile(content: string): string[] {
  const lines = content.split('\n');
  const envVars: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Extract variable name (before = sign)
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/i);
    if (match) {
      envVars.push(match[1]);
    }
  }

  console.log('✅ Found environment variables:', envVars);
  return envVars;
}