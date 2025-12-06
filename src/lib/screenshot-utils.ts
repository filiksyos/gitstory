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
    
    const { stdout, stderr } = await execAsync(installCommand, {
      cwd: repoPath,
      timeout: 300000 // 5 minutes timeout
    });

    if (stderr && !stderr.includes('npm WARN')) {
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
 * Start the application in background
 */
function startApplication(repoPath: string, runCommand: string, envVars?: Record<string, string>): any {
  const { spawn } = require('child_process');
  
  const [cmd, ...args] = runCommand.split(' ');
  
  const env = { ...process.env, ...envVars };
  
  const child = spawn(cmd, args, {
    cwd: repoPath,
    env,
    detached: true,
    stdio: 'ignore'
  });

  child.unref();
  
  console.log('🚀 Started application with PID:', child.pid);
  return child;
}

/**
 * Wait for URL to respond
 */
async function waitForUrl(url: string, maxRetries: number = 30, delayMs: number = 2000): Promise<boolean> {
  console.log('🏓 Waiting for application to start at:', url);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok || response.status === 404) {
        console.log('✅ Application is responding!');
        return true;
      }
    } catch (error) {
      console.log(`Attempt ${i + 1}/${maxRetries}: Not ready yet...`);
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.error('❌ Application did not start within timeout period');
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
    await page.waitForTimeout(1000);

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
    appProcess = startApplication(repoPath, runCommand, envVars);

    // Wait for application to be ready
    const url = `http://localhost:${port}`;
    const isReady = await waitForUrl(url, 30, 2000);

    if (!isReady) {
      return {
        success: false,
        error: 'Application did not start in time'
      };
    }

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