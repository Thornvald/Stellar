// Hono app factory for RPC routes.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import type {
  BuildLogsResponse,
  BuildStartResponse,
  BuildStatus,
  Config,
  EngineDetectResponse
} from '@stellar/shared';
import {
  BuildIdParamSchema,
  BuildLogsQuerySchema,
  BuildStartSchema,
  ConfigSchema
} from './utils/schemas.js';
import type { BuildManager, ConfigStore } from './services/types.js';
import { detectUnrealEngineInstalls } from './services/engineDetector.js';

export type AppServices = {
  configStore: ConfigStore;
  buildManager: BuildManager;
};

type AppBindings = {
  Variables: {
    services: AppServices;
  };
};

function registerRoutes<T extends Hono<AppBindings>>(app: T) {
  return app
    .use(
      '/api/*',
      cors({
        origin: '*',
        allowHeaders: ['Content-Type'],
        allowMethods: ['GET', 'POST', 'OPTIONS']
      })
    )
    .get('/api/health', (c) => c.json({ ok: true }))
    .get('/api/config', async (c) => {
      const services = c.get('services');
      const config = await services.configStore.load();
      return c.json<Config>(config);
    })
    .get('/api/engine/detect', async (c) => {
      try {
        const installs = await detectUnrealEngineInstalls();
        console.log(`Engine detection found ${installs.length} installation(s)`);
        return c.json<EngineDetectResponse>({ installs });
      } catch (err) {
        console.error('Engine detection error:', err);
        const message = err instanceof Error ? err.message : 'Failed to detect Unreal Engine installs.';
        return c.json({ error: message }, 500);
      }
    })
    .post('/api/config', zValidator('json', ConfigSchema), async (c) => {
      const services = c.get('services');
      const config = c.req.valid('json');
      await services.configStore.save(config);
      return c.json({ ok: true });
    })
    .post('/api/build/start', zValidator('json', BuildStartSchema), async (c) => {
      const services = c.get('services');
      try {
        const payload = c.req.valid('json');
        const result = await services.buildManager.startBuild(payload);
        return c.json<BuildStartResponse>(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start build.';
        return c.json({ error: message }, 400);
      }
    })
    .get(
      '/api/build/:id/status',
      zValidator('param', BuildIdParamSchema),
      async (c) => {
        const services = c.get('services');
        const { id } = c.req.valid('param');
        const status = services.buildManager.getStatus(id);
        if (!status) {
          return c.json({ error: 'Build not found.' }, 404);
        }
        return c.json<BuildStatus>(status);
      }
    )
    .get(
      '/api/build/:id/logs',
      zValidator('param', BuildIdParamSchema),
      zValidator('query', BuildLogsQuerySchema),
      async (c) => {
        const services = c.get('services');
        const { id } = c.req.valid('param');
        const { from } = c.req.valid('query');
        const logs = services.buildManager.getLogs(id, from);
        if (!logs) {
          return c.json({ error: 'Build not found.' }, 404);
        }
        return c.json<BuildLogsResponse>(logs);
      }
    )
    .post(
      '/api/build/:id/cancel',
      zValidator('param', BuildIdParamSchema),
      async (c) => {
        const services = c.get('services');
        const { id } = c.req.valid('param');
        const cancelled = await services.buildManager.cancelBuild(id);
        if (!cancelled) {
          return c.json({ error: 'Build not running.' }, 409);
        }
        return c.json({ ok: true });
      }
    )
    .onError((err, c) => {
      console.error('Unhandled error', err);
      return c.json({ error: 'Internal server error.' }, 500);
    });
}

const app = registerRoutes(new Hono<AppBindings>());

export function createApp(services: AppServices) {
  let instance = new Hono<AppBindings>();
  instance = instance.use('*', async (c, next) => {
    c.set('services', services);
    await next();
  });
  return registerRoutes(instance);
}

export type AppType = typeof app;
