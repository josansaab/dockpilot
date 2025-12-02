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

// ====== Storage Manager Types ======

export interface DiskInfo {
  name: string;
  path: string;
  size: string;
  sizeBytes: number;
  model: string;
  serial: string;
  type: 'disk' | 'part' | 'lvm' | 'raid';
  fstype: string | null;
  mountpoint: string | null;
  isAvailable: boolean;
  raidMember: string | null;
  zfsMember: string | null;
  children?: DiskInfo[];
}

export interface RaidArray {
  name: string;
  path: string;
  level: string;
  state: string;
  devices: string[];
  size: string;
  syncProgress?: number;
  syncAction?: string;
}

export interface ZfsPool {
  name: string;
  state: string;
  size: string;
  allocated: string;
  free: string;
  health: string;
  devices: string[];
  layout: string;
}

export type RaidLevel = 'raid0' | 'raid1' | 'raid5' | 'raid6' | 'raid10';
export type ZfsLayout = 'single' | 'mirror' | 'raidz1' | 'raidz2' | 'raidz3';

export interface CreateRaidRequest {
  name: string;
  level: RaidLevel;
  devices: string[];
  filesystem?: 'ext4' | 'xfs' | 'none';
}

export interface CreateZfsPoolRequest {
  name: string;
  layout: ZfsLayout;
  devices: string[];
}

export interface StorageTask {
  id: string;
  type: 'raid' | 'zfs';
  action: 'create' | 'sync' | 'scrub';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// Zod schemas for storage validation
export const createRaidSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid array name'),
  level: z.enum(['raid0', 'raid1', 'raid5', 'raid6', 'raid10']),
  devices: z.array(z.string().regex(/^\/dev\/(sd[a-z]+|nvme\d+n\d+|vd[a-z]+)$/, 'Invalid device path')).min(2),
  filesystem: z.enum(['ext4', 'xfs', 'none']).optional()
});

export const createZfsPoolSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid pool name'),
  layout: z.enum(['single', 'mirror', 'raidz1', 'raidz2', 'raidz3']),
  devices: z.array(z.string().regex(/^\/dev\/(sd[a-z]+|nvme\d+n\d+|vd[a-z]+)$/, 'Invalid device path')).min(1)
});
