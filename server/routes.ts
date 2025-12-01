import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertInstalledAppSchema, insertSettingsSchema } from "@shared/schema";
import * as docker from "./docker";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Health check & Docker status
  app.get("/api/health", async (req, res) => {
    const dockerAvailable = await docker.isDockerAvailable();
    res.json({ 
      status: "ok", 
      dockerAvailable,
      timestamp: new Date().toISOString() 
    });
  });

  // ====== Docker Container Routes ======
  
  // List all containers
  app.get("/api/containers", async (req, res) => {
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
  app.post("/api/containers/:id/start", async (req, res) => {
    try {
      await docker.startContainer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to start container" });
    }
  });

  // Stop a container
  app.post("/api/containers/:id/stop", async (req, res) => {
    try {
      await docker.stopContainer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop container" });
    }
  });

  // Remove a container
  app.delete("/api/containers/:id", async (req, res) => {
    try {
      await docker.removeContainer(req.params.id, true);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove container" });
    }
  });

  // Get container logs
  app.get("/api/containers/:id/logs", async (req, res) => {
    try {
      const logs = await docker.getContainerLogs(req.params.id);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  // ====== Docker Image Routes ======

  // List all images
  app.get("/api/images", async (req, res) => {
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
  app.post("/api/images/pull", async (req, res) => {
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
  app.delete("/api/images/:id", async (req, res) => {
    try {
      await docker.removeImage(req.params.id, true);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove image" });
    }
  });

  // ====== Installed Apps Routes ======

  // Get all installed apps
  app.get("/api/apps", async (req, res) => {
    try {
      const apps = await storage.getInstalledApps();
      res.json(apps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch apps" });
    }
  });

  // Install a new app
  app.post("/api/apps", async (req, res) => {
    try {
      const parsed = insertInstalledAppSchema.parse(req.body);
      
      // First, pull the image if not already present
      await docker.pullImage(parsed.image);
      
      // Create and start the container
      const containerId = await docker.createAndStartContainer(
        parsed.image,
        parsed.name,
        parsed.ports || [],
        parsed.environment || {},
        parsed.volumes || []
      );
      
      // Save to database
      const app = await storage.createInstalledApp({
        ...parsed,
        containerId,
        status: 'running'
      });
      
      res.json(app);
    } catch (error) {
      console.error('Install error:', error);
      res.status(500).json({ error: "Failed to install app" });
    }
  });

  // Update app status
  app.patch("/api/apps/:id", async (req, res) => {
    try {
      const app = await storage.updateInstalledApp(req.params.id, req.body);
      res.json(app);
    } catch (error) {
      res.status(500).json({ error: "Failed to update app" });
    }
  });

  // Uninstall an app
  app.delete("/api/apps/:id", async (req, res) => {
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

  // ====== Settings Routes ======

  // Get settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Update settings
  app.patch("/api/settings", async (req, res) => {
    try {
      const settings = await storage.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  return httpServer;
}
