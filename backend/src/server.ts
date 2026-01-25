// Node entry point for the Hono backend server.
import { serve } from '@hono/node-server';
import { createServer } from 'node:net';
import { createApp } from './app.js';
import { createBuildManager } from './services/buildManager.js';
import { createConfigStore } from './services/configStore.js';

const RPC_HOST = '127.0.0.1';
const RPC_PORT = 42800;

const configStore = createConfigStore();
const buildManager = createBuildManager();
const app = createApp({ configStore, buildManager });

const port = Number.parseInt(process.env.STELLAR_RPC_PORT ?? String(RPC_PORT), 10) || RPC_PORT;
const hostname = process.env.STELLAR_RPC_HOST ?? RPC_HOST;

async function isPortAvailable(host: string, portNum: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(portNum, host);
  });
}

async function waitForPort(host: string, portNum: number, maxAttempts = 10, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortAvailable(host, portNum)) {
      return true;
    }
    console.log(`Port ${portNum} in use, waiting... (attempt ${i + 1}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function startServer() {
  const portAvailable = await waitForPort(hostname, port);

  if (!portAvailable) {
    console.error(`Port ${port} is still in use after waiting. Exiting.`);
    process.exit(1);
  }

  const server = serve({
    fetch: app.fetch,
    port,
    hostname
  });

  console.log(`Stellar backend listening on http://${hostname}:${port}`);

  const shutdown = () => {
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
