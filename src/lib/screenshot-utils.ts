/**
 * Screenshot Utilities
 * 
 * Use Puppeteer to take screenshots of running applications
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RunAndScreenshotResult {
  success: boolean;
  screenshotPath?: string;
  error?: string;
}

/**
 * Install dependencies in the repository
 */
async function installDependencies(repoPath: string, installCommand: string): Promise<boolean> {
  try {
    console.log('📥 Installing dependencies with:', installCommand);
    
    // On Windows, use shell: true to properly resolve commands like pnpm
    const isWindows = process.platform === 'win32';
    const { stdout, stderr } = await execAsync(installCommand, {
      cwd: repoPath,
      timeout: 300000, // 5 minutes timeout
      shell: isWindows ? true : undefined // Use shell on Windows to resolve PATH
    });

    if (stderr && !stderr.includes('npm WARN') && !stderr.includes('pnpm WARN')) {
      console.log('Install stderr:', stderr);
    }

    console.log('✅ Dependencies installed');
    return true;

  } catch (error: any) {
    console.error('❌ Failed to install dependencies:', error.message);
    return false;
  }
}

/**
 * Modify run command to use specified port
 */
function modifyCommandForPort(runCommand: string, port: number): string {
  // Check if port flag already exists
  if (runCommand.includes('-p ') || runCommand.includes('--port ') || runCommand.match(/-p\d+/)) {
    return runCommand; // Already has port specified
  }
  
  // Handle npm/pnpm/yarn run commands - pass flags through with --
  if (runCommand.match(/^(npm|pnpm|yarn)\s+run\s+/)) {
    // Append -- -p ${port} to pass through to the underlying script
    return `${runCommand} -- -p ${port}`;
  }
  
  // Check if it's a direct Next.js command
  if (runCommand.includes('next dev') || runCommand.includes('next start')) {
    // Insert -p flag after 'next dev' or 'next start'
    return runCommand.replace(/(next\s+(dev|start))/, `$1 -p ${port}`);
  }
  
  // Check if it's a direct Vite command
  if (runCommand.includes('vite')) {
    return `${runCommand} --port ${port}`;
  }
  
  // For other commands, PORT env var will be set (works for React Scripts, Express, etc.)
  return runCommand;
}

/**
 * Start the application in background
 */
function startApplication(repoPath: string, runCommand: string, port: number, envVars?: Record<string, string>): any {
  const { spawn } = require('child_process');
  
  // Modify command to use the specified port
  const modifiedCommand = modifyCommandForPort(runCommand, port);
  console.log('🔧 Modified command:', modifiedCommand);
  
  const [cmd, ...args] = modifiedCommand.split(' ');
  
  // Set PORT environment variable (works for most frameworks)
  const env = { 
    ...process.env, 
    PORT: port.toString(),
    ...envVars 
  };
  
  // On Windows, use shell: true to properly resolve commands like pnpm
  const isWindows = process.platform === 'win32';
  
  const child = spawn(cmd, args, {
    cwd: repoPath,
    env,
    detached: true,
    stdio: 'ignore',
    shell: isWindows ? true : undefined // Use shell on Windows to resolve PATH
  });

  child.unref();
  
  console.log('🚀 Started application with PID:', child.pid);
  return child;
}

/**
 * Wait for URL to respond
 */
async function waitForUrl(url: string, maxRetries: number = 30, delayMs: number = 2000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok || response.status === 404) {
        return true;
      }
    } catch (error) {
      // Silently retry - we'll log at a higher level
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return false;
}

/**
 * Take screenshot using Puppeteer
 */
async function takeScreenshot(url: string, outputPath: string): Promise<boolean> {
  let browser: Browser | null = null;
  
  try {
    console.log('📸 Taking screenshot of:', url);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for any animations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take screenshot
    await page.screenshot({ path: outputPath, type: 'png' });

    console.log('✅ Screenshot saved to:', outputPath);
    return true;

  } catch (error: any) {
    console.error('❌ Error taking screenshot:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Run application and take screenshot
 */
export async function runAndScreenshot(
  repoPath: string,
  branch: string,
  installCommand: string,
  runCommand: string,
  port: number,
  jobId: string,
  envVars?: Record<string, string>
): Promise<RunAndScreenshotResult> {
  let appProcess: any = null;

  try {
    // Create .env.local if env vars provided
    if (envVars && Object.keys(envVars).length > 0) {
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n');
      
      fs.writeFileSync(path.join(repoPath, '.env.local'), envContent);
      console.log('📝 Created .env.local file');
    }

    // Install dependencies
    const installed = await installDependencies(repoPath, installCommand);
    if (!installed) {
      return {
        success: false,
        error: 'Failed to install dependencies'
      };
    }

    // Start application
    appProcess = startApplication(repoPath, runCommand, port, envVars);

    // Wait for application to be ready
    // Try the specified port first, then common alternatives
    const portsToTry = [port, 3000, 3001, 5000, 5173, 8080];
    let isReady = false;
    let actualPort = port;
    
    for (const testPort of portsToTry) {
      const url = `http://localhost:${testPort}`;
      console.log(`🔍 Trying port ${testPort}...`);
      isReady = await waitForUrl(url, 10, 2000); // Fewer retries per port since we're trying multiple
      
      if (isReady) {
        actualPort = testPort;
        console.log(`✅ Application found on port ${actualPort}`);
        break;
      }
    }
    
    if (!isReady) {
      return {
        success: false,
        error: `Application did not start on any of the tried ports: ${portsToTry.join(', ')}`
      };
    }
    
    const url = `http://localhost:${actualPort}`;

    // Prepare screenshot directory
    const screenshotDir = path.join(process.cwd(), 'screenshots', jobId);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Take screenshot
    const screenshotPath = path.join(screenshotDir, `${branch.replace(/\//g, '_')}.png`);
    const success = await takeScreenshot(url, screenshotPath);

    if (!success) {
      return {
        success: false,
        error: 'Failed to take screenshot'
      };
    }

    return {
      success: true,
      screenshotPath
    };

  } catch (error: any) {
    console.error('❌ Error in runAndScreenshot:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  } finally {
    // Kill application process
    if (appProcess && appProcess.pid) {
      try {
        process.kill(-appProcess.pid);
        console.log('🛑 Stopped application process');
      } catch (e) {
        // Process might already be dead
      }
    }
  }
}