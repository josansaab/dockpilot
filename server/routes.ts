import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertInstalledAppSchema, insertSettingsSchema } from "@shared/schema";
import * as docker from "./docker";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import crypto from "crypto";

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
      const parsed = insertInstalledAppSchema.parse(req.body);
      
      const dockerAvailable = await docker.isDockerAvailable();
      
      let containerId: string | null = null;
      let status = 'stopped';
      
      if (dockerAvailable) {
        // Pull the image and create container if Docker is available
        await docker.pullImage(parsed.image);
        containerId = await docker.createAndStartContainer(
          parsed.image,
          parsed.name,
          parsed.ports || [],
          parsed.environment || {},
          parsed.volumes || []
        );
        status = 'running';
      }
      
      // Save to database (works even without Docker for demo purposes)
      const app = await storage.createInstalledApp({
        ...parsed,
        containerId,
        status
      });
      
      res.json(app);
    } catch (error) {
      console.error('Install error:', error);
      res.status(500).json({ error: "Failed to install app" });
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

  return httpServer;
}
