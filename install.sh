#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INSTALL_DIR="/opt/dockpilot"
REPO_URL="https://github.com/YOUR_USERNAME/dockpilot.git"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║     ██████╗  ██████╗  ██████╗██╗  ██╗██████╗ ██╗██╗      ██╗  ║"
echo "║     ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔══██╗██║██║     ██╔╝  ║"
echo "║     ██║  ██║██║   ██║██║     █████╔╝ ██████╔╝██║██║    ██╔╝   ║"
echo "║     ██║  ██║██║   ██║██║     ██╔═██╗ ██╔═══╝ ██║██║   ██╔╝    ║"
echo "║     ██████╔╝╚██████╔╝╚██████╗██║  ██╗██║     ██║█████╗██║     ║"
echo "║     ╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚════╝╚═╝     ║"
echo "║                                                               ║"
echo "║              Docker GUI Installer for Ubuntu/Debian           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Cannot detect OS. This script supports Ubuntu and Debian only.${NC}"
    exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo -e "${RED}This script only supports Ubuntu and Debian.${NC}"
    exit 1
fi

echo -e "${GREEN}[1/8]${NC} Updating system packages..."
apt-get update -qq

echo -e "${GREEN}[2/8]${NC} Installing system dependencies..."
apt-get install -y -qq curl wget git build-essential python3 make g++
echo -e "${GREEN}System dependencies installed!${NC}"

echo -e "${GREEN}[3/8]${NC} Installing Docker..."
if ! command -v docker &> /dev/null; then
    apt-get install -y -qq apt-transport-https ca-certificates curl gnupg lsb-release
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}Docker installed successfully!${NC}"
else
    echo -e "${YELLOW}Docker already installed, skipping...${NC}"
fi

# Ensure Docker is running and accessible
echo -e "${YELLOW}Ensuring Docker is ready...${NC}"
systemctl start docker 2>/dev/null || true
systemctl enable docker 2>/dev/null || true

# Wait for Docker to be fully ready
echo -e "${YELLOW}Waiting for Docker daemon...${NC}"
DOCKER_READY=false
for i in {1..30}; do
    if docker info >/dev/null 2>&1; then
        DOCKER_READY=true
        break
    fi
    sleep 1
done

if [ "$DOCKER_READY" = true ]; then
    echo -e "${GREEN}Docker is ready!${NC}"
else
    echo -e "${RED}Warning: Docker daemon not responding. DockPilot will run in demo mode.${NC}"
fi

# Ensure Docker socket has correct permissions
chmod 666 /var/run/docker.sock 2>/dev/null || true

# Add current user to docker group
SUDO_USER_NAME=${SUDO_USER:-$USER}
if [ "$SUDO_USER_NAME" != "root" ]; then
    usermod -aG docker $SUDO_USER_NAME
    echo -e "${GREEN}Added $SUDO_USER_NAME to docker group${NC}"
fi

echo -e "${GREEN}[4/8]${NC} Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    echo -e "${GREEN}Node.js $(node -v) installed!${NC}"
else
    echo -e "${YELLOW}Node.js already installed ($(node -v)), skipping...${NC}"
fi

echo -e "${GREEN}[5/8]${NC} Creating DockPilot directory..."
rm -rf $INSTALL_DIR
mkdir -p $INSTALL_DIR

echo -e "${GREEN}[6/8]${NC} Downloading DockPilot..."
# For now, we'll create the files directly. In production, this would clone from git.
# git clone $REPO_URL $INSTALL_DIR

# Create package.json
cat > $INSTALL_DIR/package.json << 'PACKAGEJSON'
{
  "name": "dockpilot",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "build": "cd frontend && npm run build"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.0.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dockerode": "^4.0.2",
    "express": "^4.21.2"
  }
}
PACKAGEJSON

# Create server directory
mkdir -p $INSTALL_DIR/server

# Create database setup
cat > $INSTALL_DIR/server/database.js << 'DATABASEJS'
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'dockpilot.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS installed_apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        image TEXT NOT NULL,
        icon_url TEXT,
        container_id TEXT,
        status TEXT DEFAULT 'stopped',
        ports TEXT,
        environment TEXT,
        volumes TEXT,
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        server_name TEXT DEFAULT 'DockPilot-Home',
        web_port INTEGER DEFAULT 8080,
        start_on_boot INTEGER DEFAULT 1,
        auto_update INTEGER DEFAULT 0,
        analytics INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO settings (id) VALUES ('default');
