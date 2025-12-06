'use client';

import { useState, useEffect, useRef } from 'react';
import { Job, EnvVar } from '@/lib/types';

export default function Home() {
  // Form state
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [installCommand, setInstallCommand] = useState('npm install');
  const [runCommand, setRunCommand] = useState('npm run dev');
  const [port, setPort] = useState(3000);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [showEnvVars, setShowEnvVars] = useState(false);

  // Job state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingEnv, setIsFetchingEnv] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SSE connection
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Fetch environment variables
  const handleFetchEnvVars = async () => {
    if (!repositoryUrl) {
      alert('Please enter a repository URL first');
      return;
    }

    setIsFetchingEnv(true);
    setError(null);

    try {
      const response = await fetch('/api/fetch-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryUrl })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch environment variables');
      }

      if (data.envVars && data.envVars.length > 0) {
        setEnvVars(data.envVars.map((key: string) => ({ key, value: '' })));
        setShowEnvVars(true);
      } else {
        alert('No .env.example file found in this repository');
        setShowEnvVars(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch environment variables');
    } finally {
      setIsFetchingEnv(false);
    }
  };

  // Toggle branch selection
  const toggleBranch = (branch: string) => {
    setSelectedBranches(prev => 
      prev.includes(branch) 
        ? prev.filter(b => b !== branch)
        : [...prev, branch]
    );
  };

  // Add common branches manually (user can add custom ones)
  const addBranch = (branch: string) => {
    if (branch && !availableBranches.includes(branch)) {
      setAvailableBranches(prev => [...prev, branch]);
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedBranches.length === 0) {
      alert('Please select at least one branch');
      return;
    }

    setError(null);
    setCurrentJob(null);
    setIsProcessing(true);

    try {
      const envVarsObject: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key && value) {
          envVarsObject[key] = value;
        }
      });

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryUrl,
          branches: selectedBranches,
          installCommand,
          runCommand,
          port,
          envVars: Object.keys(envVarsObject).length > 0 ? envVarsObject : undefined
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to start processing');
      }

      connectToSSE(data.jobId);

    } catch (err: any) {
      setError(err.message || 'Failed to submit job');
      setIsProcessing(false);
    }
  };

  // Connect to SSE
  const connectToSSE = (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/status/${jobId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const job = JSON.parse(event.data);
      setCurrentJob(job);

      if (job.status === 'complete' || job.status === 'error') {
        eventSource.close();
        setIsProcessing(false);

        if (job.status === 'error') {
          setError(job.error || 'An error occurred during processing');
        }
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsProcessing(false);
      setError('Lost connection to server');
    };
  };

  // Start new
  const handleStartNew = () => {
    setRepositoryUrl('');
    setAvailableBranches([]);
    setSelectedBranches([]);
    setInstallCommand('npm install');
    setRunCommand('npm run dev');
    setPort(3000);
    setEnvVars([]);
    setShowEnvVars(false);
    setCurrentJob(null);
    setError(null);
    setIsProcessing(false);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  // Update env var
  const updateEnvVar = (index: number, value: string) => {
    const newEnvVars = [...envVars];
    newEnvVars[index].value = value;
    setEnvVars(newEnvVars);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🎬 GitStory
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Create timelapse videos showing the evolution of your GitHub repositories across branches
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 sm:p-8">
          {!isProcessing && !currentJob?.result && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Repository URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GitHub Repository URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    placeholder="https://github.com/username/repository"
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleFetchEnvVars}
                    disabled={isFetchingEnv || !repositoryUrl}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors"
                  >
                    {isFetchingEnv ? 'Loading...' : 'Fetch Env'}
                  </button>
                </div>
              </div>

              {/* Branch Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Branches
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addBranch('main')}
                      className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                    >
                      + main
                    </button>
                    <button
                      type="button"
                      onClick={() => addBranch('develop')}
                      className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                    >
                      + develop
                    </button>
                    <button
                      type="button"
                      onClick={() => addBranch('staging')}
                      className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                    >
                      + staging
                    </button>
                  </div>
                  {availableBranches.length > 0 && (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 space-y-2">
                      {availableBranches.map(branch => (
                        <label key={branch} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBranches.includes(branch)}
                            onChange={() => toggleBranch(branch)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{branch}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click buttons above to add common branches, then select which ones to include
                  </p>
                </div>
              </div>

              {/* Commands */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Install Command
                  </label>
                  <input
                    type="text"
                    required
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Run Command
                  </label>
                  <input
                    type="text"
                    required
                    value={runCommand}
                    onChange={(e) => setRunCommand(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Port */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Port Number
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="65535"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Environment Variables */}
              {showEnvVars && envVars.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Environment Variables
                  </label>
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                    {envVars.map((envVar, index) => (
                      <div key={index}>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {envVar.key}
                        </label>
                        <input
                          type="text"
                          value={envVar.value}
                          onChange={(e) => updateEnvVar(index, e.target.value)}
                          placeholder={`Enter value for ${envVar.key}`}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isProcessing || selectedBranches.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-md transition-colors"
              >
                Create Timelapse Video
              </button>
            </form>
          )}

          {/* Processing State */}
          {isProcessing && currentJob && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {currentJob.currentStep}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {currentJob.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all duration-500 ease-out"
                    style={{ width: `${currentJob.progress}%` }}
                  />
                </div>
              </div>

              {currentJob.totalBranches && (
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Processing branch {currentJob.completedBranches || 0} of {currentJob.totalBranches}
                </div>
              )}

              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  This may take several minutes...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
              <button
                onClick={handleStartNew}
                className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Start New
              </button>
            </div>
          )}

          {/* Success State */}
          {currentJob?.status === 'complete' && currentJob.result && (
            <div className="space-y-6">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
                  Timelapse Video Created!
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {currentJob.result.screenshotCount} screenshots captured
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href={currentJob.result.videoUrl}
                  download
                  className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                >
                  📥 Download Timelapse Video
                </a>
                <button
                  onClick={handleStartNew}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Create Another Timelapse
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Powered by <span className="font-semibold">Puppeteer</span>, <span className="font-semibold">FFmpeg</span>, and <span className="font-semibold">Next.js</span>
          </p>
        </div>
      </div>
    </div>
  );
}