/**
 * Status API Route (Server-Sent Events)
 * 
 * Stream real-time job status updates to the client
 */

import { NextRequest } from 'next/server';
import { getJob } from '@/lib/job-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      let isClosed = false;
      
      const closeController = () => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch (error) {
            // Controller might already be closed, ignore
          }
        }
      };

      // Poll for job updates every 500ms
      const interval = setInterval(() => {
        const job = getJob(jobId);
        
        if (!job) {
          sendEvent({ error: 'Job not found' });
          clearInterval(interval);
          closeController();
          return;
        }

        // Send job status
        sendEvent(job);

        // Close connection if job is complete or errored
        if (job.status === 'complete' || job.status === 'error') {
          clearInterval(interval);
          setTimeout(() => {
            closeController();
          }, 1000);
        }
      }, 500);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        closeController();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}