`);

export default db;
DATABASEJS

# Create Docker service
cat > $INSTALL_DIR/server/docker.js << 'DOCKERJS'
import Docker from 'dockerode';

export const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function isDockerAvailable() {
    try {
        await docker.ping();
        return true;
    } catch (error) {
        console.log('Docker not available:', error.message);
        return false;
    }
}

export async function listContainers(all = true) {
    try {
        const containers = await docker.listContainers({ all });
        return containers.map(container => ({
            id: container.Id.substring(0, 12),
            name: container.Names[0]?.replace('/', '') || 'unknown',
            image: container.Image,
            state: container.State,
            status: container.Status,
            ports: container.Ports.map(p => 
                p.PublicPort ? `${p.IP || '0.0.0.0'}:${p.PublicPort}->${p.PrivatePort}/${p.Type}` : `${p.PrivatePort}/${p.Type}`
            ).join(', '),
            created: new Date(container.Created * 1000).toISOString(),
        }));
    } catch (error) {
        console.error('Error listing containers:', error);
        return [];
    }
}

export async function listImages() {
    try {
        const images = await docker.listImages();
        return images.map(image => {
            const repoTags = image.RepoTags || ['<none>:<none>'];
            const [repository, tag] = repoTags[0].split(':');
            return {
                id: image.Id,
                repository: repository || '<none>',
                tag: tag || '<none>',
                size: formatBytes(image.Size),
                created: new Date(image.Created * 1000).toLocaleString(),
            };
        });
    } catch (error) {
        console.error('Error listing images:', error);
        return [];
    }
}

export async function pullImage(imageName) {
    return new Promise((resolve, reject) => {
        docker.pull(imageName, (err, stream) => {
            if (err) { reject(err); return; }
            docker.modem.followProgress(stream, (err, output) => {
                if (err) reject(err);
                else resolve(output);
            });
        });
    });
}

export async function createAndStartContainer(imageName, containerName, ports = [], environment = {}, volumes = []) {
    const portBindings = {};
    const exposedPorts = {};

    ports.forEach(({ container, host }) => {
        exposedPorts[`${container}/tcp`] = {};
        portBindings[`${container}/tcp`] = [{ HostPort: host.toString() }];
    });

    const binds = volumes.map(v => `${v.host}:${v.container}`);

    const container = await docker.createContainer({
        Image: imageName,
        name: containerName,
        Env: Object.entries(environment).map(([key, val]) => `${key}=${val}`),
        ExposedPorts: exposedPorts,
        HostConfig: {
            PortBindings: portBindings,
            Binds: binds,
            RestartPolicy: { Name: 'unless-stopped' },
        },
    });

    await container.start();
    return container.id;
}

export async function startContainer(containerId) {
    const container = docker.getContainer(containerId);
    await container.start();
}

export async function stopContainer(containerId) {
    const container = docker.getContainer(containerId);
    await container.stop();
}

export async function removeContainer(containerId, force = false) {
    const container = docker.getContainer(containerId);
    await container.remove({ force });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}
DOCKERJS

# Create main server
cat > $INSTALL_DIR/server/index.js << 'SERVERJS'
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';
import * as docker from './docker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auth middleware
function requireAuth(req, res, next) {
    const sessionId = req.cookies?.sessionId;
    if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
    
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session || new Date(session.expires_at) < new Date()) {
        if (session) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    req.user = user;
    next();
}

// Auth Routes
app.get('/api/auth/session', (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) return res.json({ authenticated: false, setupRequired: true });
    
    const sessionId = req.cookies?.sessionId;
    if (!sessionId) return res.json({ authenticated: false, setupRequired: false });
    
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session || new Date(session.expires_at) < new Date()) {
        if (session) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
        res.clearCookie('sessionId');
        return res.json({ authenticated: false, setupRequired: false });
    }
    
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(session.user_id);
    res.json({ authenticated: true, setupRequired: false, user });
});

app.post('/api/auth/setup', async (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount > 0) return res.status(400).json({ error: 'Setup already completed' });
    
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId, username, passwordHash);
    
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
    
    res.cookie('sessionId', sessionId, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: { id: userId, username } });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);
    
    res.cookie('sessionId', sessionId, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: { id: user.id, username: user.username } });
});

app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.cookies?.sessionId;
    if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    res.clearCookie('sessionId');
    res.json({ success: true });
});

// API Routes
app.get('/api/health', async (req, res) => {
    const dockerAvailable = await docker.isDockerAvailable();
    res.json({ status: 'ok', dockerAvailable, timestamp: new Date().toISOString() });
});

// Containers (protected)
app.get('/api/containers', requireAuth, async (req, res) => {
    try {
        const containers = await docker.listContainers(true);
        res.json(containers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list containers' });
    }
});

app.post('/api/containers/:id/start', requireAuth, async (req, res) => {
    try {
        await docker.startContainer(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start container' });
    }
});

app.post('/api/containers/:id/stop', requireAuth, async (req, res) => {
    try {
        await docker.stopContainer(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to stop container' });
    }
});

app.delete('/api/containers/:id', requireAuth, async (req, res) => {
    try {
        await docker.removeContainer(req.params.id, true);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove container' });
    }
});

// Images (protected)
app.get('/api/images', requireAuth, async (req, res) => {
    try {
        const images = await docker.listImages();
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list images' });
    }
});

app.post('/api/images/pull', requireAuth, async (req, res) => {
    try {
        const { imageName } = req.body;
        if (!imageName) return res.status(400).json({ error: 'Image name required' });
        await docker.pullImage(imageName);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to pull image' });
    }
});

// Installed Apps (protected)
app.get('/api/apps', requireAuth, (req, res) => {
    try {
        const apps = db.prepare('SELECT * FROM installed_apps').all();
        // Parse JSON fields
        const parsed = apps.map(app => ({
            ...app,
            ports: app.ports ? JSON.parse(app.ports) : [],
            environment: app.environment ? JSON.parse(app.environment) : {},
            volumes: app.volumes ? JSON.parse(app.volumes) : []
        }));
        res.json(parsed);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch apps' });
    }
});

app.post('/api/apps', requireAuth, async (req, res) => {
    try {
        const { id, name, description, category, image, iconUrl, ports, environment, volumes } = req.body;
        
        const dockerAvailable = await docker.isDockerAvailable();
        let containerId = null;
        let status = 'stopped';

        if (dockerAvailable) {
            try {
                await docker.pullImage(image);
                containerId = await docker.createAndStartContainer(image, name.toLowerCase().replace(/\s+/g, '-'), ports || [], environment || {}, volumes || []);
                status = 'running';
            } catch (err) {
                console.error('Docker operation failed:', err);
            }
        }

        const stmt = db.prepare(`
            INSERT INTO installed_apps (id, name, description, category, image, icon_url, container_id, status, ports, environment, volumes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, name, description || '', category || 'App', image, iconUrl || '', containerId, status,
            JSON.stringify(ports || []), JSON.stringify(environment || {}), JSON.stringify(volumes || []));

        res.json({ id, name, description, category, image, iconUrl, containerId, status, ports, environment, volumes });
    } catch (error) {
        console.error('Install error:', error);
        res.status(500).json({ error: 'Failed to install app' });
    }
});

