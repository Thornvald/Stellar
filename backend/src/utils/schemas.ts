// Zod schemas for request validation and typed inputs.
import { z } from 'zod';

export const ProjectSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1)
});

export const ConfigSchema = z.object({
  projects: z.array(ProjectSchema),
  unrealEnginePath: z.string().min(1).nullable()
});

export const BuildStartSchema = z.object({
  projectPath: z.string().min(1),
  unrealEnginePath: z.string().min(1)
});

export const BuildIdParamSchema = z.object({
  id: z.string().min(1)
});

export const BuildLogsQuerySchema = z
  .object({
    from: z.string().optional()
  })
  .transform((data) => {
    const parsed = Number.parseInt(data.from ?? '0', 10);
    return {
      from: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    };
  });

export type BuildLogsQuery = z.infer<typeof BuildLogsQuerySchema>;
