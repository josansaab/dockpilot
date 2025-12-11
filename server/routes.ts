import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertInstalledAppSchema, insertSettingsSchema, createRaidSchema, createZfsPoolSchema } from "@shared/schema";
import * as docker from "./docker";
import * as systemMetrics from "./systemMetrics";
import * as storageManager from "./storageManager";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { execSync } from "child_process";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string };
      sessionId?: string;
    }
  }
}

// Generate random session ID
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Authentication middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const session = await storage.getSession(sessionId);
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (session) {
      await storage.deleteSession(sessionId);
    }
    return res.status(401).json({ error: "Session expired" });
  }

  const user = await storage.getUserById(session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = { id: user.id, username: user.username };
  req.sessionId = sessionId;
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup cookie parser
  app.use(cookieParser());

  // ====== Auth Routes (Public) ======

  // Check session status
  app.get("/api/auth/session", async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      
      // If no users exist, setup is required
      if (userCount === 0) {
        return res.json({ authenticated: false, setupRequired: true });
      }

      const sessionId = req.cookies?.sessionId;
      if (!sessionId) {
        return res.json({ authenticated: false, setupRequired: false });
      }

      const session = await storage.getSession(sessionId);
      if (!session || new Date(session.expiresAt) < new Date()) {
        if (session) {
          await storage.deleteSession(sessionId);
        }
        res.clearCookie('sessionId', { path: '/' });
        return res.json({ authenticated: false, setupRequired: false });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.json({ authenticated: false, setupRequired: false });
      }

      res.json({ 
        authenticated: true, 
        setupRequired: false,
        user: { id: user.id, username: user.username }
      });
    } catch (error) {
      console.error('Session check error:', error);
      res.status(500).json({ error: "Failed to check session" });
    }
  });

  // Setup first user (only works when no users exist)
  app.post("/api/auth/setup", async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      if (userCount > 0) {
        return res.status(400).json({ error: "Setup already completed" });
      }

      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      
      await storage.createUser({
        id: userId,
        username,
        passwordHash
      });

      // Create session
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await storage.createSession({
        id: sessionId,
        userId,
        expiresAt
      });

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      res.json({ success: true, user: { id: userId, username } });
    } catch (error) {
      console.error('Setup error:', error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Create new session
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await storage.createSession({
        id: sessionId,
        userId: user.id,
        expiresAt
      });

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const sessionId = req.cookies?.sessionId;
      if (sessionId) {
        await storage.deleteSession(sessionId);
      }
      res.clearCookie('sessionId', { path: '/' });
      res.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Health check & Docker status (public for install script verification)
  app.get("/api/health", async (req, res) => {
    const dockerAvailable = await docker.isDockerAvailable();
    res.json({ 
      status: "ok", 
      dockerAvailable,
      timestamp: new Date().toISOString() 
    });
  });

  // ====== Docker Container Routes (Protected) ======
  
  // List all containers
  app.get("/api/containers", requireAuth, async (req, res) => {
    try {
      const dockerAvailable = await docker.isDockerAvailable();
      if (!dockerAvailable) {
        return res.json([]); // Return empty if Docker not available
      }
      const containers = await docker.listContainers(true);
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to list containers" });
    }
  });

  // Start a container
  app.post("/api/containers/:id/start", requireAuth, async (req, res) => {
    try {
      await docker.startContainer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to start container" });
    }
  });

  // Stop a container
  app.post("/api/containers/:id/stop", requireAuth, async (req, res) => {
    try {
      await docker.stopContainer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop container" });
    }
  });

  // Remove a container
  app.delete("/api/containers/:id", requireAuth, async (req, res) => {
    try {
      await docker.removeContainer(req.params.id, true);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove container" });
    }
  });

  // Get container logs
  app.get("/api/containers/:id/logs", requireAuth, async (req, res) => {
    try {
      const logs = await docker.getContainerLogs(req.params.id);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  // Execute command in container
  app.post("/api/containers/:id/exec", requireAuth, async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }
      
      const output = await docker.execInContainer(req.params.id, command);
      res.json({ output });
    } catch (error: any) {
      console.error('Exec error:', error);
      res.status(500).json({ error: error.message || "Failed to execute command" });
    }
  });

  // ====== Docker Image Routes (Protected) ======

  // List all images
  app.get("/api/images", requireAuth, async (req, res) => {
    try {
      const dockerAvailable = await docker.isDockerAvailable();
      if (!dockerAvailable) {
        return res.json([]);
      }
      const images = await docker.listImages();
      res.json(images);
    } catch (error) {
      res.status(500).json({ error: "Failed to list images" });
    }
  });

  // Pull an image
  app.post("/api/images/pull", requireAuth, async (req, res) => {
    try {
      const { imageName } = req.body;
      if (!imageName) {
        return res.status(400).json({ error: "Image name is required" });
      }
      await docker.pullImage(imageName);
      res.json({ success: true, message: `Successfully pulled ${imageName}` });
    } catch (error) {
      res.status(500).json({ error: "Failed to pull image" });
    }
  });

  // Remove an image
  app.delete("/api/images/:id", requireAuth, async (req, res) => {
    try {
      await docker.removeImage(req.params.id, true);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove image" });
    }
  });

  // ====== Installed Apps Routes (Protected) ======

  // Get all installed apps
  app.get("/api/apps", requireAuth, async (req, res) => {
    try {
      const apps = await storage.getInstalledApps();
      res.json(apps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch apps" });
    }
  });

  // Install a new app
  app.post("/api/apps", requireAuth, async (req, res) => {
    try {
      console.log('Install request body:', JSON.stringify(req.body));
      const parsed = insertInstalledAppSchema.parse(req.body);
      console.log('Parsed app:', parsed.name);
      
      const dockerAvailable = await docker.isDockerAvailable();
      console.log('Docker available:', dockerAvailable);
      
      let containerId: string | null = null;
      let status = 'stopped';
      
      if (dockerAvailable) {
        // Pull the image and create container if Docker is available
        console.log('Pulling image:', parsed.image);
        await docker.pullImage(parsed.image);
        containerId = await docker.createAndStartContainer(
          parsed.image,
          parsed.name,
          (parsed.ports || []) as { container: number; host: number }[],
          parsed.environment || {},
          parsed.volumes || []
        );
        status = 'running';
      }
      
      // Save to database (works even without Docker for demo purposes)
      console.log('Saving app to database...');
      const app = await storage.createInstalledApp({
        ...parsed,
        containerId,
        status
      });
      
      console.log('App saved successfully:', app.id);
      res.json(app);
    } catch (error: any) {
      console.error('Install error:', error.message || error);
      if (error.errors) {
        console.error('Validation errors:', JSON.stringify(error.errors));
      }
      res.status(500).json({ error: error.message || "Failed to install app" });
    }
  });

  // Update app status
  app.patch("/api/apps/:id", requireAuth, async (req, res) => {
    try {
      const app = await storage.updateInstalledApp(req.params.id, req.body);
      res.json(app);
    } catch (error) {
      res.status(500).json({ error: "Failed to update app" });
    }
  });

  // Uninstall an app
  app.delete("/api/apps/:id", requireAuth, async (req, res) => {
    try {
      const app = await storage.getInstalledApp(req.params.id);
      if (!app) {
        return res.status(404).json({ error: "App not found" });
      }
      
      // Remove the container if it exists
      if (app.containerId) {
        try {
          await docker.removeContainer(app.containerId, true);
        } catch (err) {
          console.error('Container removal failed:', err);
        }
      }
      
      // Remove from database
      await storage.deleteInstalledApp(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to uninstall app" });
    }
  });

  // ====== Settings Routes (Protected) ======

  // Get settings
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Update settings
  app.patch("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ====== System Stats Routes (Protected) ======

  // Get system stats (CPU, memory, disk, network)
  app.get("/api/system/stats", requireAuth, async (req, res) => {
    try {
      const stats = await systemMetrics.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error('Stats error:', error);
      res.json({ cpu: 0, memory: 0, memTotal: 0, memUsed: 0, disk: 0, diskTotal: '0 GB', diskUsed: '0 GB', uptime: '--', network: [], dockerReady: false, dockerStatus: 'Error' });
    }
  });

  // Get storage info (disks, block devices, ZFS, volumes)
  app.get("/api/system/storage", requireAuth, async (req, res) => {
    try {
      const storage = await systemMetrics.getStorageInfo();
      res.json(storage);
    } catch (error) {
      console.error('Storage error:', error);
      res.json({ disks: [], blockDevices: [], zfs: [], volumes: [] });
    }
  });

  // Docker system prune
  app.post("/api/system/prune", requireAuth, async (req, res) => {
    try {
      let spaceReclaimed = '0 bytes';
      try {
        const output = execSync('docker system prune -af 2>/dev/null || echo "0"', { encoding: 'utf8' });
        const match = output.match(/reclaimed\s+([\d.]+\s*\w+)/i);
        if (match) spaceReclaimed = match[1];
      } catch (e) { spaceReclaimed = 'Unknown'; }
      res.json({ success: true, spaceReclaimed });
    } catch (error) {
      res.status(500).json({ error: 'Failed to prune' });
    }
  });

  // ZFS Snapshot
  app.post("/api/system/zfs/snapshot", requireAuth, (req, res) => {
    try {
      const { dataset } = req.body;
      if (!dataset || !/^[\w\/-]+$/.test(dataset)) {
        return res.status(400).json({ error: 'Invalid dataset name' });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const snapshot = `${dataset}@dockpilot-${timestamp}`;
      try {
        execSync(`zfs snapshot ${snapshot}`, { encoding: 'utf8' });
        res.json({ success: true, snapshot });
      } catch (e: any) {
        res.json({ success: false, error: e.message || 'Failed to create snapshot' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to create snapshot' });
    }
  });

  // ====== Storage Manager Routes (Protected) ======

  app.get("/api/storage/discovery", requireAuth, async (req, res) => {
    try {
      const discovery = await storageManager.discoverDisks();
      res.json(discovery);
    } catch (error) {
      console.error('Storage discovery error:', error);
      res.status(500).json({ error: 'Failed to discover storage devices' });
    }
  });

  app.post("/api/storage/raid/create", requireAuth, async (req, res) => {
    try {
      const validation = createRaidSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors[0]?.message || 'Invalid request' });
      }

      const { name, level, devices, filesystem } = validation.data;
      const result = await storageManager.createRaidArray(name, level, devices, filesystem);
      
      if (result.success) {
        res.json({ success: true, taskId: result.taskId });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('RAID creation error:', error);
      res.status(500).json({ error: 'Failed to create RAID array' });
    }
  });

  app.post("/api/storage/zfs/create", requireAuth, async (req, res) => {
    try {
      const validation = createZfsPoolSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors[0]?.message || 'Invalid request' });
      }

      const { name, layout, devices } = validation.data;
      const result = await storageManager.createZfsPool(name, layout, devices);
      
      if (result.success) {
        res.json({ success: true, taskId: result.taskId });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('ZFS pool creation error:', error);
      res.status(500).json({ error: 'Failed to create ZFS pool' });
    }
  });

  app.get("/api/storage/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = storageManager.getAllTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get tasks' });
    }
  });

  app.get("/api/storage/tasks/:taskId", requireAuth, async (req, res) => {
    try {
      const task = storageManager.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get task' });
    }
  });

  app.get("/api/storage/progress/raid", requireAuth, async (req, res) => {
    try {
      const progress = await storageManager.getRaidSyncProgress();
      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get RAID progress' });
    }
  });

  app.get("/api/storage/progress/zfs", requireAuth, async (req, res) => {
    try {
      const progress = await storageManager.getZfsScrubProgress();
      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get ZFS progress' });
    }
  });

  // ====== File Browser Routes (Protected) ======
  
  const fs = await import('fs');
  const pathModule = await import('path');
  
  // Allowed base paths for browsing
  const ALLOWED_PATHS = [
    '/opt/dockpilot/data',
    '/home',
    '/root',
    '/var/lib/docker/volumes',
    process.cwd()
  ];

  function isPathAllowed(targetPath: string): boolean {
    const resolved = pathModule.default.resolve(targetPath);
    return ALLOWED_PATHS.some(allowed => resolved.startsWith(allowed));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  function getFileType(name: string, isDir: boolean): string {
    if (isDir) return 'folder';
    const ext = pathModule.default.extname(name).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) return 'image';
    if (['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(ext)) return 'video';
    if (['.mp3', '.wav', '.flac', '.ogg', '.m4a'].includes(ext)) return 'audio';
    return 'file';
  }

  // List files in directory
  app.get("/api/files", requireAuth, async (req, res) => {
    try {
      const requestedPath = (req.query.path as string) || process.cwd();
      const resolvedPath = pathModule.default.resolve(requestedPath);

      if (!isPathAllowed(resolvedPath)) {
        return res.status(403).json({ error: 'Access denied to this path' });
      }

      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'Path not found' });
      }

      const stats = fs.statSync(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }

      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const files = entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(entry => {
          const fullPath = pathModule.default.join(resolvedPath, entry.name);
          let size = '-';
          let modified = '';
          try {
            const stat = fs.statSync(fullPath);
            size = entry.isDirectory() ? '-' : formatFileSize(stat.size);
            modified = stat.mtime.toLocaleString();
          } catch (e) {}
          
          return {
            id: Buffer.from(fullPath).toString('base64'),
            name: entry.name,
            path: fullPath,
            type: getFileType(entry.name, entry.isDirectory()),
            size,
            modified
          };
        })
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });

      res.json({
        currentPath: resolvedPath,
        parentPath: pathModule.default.dirname(resolvedPath),
        files
      });
    } catch (error) {
      console.error('File list error:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  return httpServer;
}