app.patch('/api/apps/:id', requireAuth, (req, res) => {
    try {
        const updates = req.body;
        const setClauses = Object.keys(updates).map(key => {
            if (key === 'iconColor') return 'icon_url = ?';
            return `${key} = ?`;
        }).join(', ');
        const values = Object.values(updates);
        
        db.prepare(`UPDATE installed_apps SET ${setClauses} WHERE id = ?`).run(...values, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update app' });
    }
});

app.delete('/api/apps/:id', requireAuth, async (req, res) => {
    try {
        const app = db.prepare('SELECT * FROM installed_apps WHERE id = ?').get(req.params.id);
        if (app?.container_id) {
            try {
                await docker.removeContainer(app.container_id, true);
            } catch (err) {
                console.error('Container removal failed:', err);
            }
        }
        db.prepare('DELETE FROM installed_apps WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to uninstall app' });
    }
});

// Settings (protected)
app.get('/api/settings', requireAuth, (req, res) => {
    try {
        const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('default');
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.patch('/api/settings', requireAuth, (req, res) => {
    try {
        const { serverName, webPort, startOnBoot, autoUpdate, analytics } = req.body;
        db.prepare(`
            UPDATE settings SET 
                server_name = COALESCE(?, server_name),
                web_port = COALESCE(?, web_port),
                start_on_boot = COALESCE(?, start_on_boot),
                auto_update = COALESCE(?, auto_update),
                analytics = COALESCE(?, analytics),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'default'
        `).run(serverName, webPort, startOnBoot, autoUpdate, analytics);
        
        const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('default');
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Fallback to frontend for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    DockPilot is running!                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Web Interface:  http://localhost:${PORT}                        ║
║  API Endpoint:   http://localhost:${PORT}/api                    ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});
SERVERJS

# Install dependencies
echo -e "${GREEN}[7/8]${NC} Installing dependencies..."
cd $INSTALL_DIR
npm install --silent

echo -e "${GREEN}[8/8]${NC} Setting up systemd service..."

# Create systemd service
cat > /etc/systemd/system/dockpilot.service << SYSTEMD
[Unit]
Description=DockPilot - Docker GUI Manager
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=dockpilot
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
SYSTEMD

# Create public directory for frontend
mkdir -p $INSTALL_DIR/public
cat > $INSTALL_DIR/public/index.html << 'FRONTENDHTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DockPilot</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: { extend: { colors: { background: 'hsl(222 47% 11%)', foreground: 'hsl(210 40% 98%)', card: 'hsl(222 47% 13%)', primary: 'hsl(217 91% 60%)', muted: 'hsl(217 19% 20%)', border: 'hsl(217 19% 27%)' } } }
        }
    </script>
    <style>
        body { background: hsl(222 47% 11%); color: hsl(210 40% 98%); font-family: system-ui, sans-serif; }
        .card { background: hsl(222 47% 13% / 0.4); border: 1px solid hsl(217 19% 27% / 0.5); backdrop-filter: blur(12px); }
        .btn-primary { background: linear-gradient(135deg, #3b82f6, #8b5cf6); }
        .btn-primary:hover { background: linear-gradient(135deg, #2563eb, #7c3aed); }
        .modal { background: rgba(0,0,0,0.7); }
        .app-icon { width: 48px; height: 48px; border-radius: 12px; object-fit: contain; background: white; padding: 6px; }
        .app-icon-sm { width: 32px; height: 32px; border-radius: 8px; object-fit: contain; background: white; padding: 4px; }
        input, select, textarea { background: hsl(222 47% 15%); border: 1px solid hsl(217 19% 27%); color: white; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; }
    </style>
</head>
<body class="min-h-screen">
    <!-- Setup Page -->
    <div id="setup-page" class="hidden min-h-screen flex items-center justify-center p-4">
        <div class="card rounded-2xl p-8 w-full max-w-md text-center">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl btn-primary flex items-center justify-center">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <h1 class="text-2xl font-bold mb-2">Welcome to DockPilot</h1>
            <p class="text-gray-400 mb-6">Create your admin account to get started</p>
            <form id="setup-form" class="space-y-4 text-left">
                <div><label class="block text-sm mb-2">Username</label><input type="text" id="setup-username" required class="w-full px-4 py-3 rounded-xl" placeholder="admin"></div>
                <div><label class="block text-sm mb-2">Password</label><input type="password" id="setup-password" required minlength="6" class="w-full px-4 py-3 rounded-xl" placeholder="Min 6 characters"></div>
                <div><label class="block text-sm mb-2">Confirm Password</label><input type="password" id="setup-confirm" required class="w-full px-4 py-3 rounded-xl" placeholder="Confirm password"></div>
                <div id="setup-error" class="hidden p-3 rounded-lg bg-red-500/20 text-red-400 text-sm"></div>
                <button type="submit" class="w-full py-3 rounded-xl btn-primary text-white font-medium">Create Account</button>
            </form>
        </div>
    </div>

    <!-- Login Page -->
    <div id="login-page" class="hidden min-h-screen flex items-center justify-center p-4">
        <div class="card rounded-2xl p-8 w-full max-w-md text-center">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl btn-primary flex items-center justify-center">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <h1 class="text-2xl font-bold mb-2">Welcome Back</h1>
            <p class="text-gray-400 mb-6">Sign in to your DockPilot dashboard</p>
            <form id="login-form" class="space-y-4 text-left">
                <div><label class="block text-sm mb-2">Username</label><input type="text" id="login-username" required class="w-full px-4 py-3 rounded-xl"></div>
                <div><label class="block text-sm mb-2">Password</label><input type="password" id="login-password" required class="w-full px-4 py-3 rounded-xl"></div>
                <div id="login-error" class="hidden p-3 rounded-lg bg-red-500/20 text-red-400 text-sm"></div>
                <button type="submit" class="w-full py-3 rounded-xl btn-primary text-white font-medium">Sign In</button>
            </form>
        </div>
    </div>

    <!-- Dashboard -->
    <div id="dashboard" class="hidden">
        <nav class="border-b border-white/10 px-4 py-3">
            <div class="container mx-auto max-w-7xl flex justify-between items-center">
                <h1 class="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">DockPilot</h1>
                <div class="flex items-center gap-4">
                    <span id="user-display" class="text-gray-400 text-sm"></span>
                    <button onclick="logout()" class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Logout</button>
                </div>
            </div>
        </nav>
        <div class="container mx-auto px-4 py-8 max-w-7xl">
            <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8" id="apps-grid">
                <div class="card rounded-2xl p-6 text-center"><div class="text-4xl mb-4">⏳</div><p class="text-gray-400">Loading apps...</p></div>
            </div>
            <div class="card rounded-2xl p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold">App Store</h2>
                    <button onclick="showCustomInstall()" class="px-4 py-2 rounded-lg btn-primary text-white text-sm">+ Custom App</button>
                </div>
                <div class="flex gap-2 mb-4 flex-wrap" id="category-tabs"></div>
                <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8" id="catalog"></div>
            </div>
            <div class="card rounded-2xl p-6">
                <h2 class="text-xl font-bold mb-4">Docker Containers</h2>
                <div id="containers" class="space-y-2"></div>
            </div>
        </div>
    </div>

    <!-- Install Modal -->
    <div id="install-modal" class="hidden fixed inset-0 modal flex items-center justify-center p-4 z-50">
        <div class="card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    <img id="modal-icon" class="app-icon" src="" alt="">
                    <div><h3 id="modal-title" class="text-xl font-bold"></h3><p id="modal-desc" class="text-sm text-gray-400"></p></div>
                </div>
                <button onclick="closeModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <form id="install-form" class="space-y-4">
                <div><label class="block text-sm mb-2">Container Name</label><input type="text" id="modal-name" required class="w-full px-4 py-2 rounded-lg"></div>
                <div><label class="block text-sm mb-2">Docker Image</label><input type="text" id="modal-image" required class="w-full px-4 py-2 rounded-lg"></div>
                <div>
                    <label class="block text-sm mb-2">Port Mappings <span class="text-gray-500">(host:container)</span></label>
                    <div id="modal-ports" class="space-y-2"></div>
                    <button type="button" onclick="addPort()" class="mt-2 text-sm text-blue-400 hover:text-blue-300">+ Add Port</button>
                </div>
                <div>
                    <label class="block text-sm mb-2">Environment Variables</label>
                    <div id="modal-env" class="space-y-2"></div>
                    <button type="button" onclick="addEnv()" class="mt-2 text-sm text-blue-400 hover:text-blue-300">+ Add Variable</button>
                </div>
                <div>
                    <label class="block text-sm mb-2">Volume Mounts <span class="text-gray-500">(host:container)</span></label>
                    <div id="modal-volumes" class="space-y-2"></div>
                    <button type="button" onclick="addVolume()" class="mt-2 text-sm text-blue-400 hover:text-blue-300">+ Add Volume</button>
                </div>
                <div id="modal-error" class="hidden p-3 rounded-lg bg-red-500/20 text-red-400 text-sm"></div>
                <div class="flex gap-3">
                    <button type="button" onclick="closeModal()" class="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20">Cancel</button>
                    <button type="submit" id="modal-submit" class="flex-1 py-3 rounded-xl btn-primary text-white">Install</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        let currentUser = null;
        let currentApp = null;
        let selectedCategory = 'all';

        const APP_CATALOG = [
            // Media
            { id: 'plex', name: 'Plex', category: 'Media', image: 'plexinc/pms-docker:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/plex.png', ports: [{c:32400,h:32400}], desc: 'Media server' },
            { id: 'jellyfin', name: 'Jellyfin', category: 'Media', image: 'jellyfin/jellyfin:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyfin.png', ports: [{c:8096,h:8096}], desc: 'Free media system' },
            { id: 'emby', name: 'Emby', category: 'Media', image: 'emby/embyserver:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/emby.png', ports: [{c:8096,h:8097}], desc: 'Media server' },
            { id: 'sonarr', name: 'Sonarr', category: 'Media', image: 'linuxserver/sonarr:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/sonarr.png', ports: [{c:8989,h:8989}], desc: 'TV show manager' },
            { id: 'radarr', name: 'Radarr', category: 'Media', image: 'linuxserver/radarr:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/radarr.png', ports: [{c:7878,h:7878}], desc: 'Movie manager' },
            { id: 'lidarr', name: 'Lidarr', category: 'Media', image: 'linuxserver/lidarr:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/lidarr.png', ports: [{c:8686,h:8686}], desc: 'Music manager' },
            { id: 'bazarr', name: 'Bazarr', category: 'Media', image: 'linuxserver/bazarr:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/bazarr.png', ports: [{c:6767,h:6767}], desc: 'Subtitle manager' },
            { id: 'overseerr', name: 'Overseerr', category: 'Media', image: 'linuxserver/overseerr:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/overseerr.png', ports: [{c:5055,h:5055}], desc: 'Request management' },
            { id: 'tautulli', name: 'Tautulli', category: 'Media', image: 'linuxserver/tautulli:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/tautulli.png', ports: [{c:8181,h:8181}], desc: 'Plex monitoring' },
            // Downloads
            { id: 'qbittorrent', name: 'qBittorrent', category: 'Downloads', image: 'linuxserver/qbittorrent:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/qbittorrent.png', ports: [{c:8080,h:8090}], desc: 'Torrent client' },
            { id: 'transmission', name: 'Transmission', category: 'Downloads', image: 'linuxserver/transmission:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/transmission.png', ports: [{c:9091,h:9091}], desc: 'Torrent client' },
            { id: 'deluge', name: 'Deluge', category: 'Downloads', image: 'linuxserver/deluge:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/deluge.png', ports: [{c:8112,h:8112}], desc: 'Torrent client' },
            { id: 'sabnzbd', name: 'SABnzbd', category: 'Downloads', image: 'linuxserver/sabnzbd:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/sabnzbd.png', ports: [{c:8080,h:8085}], desc: 'Usenet downloader' },
            { id: 'nzbget', name: 'NZBGet', category: 'Downloads', image: 'linuxserver/nzbget:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/nzbget.png', ports: [{c:6789,h:6789}], desc: 'Usenet downloader' },
            { id: 'prowlarr', name: 'Prowlarr', category: 'Downloads', image: 'linuxserver/prowlarr:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/prowlarr.png', ports: [{c:9696,h:9696}], desc: 'Indexer manager' },
            // Cloud & Files
            { id: 'nextcloud', name: 'Nextcloud', category: 'Cloud', image: 'nextcloud:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/nextcloud.png', ports: [{c:80,h:8082}], desc: 'Personal cloud' },
            { id: 'syncthing', name: 'Syncthing', category: 'Cloud', image: 'syncthing/syncthing:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/syncthing.png', ports: [{c:8384,h:8384}], desc: 'File sync' },
            { id: 'filebrowser', name: 'FileBrowser', category: 'Cloud', image: 'filebrowser/filebrowser:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/filebrowser.png', ports: [{c:80,h:8086}], desc: 'Web file manager' },
            { id: 'duplicati', name: 'Duplicati', category: 'Cloud', image: 'linuxserver/duplicati:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/duplicati.png', ports: [{c:8200,h:8200}], desc: 'Backup solution' },
            // Network & Security
            { id: 'pihole', name: 'Pi-hole', category: 'Network', image: 'pihole/pihole:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/pi-hole.png', ports: [{c:80,h:8053}], desc: 'Ad blocker DNS' },
            { id: 'adguard', name: 'AdGuard Home', category: 'Network', image: 'adguard/adguardhome:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/adguard-home.png', ports: [{c:3000,h:3003}], desc: 'Ad blocker DNS' },
            { id: 'nginx-proxy', name: 'Nginx Proxy Manager', category: 'Network', image: 'jc21/nginx-proxy-manager:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/nginx-proxy-manager.png', ports: [{c:81,h:81}], desc: 'Reverse proxy' },
            { id: 'traefik', name: 'Traefik', category: 'Network', image: 'traefik:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/traefik.png', ports: [{c:8080,h:8180}], desc: 'Reverse proxy' },
            { id: 'wireguard', name: 'WireGuard', category: 'Network', image: 'linuxserver/wireguard:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/wireguard.png', ports: [{c:51820,h:51820}], desc: 'VPN server' },
            { id: 'tailscale', name: 'Tailscale', category: 'Network', image: 'tailscale/tailscale:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/tailscale.png', ports: [], desc: 'Mesh VPN' },
            { id: 'vaultwarden', name: 'Vaultwarden', category: 'Network', image: 'vaultwarden/server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/vaultwarden.png', ports: [{c:80,h:8084}], desc: 'Password manager' },
            { id: 'authelia', name: 'Authelia', category: 'Network', image: 'authelia/authelia:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/authelia.png', ports: [{c:9091,h:9092}], desc: 'SSO & 2FA' },
            // Home Automation
            { id: 'homeassistant', name: 'Home Assistant', category: 'Home', image: 'homeassistant/home-assistant:stable', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/home-assistant.png', ports: [{c:8123,h:8123}], desc: 'Home automation' },
            { id: 'nodered', name: 'Node-RED', category: 'Home', image: 'nodered/node-red:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/node-red.png', ports: [{c:1880,h:1880}], desc: 'Flow automation' },
            { id: 'mqtt', name: 'Mosquitto', category: 'Home', image: 'eclipse-mosquitto:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/mqtt.png', ports: [{c:1883,h:1883}], desc: 'MQTT broker' },
            { id: 'zigbee2mqtt', name: 'Zigbee2MQTT', category: 'Home', image: 'koenkk/zigbee2mqtt:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/zigbee2mqtt.png', ports: [{c:8080,h:8088}], desc: 'Zigbee bridge' },
            // Monitoring
            { id: 'grafana', name: 'Grafana', category: 'Monitor', image: 'grafana/grafana:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/grafana.png', ports: [{c:3000,h:3000}], desc: 'Dashboards' },
            { id: 'prometheus', name: 'Prometheus', category: 'Monitor', image: 'prom/prometheus:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/prometheus.png', ports: [{c:9090,h:9090}], desc: 'Metrics database' },
            { id: 'influxdb', name: 'InfluxDB', category: 'Monitor', image: 'influxdb:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/influxdb.png', ports: [{c:8086,h:8087}], desc: 'Time series DB' },
            { id: 'uptime-kuma', name: 'Uptime Kuma', category: 'Monitor', image: 'louislam/uptime-kuma:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/uptime-kuma.png', ports: [{c:3001,h:3001}], desc: 'Status monitor' },
            { id: 'netdata', name: 'Netdata', category: 'Monitor', image: 'netdata/netdata:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/netdata.png', ports: [{c:19999,h:19999}], desc: 'Real-time monitor' },
            // Development & Tools
            { id: 'portainer', name: 'Portainer', category: 'Tools', image: 'portainer/portainer-ce:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/portainer.png', ports: [{c:9000,h:9000}], desc: 'Docker management' },
            { id: 'gitea', name: 'Gitea', category: 'Tools', image: 'gitea/gitea:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/gitea.png', ports: [{c:3000,h:3002}], desc: 'Git server' },
            { id: 'jenkins', name: 'Jenkins', category: 'Tools', image: 'jenkins/jenkins:lts', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jenkins.png', ports: [{c:8080,h:8089}], desc: 'CI/CD server' },
            { id: 'code-server', name: 'Code Server', category: 'Tools', image: 'linuxserver/code-server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/code.png', ports: [{c:8443,h:8443}], desc: 'VS Code in browser' },
            // Databases
            { id: 'mariadb', name: 'MariaDB', category: 'Database', image: 'mariadb:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/mariadb.png', ports: [{c:3306,h:3306}], desc: 'MySQL database' },
            { id: 'postgres', name: 'PostgreSQL', category: 'Database', image: 'postgres:16', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/postgres.png', ports: [{c:5432,h:5432}], desc: 'PostgreSQL DB' },
            { id: 'redis', name: 'Redis', category: 'Database', image: 'redis:alpine', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/redis.png', ports: [{c:6379,h:6379}], desc: 'In-memory cache' },
            { id: 'mongodb', name: 'MongoDB', category: 'Database', image: 'mongo:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/mongodb.png', ports: [{c:27017,h:27017}], desc: 'NoSQL database' },
            // Other
            { id: 'homepage', name: 'Homepage', category: 'Other', image: 'ghcr.io/gethomepage/homepage:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/homepage.png', ports: [{c:3000,h:3004}], desc: 'Dashboard' },
            { id: 'homarr', name: 'Homarr', category: 'Other', image: 'ghcr.io/ajnart/homarr:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/homarr.png', ports: [{c:7575,h:7575}], desc: 'Dashboard' },
            { id: 'watchtower', name: 'Watchtower', category: 'Other', image: 'containrrr/watchtower:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/watchtower.png', ports: [], desc: 'Auto-update containers' },
            { id: 'dozzle', name: 'Dozzle', category: 'Other', image: 'amir20/dozzle:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/dozzle.png', ports: [{c:8080,h:8081}], desc: 'Docker logs viewer' },
        ];

        const CATEGORIES = ['all', ...new Set(APP_CATALOG.map(a => a.category))];

        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/session', { credentials: 'include' });
                const data = await res.json();
                document.getElementById('setup-page').classList.add('hidden');
                document.getElementById('login-page').classList.add('hidden');
                document.getElementById('dashboard').classList.add('hidden');
                if (data.setupRequired) { document.getElementById('setup-page').classList.remove('hidden'); }
                else if (!data.authenticated) { document.getElementById('login-page').classList.remove('hidden'); }
                else {
                    currentUser = data.user;
                    document.getElementById('user-display').textContent = data.user.username;
                    document.getElementById('dashboard').classList.remove('hidden');
                    renderCategories();
                    renderCatalog();
                    loadApps();
                    loadContainers();
                }
            } catch (err) { console.error('Auth check failed:', err); }
        }

        document.getElementById('setup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('setup-username').value;
            const password = document.getElementById('setup-password').value;
            const confirm = document.getElementById('setup-confirm').value;
            const errorEl = document.getElementById('setup-error');
            if (password !== confirm) { errorEl.textContent = 'Passwords do not match'; errorEl.classList.remove('hidden'); return; }
            try {
                const res = await fetch('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'include' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                checkAuth();
            } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
        });

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            try {
                const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'include' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                checkAuth();
            } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
        });

        async function logout() { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); checkAuth(); }

        function renderCategories() {
            document.getElementById('category-tabs').innerHTML = CATEGORIES.map(cat => 
                `<button onclick="filterCategory('${cat}')" class="px-4 py-2 rounded-full text-sm ${selectedCategory === cat ? 'btn-primary text-white' : 'bg-white/10 hover:bg-white/20'}">${cat === 'all' ? 'All Apps' : cat}</button>`
            ).join('');
        }

        function filterCategory(cat) { selectedCategory = cat; renderCategories(); renderCatalog(); }

        function renderCatalog() {
            const apps = selectedCategory === 'all' ? APP_CATALOG : APP_CATALOG.filter(a => a.category === selectedCategory);
            document.getElementById('catalog').innerHTML = apps.map(app => `
                <button onclick='openInstallModal(${JSON.stringify(app).replace(/'/g, "\\'")})' class="card rounded-xl p-3 text-center hover:bg-white/10 transition flex flex-col items-center">
                    <img src="${app.iconUrl}" class="app-icon-sm mb-2" onerror="this.src='https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png'" alt="${app.name}">
                    <div class="font-medium text-xs truncate w-full">${app.name}</div>
                </button>
            `).join('');
        }

        function openInstallModal(app) {
            currentApp = app;
            document.getElementById('modal-icon').src = app.iconUrl || 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png';
            document.getElementById('modal-title').textContent = app.name;
            document.getElementById('modal-desc').textContent = app.desc || '';
            document.getElementById('modal-name').value = app.name.toLowerCase().replace(/\s+/g, '-');
            document.getElementById('modal-image').value = app.image;
            document.getElementById('modal-ports').innerHTML = '';
            document.getElementById('modal-env').innerHTML = '';
            document.getElementById('modal-volumes').innerHTML = '';
            (app.ports || []).forEach(p => addPort(p.h, p.c));
            if ((app.ports || []).length === 0) addPort();
            document.getElementById('modal-error').classList.add('hidden');
            document.getElementById('modal-submit').textContent = 'Install';
            document.getElementById('install-modal').classList.remove('hidden');
        }

        function showCustomInstall() {
            currentApp = { id: 'custom-' + Date.now(), name: 'Custom App', image: '', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png', ports: [], desc: '' };
            openInstallModal(currentApp);
            document.getElementById('modal-name').value = '';
            document.getElementById('modal-image').value = '';
        }

        function closeModal() { document.getElementById('install-modal').classList.add('hidden'); currentApp = null; }

        function addPort(host = '', container = '') {
            const div = document.createElement('div');
            div.className = 'flex gap-2';
            div.innerHTML = `<input type="number" placeholder="Host" value="${host}" class="flex-1 px-3 py-2 rounded-lg"><input type="number" placeholder="Container" value="${container}" class="flex-1 px-3 py-2 rounded-lg"><button type="button" onclick="this.parentElement.remove()" class="px-3 text-red-400">&times;</button>`;
            document.getElementById('modal-ports').appendChild(div);
        }

        function addEnv(key = '', val = '') {
            const div = document.createElement('div');
            div.className = 'flex gap-2';
            div.innerHTML = `<input type="text" placeholder="KEY" value="${key}" class="flex-1 px-3 py-2 rounded-lg"><input type="text" placeholder="value" value="${val}" class="flex-1 px-3 py-2 rounded-lg"><button type="button" onclick="this.parentElement.remove()" class="px-3 text-red-400">&times;</button>`;
            document.getElementById('modal-env').appendChild(div);
        }

        function addVolume(host = '', container = '') {
            const div = document.createElement('div');
            div.className = 'flex gap-2';
            div.innerHTML = `<input type="text" placeholder="/host/path" value="${host}" class="flex-1 px-3 py-2 rounded-lg"><input type="text" placeholder="/container/path" value="${container}" class="flex-1 px-3 py-2 rounded-lg"><button type="button" onclick="this.parentElement.remove()" class="px-3 text-red-400">&times;</button>`;
            document.getElementById('modal-volumes').appendChild(div);
        }

        document.getElementById('install-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('modal-error');
            const name = document.getElementById('modal-name').value;
            const image = document.getElementById('modal-image').value;
            const ports = [...document.getElementById('modal-ports').querySelectorAll('div')].map(d => {
                const inputs = d.querySelectorAll('input');
                return { host: parseInt(inputs[0].value) || 0, container: parseInt(inputs[1].value) || 0 };
            }).filter(p => p.host && p.container);
            const environment = {};
            [...document.getElementById('modal-env').querySelectorAll('div')].forEach(d => {
                const inputs = d.querySelectorAll('input');
                if (inputs[0].value) environment[inputs[0].value] = inputs[1].value || '';
            });
            const volumes = [...document.getElementById('modal-volumes').querySelectorAll('div')].map(d => {
                const inputs = d.querySelectorAll('input');
                return { host: inputs[0].value, container: inputs[1].value };
            }).filter(v => v.host && v.container);
            try {
                const res = await fetch('/api/apps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: currentApp.id || name, name, image, iconUrl: currentApp.iconUrl, ports, environment, volumes }),
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                closeModal();
                loadApps();
                loadContainers();
            } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
        });

        async function loadApps() {
            try {
                const res = await fetch('/api/apps', { credentials: 'include' });
                if (!res.ok) return;
                const apps = await res.json();
                const grid = document.getElementById('apps-grid');
                if (apps.length === 0) {
                    grid.innerHTML = '<div class="card rounded-2xl p-6 text-center col-span-full"><p class="text-gray-400">No apps installed yet. Choose one from the App Store below!</p></div>';
                } else {
                    grid.innerHTML = apps.map(app => {
                        const catalogApp = APP_CATALOG.find(a => a.id === app.id || a.name === app.name);
                        const iconUrl = app.icon_url || (catalogApp ? catalogApp.iconUrl : 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png');
                        return `
                        <div class="card rounded-2xl p-5 relative">
                            <div class="absolute top-4 right-4 w-3 h-3 rounded-full ${app.status === 'running' ? 'bg-green-500' : 'bg-red-500'}"></div>
                            <div class="flex items-center gap-3 mb-3">
                                <img src="${iconUrl}" class="app-icon" onerror="this.src='https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png'" alt="${app.name}">
                                <div><h3 class="font-bold">${app.name}</h3><p class="text-xs text-gray-400">${app.status}</p></div>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="toggleApp('${app.id}', '${app.container_id}', '${app.status}')" class="flex-1 py-2 rounded-lg text-sm ${app.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}">${app.status === 'running' ? 'Stop' : 'Start'}</button>
                                <button onclick="editApp('${app.id}')" class="px-3 py-2 rounded-lg text-sm bg-blue-500/20 text-blue-400">Edit</button>
                                <button onclick="uninstallApp('${app.id}')" class="px-3 py-2 rounded-lg text-sm bg-red-500/20 text-red-400">Remove</button>
                            </div>
                        </div>`;
                    }).join('');
                }
            } catch (err) { console.error(err); }
        }

        async function toggleApp(id, containerId, status) {
            if (!containerId || containerId === 'null') return alert('Container not available (demo mode or not started)');
            const action = status === 'running' ? 'stop' : 'start';
            await fetch(`/api/containers/${containerId}/${action}`, { method: 'POST', credentials: 'include' });
            await fetch(`/api/apps/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action === 'start' ? 'running' : 'stopped' }), credentials: 'include' });
            loadApps();
            loadContainers();
        }

        async function editApp(id) {
            const res = await fetch('/api/apps', { credentials: 'include' });
            const apps = await res.json();
            const app = apps.find(a => a.id === id);
            if (!app) return;
            const catalogApp = APP_CATALOG.find(a => a.id === app.id || a.name === app.name);
            currentApp = { ...app, iconUrl: app.icon_url || (catalogApp ? catalogApp.iconUrl : '') };
            document.getElementById('modal-icon').src = currentApp.iconUrl || 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png';
            document.getElementById('modal-title').textContent = app.name + ' (Edit)';
            document.getElementById('modal-desc').textContent = 'Modify settings and reinstall';
            document.getElementById('modal-name').value = app.name;
            document.getElementById('modal-image').value = app.image;
            document.getElementById('modal-ports').innerHTML = '';
            document.getElementById('modal-env').innerHTML = '';
            document.getElementById('modal-volumes').innerHTML = '';
            (app.ports || []).forEach(p => addPort(p.host || p.h, p.container || p.c));
            Object.entries(app.environment || {}).forEach(([k, v]) => addEnv(k, v));
            (app.volumes || []).forEach(v => addVolume(v.host, v.container));
            document.getElementById('modal-submit').textContent = 'Save & Reinstall';
            document.getElementById('install-modal').classList.remove('hidden');
        }

        async function uninstallApp(id) {
            if (confirm('Remove this app and its container?')) {
                await fetch(`/api/apps/${id}`, { method: 'DELETE', credentials: 'include' });
                loadApps();
                loadContainers();
            }
        }

        async function loadContainers() {
            try {
                const res = await fetch('/api/containers', { credentials: 'include' });
                if (!res.ok) return;
                const containers = await res.json();
                document.getElementById('containers').innerHTML = containers.length ? containers.map(c => `
                    <div class="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <div><span class="font-medium">${c.name}</span><span class="text-sm text-gray-400 ml-2">${c.image}</span></div>
                        <span class="px-2 py-1 rounded text-xs ${c.state === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${c.state}</span>
                    </div>
                `).join('') : '<p class="text-gray-400">No containers found</p>';
            } catch (err) { document.getElementById('containers').innerHTML = '<p class="text-red-400">Failed to load containers</p>'; }
        }

        checkAuth();
        setInterval(loadApps, 15000);
        setInterval(loadContainers, 15000);
    </script>
</body>
</html>
FRONTENDHTML

# Reload systemd and start service
systemctl daemon-reload
systemctl enable dockpilot
systemctl start dockpilot

# Wait for DockPilot to start
sleep 3

# Verify Docker connectivity through DockPilot API
echo -e "${YELLOW}Verifying Docker connectivity...${NC}"
HEALTH_CHECK=$(curl -s http://localhost:8080/api/health 2>/dev/null || echo '{"dockerAvailable":false}')
if echo "$HEALTH_CHECK" | grep -q '"dockerAvailable":true'; then
    DOCKER_STATUS="${GREEN}Connected ✓${NC}"
else
    DOCKER_STATUS="${YELLOW}Demo Mode (Docker not accessible)${NC}"
    # Try one more time to fix permissions and restart
    chmod 666 /var/run/docker.sock 2>/dev/null || true
    systemctl restart dockpilot
    sleep 2
    HEALTH_CHECK=$(curl -s http://localhost:8080/api/health 2>/dev/null || echo '{"dockerAvailable":false}')
    if echo "$HEALTH_CHECK" | grep -q '"dockerAvailable":true'; then
        DOCKER_STATUS="${GREEN}Connected ✓${NC}"
    fi
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║           DockPilot installed successfully! 🎉               ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║   Web Interface:  ${BLUE}http://localhost:8080${GREEN}                    ║${NC}"
echo -e "${GREEN}║   API Endpoint:   ${BLUE}http://localhost:8080/api${GREEN}                ║${NC}"
echo -e "${GREEN}║   Docker Status:  ${NC}$DOCKER_STATUS${GREEN}                           ${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║   Manage service:                                             ║${NC}"
echo -e "${GREEN}║   ${YELLOW}sudo systemctl status dockpilot${GREEN}                          ║${NC}"
echo -e "${GREEN}║   ${YELLOW}sudo systemctl restart dockpilot${GREEN}                         ║${NC}"
echo -e "${GREEN}║   ${YELLOW}sudo systemctl stop dockpilot${GREEN}                            ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Note: Log out and back in for docker group changes to take effect.${NC}"
echo ""
