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
        const { id, name, description, category, image, iconColor, ports, environment, volumes } = req.body;
        
        const dockerAvailable = await docker.isDockerAvailable();
        let containerId = null;
        let status = 'stopped';

        if (dockerAvailable) {
            try {
                await docker.pullImage(image);
                containerId = await docker.createAndStartContainer(image, name, ports || [], environment || {}, volumes || []);
                status = 'running';
            } catch (err) {
                console.error('Docker operation failed:', err);
            }
        }

        const stmt = db.prepare(`
            INSERT INTO installed_apps (id, name, description, category, image, icon_url, container_id, status, ports, environment, volumes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, name, description, category, image, iconColor, containerId, status,
            JSON.stringify(ports || []), JSON.stringify(environment || {}), JSON.stringify(volumes || []));

        res.json({ id, name, description, category, image, iconColor, containerId, status, ports, environment, volumes });
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
            theme: {
                extend: {
                    colors: {
                        background: 'hsl(222 47% 11%)',
                        foreground: 'hsl(210 40% 98%)',
                        card: 'hsl(222 47% 13%)',
                        primary: 'hsl(217 91% 60%)',
                        muted: 'hsl(217 19% 20%)',
                        border: 'hsl(217 19% 27%)',
                    }
                }
            }
        }
    </script>
    <style>
        body { background: hsl(222 47% 11%); color: hsl(210 40% 98%); font-family: system-ui, sans-serif; }
        .card { background: hsl(222 47% 13% / 0.4); border: 1px solid hsl(217 19% 27% / 0.5); backdrop-filter: blur(12px); }
        .btn-primary { background: linear-gradient(135deg, #3b82f6, #8b5cf6); }
        .btn-primary:hover { background: linear-gradient(135deg, #2563eb, #7c3aed); }
    </style>
</head>
<body class="min-h-screen">
    <!-- Setup Page -->
    <div id="setup-page" class="hidden min-h-screen flex items-center justify-center p-4">
        <div class="card rounded-2xl p-8 w-full max-w-md text-center">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl btn-primary flex items-center justify-center">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
            </div>
            <h1 class="text-2xl font-bold mb-2">Welcome to DockPilot</h1>
            <p class="text-gray-400 mb-6">Create your admin account to get started</p>
            <form id="setup-form" class="space-y-4 text-left">
                <div>
                    <label class="block text-sm mb-2">Username</label>
                    <input type="text" id="setup-username" required class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none" placeholder="admin">
                </div>
                <div>
                    <label class="block text-sm mb-2">Password</label>
                    <input type="password" id="setup-password" required minlength="6" class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none" placeholder="Min 6 characters">
                </div>
                <div>
                    <label class="block text-sm mb-2">Confirm Password</label>
                    <input type="password" id="setup-confirm" required class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none" placeholder="Confirm password">
                </div>
                <div id="setup-error" class="hidden p-3 rounded-lg bg-red-500/20 text-red-400 text-sm"></div>
                <button type="submit" class="w-full py-3 rounded-xl btn-primary text-white font-medium">Create Account</button>
            </form>
        </div>
    </div>

    <!-- Login Page -->
    <div id="login-page" class="hidden min-h-screen flex items-center justify-center p-4">
        <div class="card rounded-2xl p-8 w-full max-w-md text-center">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl btn-primary flex items-center justify-center">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
            </div>
            <h1 class="text-2xl font-bold mb-2">Welcome Back</h1>
            <p class="text-gray-400 mb-6">Sign in to your DockPilot dashboard</p>
            <form id="login-form" class="space-y-4 text-left">
                <div>
                    <label class="block text-sm mb-2">Username</label>
                    <input type="text" id="login-username" required class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none">
                </div>
                <div>
                    <label class="block text-sm mb-2">Password</label>
                    <input type="password" id="login-password" required class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none">
                </div>
                <div id="login-error" class="hidden p-3 rounded-lg bg-red-500/20 text-red-400 text-sm"></div>
                <button type="submit" class="w-full py-3 rounded-xl btn-primary text-white font-medium">Sign In</button>
            </form>
        </div>
    </div>

    <!-- Dashboard -->
    <div id="dashboard" class="hidden">
        <nav class="border-b border-white/10 px-4 py-3">
            <div class="container mx-auto max-w-6xl flex justify-between items-center">
                <h1 class="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">DockPilot</h1>
                <div class="flex items-center gap-4">
                    <span id="user-display" class="text-gray-400 text-sm"></span>
                    <button onclick="logout()" class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Logout</button>
                </div>
            </div>
        </nav>
        <div class="container mx-auto px-4 py-8 max-w-6xl">
            <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8" id="apps-grid">
                <div class="card rounded-2xl p-6 text-center">
                    <div class="text-4xl mb-4">⏳</div>
                    <p class="text-gray-400">Loading apps...</p>
                </div>
            </div>
            <div class="card rounded-2xl p-6 mb-6">
                <h2 class="text-xl font-bold mb-4">Install New App</h2>
                <div class="grid gap-4 md:grid-cols-4 lg:grid-cols-6" id="catalog"></div>
            </div>
            <div class="card rounded-2xl p-6">
                <h2 class="text-xl font-bold mb-4">Running Containers</h2>
                <div id="containers" class="space-y-2"></div>
            </div>
        </div>
    </div>

    <script>
        let currentUser = null;

        const APP_CATALOG = [
            { id: 'plex', name: 'Plex', image: 'plexinc/pms-docker:latest', icon: '🎬', ports: [{ container: 32400, host: 32400 }] },
            { id: 'jellyfin', name: 'Jellyfin', image: 'jellyfin/jellyfin:latest', icon: '🎥', ports: [{ container: 8096, host: 8096 }] },
            { id: 'pihole', name: 'Pi-hole', image: 'pihole/pihole:latest', icon: '🛡️', ports: [{ container: 80, host: 8053 }] },
            { id: 'homeassistant', name: 'Home Assistant', image: 'homeassistant/home-assistant:stable', icon: '🏠', ports: [{ container: 8123, host: 8123 }] },
            { id: 'nextcloud', name: 'Nextcloud', image: 'nextcloud:latest', icon: '☁️', ports: [{ container: 80, host: 8082 }] },
            { id: 'portainer', name: 'Portainer', image: 'portainer/portainer-ce:latest', icon: '🐳', ports: [{ container: 9000, host: 9000 }] },
            { id: 'nodered', name: 'Node-RED', image: 'nodered/node-red:latest', icon: '🔴', ports: [{ container: 1880, host: 1880 }] },
            { id: 'qbittorrent', name: 'qBittorrent', image: 'linuxserver/qbittorrent:latest', icon: '📥', ports: [{ container: 8080, host: 8090 }] },
            { id: 'transmission', name: 'Transmission', image: 'linuxserver/transmission:latest', icon: '⬇️', ports: [{ container: 9091, host: 9091 }] },
            { id: 'grafana', name: 'Grafana', image: 'grafana/grafana:latest', icon: '📊', ports: [{ container: 3000, host: 3000 }] },
            { id: 'nginx-proxy', name: 'Nginx Proxy Manager', image: 'jc21/nginx-proxy-manager:latest', icon: '🌐', ports: [{ container: 81, host: 81 }] },
            { id: 'vaultwarden', name: 'Vaultwarden', image: 'vaultwarden/server:latest', icon: '🔐', ports: [{ container: 80, host: 8084 }] },
            { id: 'syncthing', name: 'Syncthing', image: 'syncthing/syncthing:latest', icon: '🔄', ports: [{ container: 8384, host: 8384 }] },
        ];

        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/session', { credentials: 'include' });
                const data = await res.json();
                
                document.getElementById('setup-page').classList.add('hidden');
                document.getElementById('login-page').classList.add('hidden');
                document.getElementById('dashboard').classList.add('hidden');
                
                if (data.setupRequired) {
                    document.getElementById('setup-page').classList.remove('hidden');
                } else if (!data.authenticated) {
                    document.getElementById('login-page').classList.remove('hidden');
                } else {
                    currentUser = data.user;
                    document.getElementById('user-display').textContent = data.user.username;
                    document.getElementById('dashboard').classList.remove('hidden');
                    loadApps();
                    loadContainers();
                }
            } catch (err) {
                console.error('Auth check failed:', err);
            }
        }

        document.getElementById('setup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('setup-username').value;
            const password = document.getElementById('setup-password').value;
            const confirm = document.getElementById('setup-confirm').value;
            const errorEl = document.getElementById('setup-error');
            
            if (password !== confirm) {
                errorEl.textContent = 'Passwords do not match';
                errorEl.classList.remove('hidden');
                return;
            }
            
            try {
                const res = await fetch('/api/auth/setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                checkAuth();
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                checkAuth();
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });

        async function logout() {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            checkAuth();
        }

        async function loadApps() {
            try {
                const res = await fetch('/api/apps', { credentials: 'include' });
                if (!res.ok) return;
                const apps = await res.json();
                const grid = document.getElementById('apps-grid');
                
                if (apps.length === 0) {
                    grid.innerHTML = '<div class="card rounded-2xl p-6 text-center col-span-full"><p class="text-gray-400">No apps installed yet. Install one from the catalog below!</p></div>';
                } else {
                    grid.innerHTML = apps.map(app => `
                        <div class="card rounded-2xl p-6 text-center relative">
                            <div class="absolute top-4 right-4 w-3 h-3 rounded-full ${app.status === 'running' ? 'bg-green-500' : 'bg-red-500'}"></div>
                            <div class="text-4xl mb-4">${getIcon(app.name)}</div>
                            <h3 class="font-bold text-lg">${app.name}</h3>
                            <p class="text-sm text-gray-400 mb-4">${app.status}</p>
                            <div class="flex gap-2 justify-center">
                                <button onclick="toggleApp('${app.id}', '${app.container_id}', '${app.status}')" 
                                    class="px-4 py-2 rounded-full text-sm ${app.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}">
                                    ${app.status === 'running' ? 'Stop' : 'Start'}
                                </button>
                                <button onclick="uninstallApp('${app.id}')" class="px-4 py-2 rounded-full text-sm bg-red-500/20 text-red-400">Remove</button>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error(err);
            }
        }

        function getIcon(name) {
            const app = APP_CATALOG.find(a => a.name === name);
            return app ? app.icon : '📦';
        }

        async function installApp(app) {
            try {
                await fetch('/api/apps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...app, category: 'App', description: '' }),
                    credentials: 'include'
                });
                loadApps();
                loadContainers();
            } catch (err) {
                alert('Failed to install: ' + err.message);
            }
        }

        async function toggleApp(id, containerId, status) {
            if (!containerId) return alert('No container ID');
            const action = status === 'running' ? 'stop' : 'start';
            await fetch(`/api/containers/${containerId}/${action}`, { method: 'POST', credentials: 'include' });
            await fetch(`/api/apps/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action === 'start' ? 'running' : 'stopped' }),
                credentials: 'include'
            });
            loadApps();
            loadContainers();
        }

        async function uninstallApp(id) {
            if (confirm('Remove this app?')) {
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
                        <div>
                            <span class="font-medium">${c.name}</span>
                            <span class="text-sm text-gray-400 ml-2">${c.image}</span>
                        </div>
                        <span class="px-2 py-1 rounded text-xs ${c.state === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${c.state}</span>
                    </div>
                `).join('') : '<p class="text-gray-400">No containers running</p>';
            } catch (err) {
                document.getElementById('containers').innerHTML = '<p class="text-red-400">Failed to load containers</p>';
            }
        }

        // Render catalog
        document.getElementById('catalog').innerHTML = APP_CATALOG.map(app => `
            <button onclick='installApp(${JSON.stringify(app)})' class="card rounded-xl p-4 text-center hover:bg-white/10 transition">
                <div class="text-2xl mb-2">${app.icon}</div>
                <div class="font-medium text-sm">${app.name}</div>
            </button>
        `).join('');

        // Initial auth check
        checkAuth();
        setInterval(loadApps, 10000);
        setInterval(loadContainers, 10000);
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
