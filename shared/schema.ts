import { z } from "zod";

// User types
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

export interface InsertUser {
  id: string;
  username: string;
  passwordHash: string;
}

// Session types
export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface InsertSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

// Installed App types
export interface InstalledApp {
  id: string;
  name: string;
  image: string;
  icon?: string | null;
  category?: string | null;
  description?: string | null;
  containerId?: string | null;
  status: string;
  ports?: { container: number; host: number }[] | null;
  environment?: Record<string, string> | null;
  volumes?: { host: string; container: string }[] | null;
  dockerConfig?: Record<string, any> | null;
  installedAt: Date;
}

export interface InsertInstalledApp {
  id?: string;
  name: string;
  image: string;
  icon?: string | null;
  category?: string | null;
  description?: string | null;
  containerId?: string | null;
  status?: string;
  ports?: { container: number; host: number }[] | null;
  environment?: Record<string, string> | null;
  volumes?: { host: string; container: string }[] | null;
  dockerConfig?: Record<string, any> | null;
}

// Settings types
export interface Settings {
  id: string;
  serverName: string;
  webPort: number;
  dataPath: string;
  startOnBoot: boolean;
  autoUpdate: boolean;
  autoPrune: boolean;
  analytics: boolean;
  updatedAt: Date;
}

export interface InsertSettings {
  id?: string;
  serverName?: string;
  webPort?: number;
  dataPath?: string;
  startOnBoot?: boolean;
  autoUpdate?: boolean;
  autoPrune?: boolean;
  analytics?: boolean;
}

// Zod schemas for validation
export const insertUserSchema = z.object({
  id: z.string(),
  username: z.string().min(1),
  passwordHash: z.string()
});

export const insertSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.date()
});

export const insertInstalledAppSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  image: z.string().min(1),
  icon: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  containerId: z.string().nullable().optional(),
  status: z.string().optional(),
  ports: z.array(z.object({
    container: z.number(),
    host: z.number()
  })).nullable().optional(),
  environment: z.record(z.string()).nullable().optional(),
  volumes: z.array(z.object({
    host: z.string(),
    container: z.string()
  })).nullable().optional(),
  dockerConfig: z.record(z.any()).nullable().optional()
});

export const insertSettingsSchema = z.object({
  id: z.string().optional(),
  serverName: z.string().optional(),
  webPort: z.number().optional(),
  dataPath: z.string().optional(),
  startOnBoot: z.boolean().optional(),
  autoUpdate: z.boolean().optional(),
  autoPrune: z.boolean().optional(),
  analytics: z.boolean().optional()
});
