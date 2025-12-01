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
        docker_config TEXT,
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

export async function createAndStartContainer(imageName, containerName, ports = [], environment = {}, volumes = [], dockerConfig = {}) {
    const portBindings = {};
    const exposedPorts = {};

    ports.forEach(({ container, host }) => {
        exposedPorts[container + '/tcp'] = {};
        portBindings[container + '/tcp'] = [{ HostPort: host.toString() }];
    });

    // Combine volumes and additional bind mounts
    const binds = volumes.map(v => v.host + ':' + v.container);
    if (dockerConfig.binds && Array.isArray(dockerConfig.binds)) {
        dockerConfig.binds.forEach(b => {
            const bindStr = b.readonly ? (b.host + ':' + b.container + ':ro') : (b.host + ':' + b.container);
            binds.push(bindStr);
        });
    }

    // Build HostConfig with advanced Docker settings
    const hostConfig = {
        PortBindings: portBindings,
        Binds: binds,
        RestartPolicy: { Name: dockerConfig.restartPolicy || 'unless-stopped' },
    };

    // Network mode (bridge, host, none, or custom network name)
    if (dockerConfig.networkMode === 'custom' && dockerConfig.networkName) {
        hostConfig.NetworkMode = dockerConfig.networkName;
    } else if (dockerConfig.networkMode) {
        hostConfig.NetworkMode = dockerConfig.networkMode;
    }

    // Resource limits
    if (dockerConfig.memory) {
        const memBytes = parseInt(dockerConfig.memory) * 1024 * 1024; // Convert MB to bytes
        if (!isNaN(memBytes)) hostConfig.Memory = memBytes;
    }
    if (dockerConfig.cpu) {
        const cpuPeriod = 100000;
        const cpuQuota = Math.floor(parseFloat(dockerConfig.cpu) * cpuPeriod);
        if (!isNaN(cpuQuota)) {
            hostConfig.CpuPeriod = cpuPeriod;
            hostConfig.CpuQuota = cpuQuota;
        }
    }

    // Privileged mode
    if (dockerConfig.privileged) {
        hostConfig.Privileged = true;
    }

    // Linux capabilities
    if (dockerConfig.caps && dockerConfig.caps.length > 0) {
        hostConfig.CapAdd = dockerConfig.caps;
    }

    // Build container config
    const containerConfig = {
        Image: imageName,
        name: containerName,
        Env: Object.entries(environment).map(([key, val]) => key + '=' + val),
        ExposedPorts: exposedPorts,
        HostConfig: hostConfig,
    };

    // Hostname
    if (dockerConfig.hostname) {
        containerConfig.Hostname = dockerConfig.hostname;
    }

    // TTY and interactive mode
    if (dockerConfig.tty !== false) {
        containerConfig.Tty = true;
    }
    if (dockerConfig.interactive !== false) {
        containerConfig.OpenStdin = true;
    }

    const container = await docker.createContainer(containerConfig);
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
        const parsed = apps.map(app => ({
            ...app,
            ports: app.ports ? JSON.parse(app.ports) : [],
            environment: app.environment ? JSON.parse(app.environment) : {},
            volumes: app.volumes ? JSON.parse(app.volumes) : [],
            dockerConfig: app.docker_config ? JSON.parse(app.docker_config) : {}
        }));
        res.json(parsed);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch apps' });
    }
});

app.post('/api/apps', requireAuth, async (req, res) => {
    try {
        const { id, name, description, category, image, iconUrl, ports, environment, volumes, dockerConfig } = req.body;
        
        const dockerAvailable = await docker.isDockerAvailable();
        let containerId = null;
        let status = 'stopped';

        if (dockerAvailable) {
            try {
                await docker.pullImage(image);
                containerId = await docker.createAndStartContainer(image, name.toLowerCase().replace(/\s+/g, '-'), ports || [], environment || {}, volumes || [], dockerConfig || {});
                status = 'running';
            } catch (err) {
                console.error('Docker operation failed:', err);
            }
        }

        const stmt = db.prepare(`
            INSERT INTO installed_apps (id, name, description, category, image, icon_url, container_id, status, ports, environment, volumes, docker_config)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, name, description || '', category || 'App', image, iconUrl || '', containerId, status,
            JSON.stringify(ports || []), JSON.stringify(environment || {}), JSON.stringify(volumes || []), JSON.stringify(dockerConfig || {}));

        res.json({ id, name, description, category, image, iconUrl, containerId, status, ports, environment, volumes, dockerConfig });
    } catch (error) {
        console.error('Install error:', error);
        res.status(500).json({ error: 'Failed to install app' });
    }
});

app.patch('/api/apps/:id', requireAuth, (req, res) => {
    try {
        const { status, name, image, iconUrl, ports, environment, volumes, dockerConfig } = req.body;
        const updates = [];
        const values = [];
        
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (image !== undefined) { updates.push('image = ?'); values.push(image); }
        if (iconUrl !== undefined) { updates.push('icon_url = ?'); values.push(iconUrl); }
        if (ports !== undefined) { updates.push('ports = ?'); values.push(JSON.stringify(ports)); }
        if (environment !== undefined) { updates.push('environment = ?'); values.push(JSON.stringify(environment)); }
        if (volumes !== undefined) { updates.push('volumes = ?'); values.push(JSON.stringify(volumes)); }
        if (dockerConfig !== undefined) { updates.push('docker_config = ?'); values.push(JSON.stringify(dockerConfig)); }
        
        if (updates.length > 0) {
            db.prepare(`UPDATE installed_apps SET ${updates.join(', ')} WHERE id = ?`).run(...values, req.params.id);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Update error:', error);
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
        .app-icon { width: 64px; height: 64px; border-radius: 14px; object-fit: contain; background: white; padding: 8px; }
        .app-icon-cat { width: 80px; height: 80px; border-radius: 16px; object-fit: contain; background: white; padding: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        input, select, textarea { background: hsl(222 47% 15%); border: 1px solid hsl(217 19% 27%); color: white; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; }
        .section-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 0.5rem; }
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
                <div class="relative">
                    <button onclick="prevPage()" id="prev-btn" class="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition hidden">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div class="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" id="catalog"></div>
                    <button onclick="nextPage()" id="next-btn" class="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition hidden">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    </button>
                </div>
                <div class="flex justify-center items-center gap-4 mt-4">
                    <span id="page-info" class="text-sm text-gray-400"></span>
                    <div id="page-dots" class="flex gap-2"></div>
                </div>
            </div>
            <div class="card rounded-2xl p-6">
                <h2 class="text-xl font-bold mb-4">Docker Containers</h2>
                <div id="containers" class="space-y-2"></div>
            </div>
        </div>
    </div>

    <!-- Install Modal -->
    <div id="install-modal" class="hidden fixed inset-0 modal flex items-center justify-center p-4 z-50">
        <div class="card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    <img id="modal-icon" class="app-icon" src="" alt="">
                    <div><h3 id="modal-title" class="text-xl font-bold"></h3><p id="modal-desc" class="text-sm text-gray-400"></p></div>
                </div>
                <button onclick="closeModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <form id="install-form" class="space-y-5">
                <!-- Basic Settings -->
                <div class="section-title">Basic Settings</div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm mb-2">Container Name</label><input type="text" id="modal-name" required class="w-full px-4 py-2 rounded-lg"></div>
                    <div><label class="block text-sm mb-2">Docker Image</label><input type="text" id="modal-image" required class="w-full px-4 py-2 rounded-lg"></div>
                </div>
                <!-- Network Settings -->
                <div class="section-title">Network</div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm mb-2">Network Mode</label>
                        <select id="modal-network" class="w-full px-4 py-2 rounded-lg">
                            <option value="bridge">Bridge (Default)</option>
                            <option value="host">Host</option>
                            <option value="none">None</option>
                            <option value="custom">Custom Network</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm mb-2">Custom Network Name</label>
                        <input type="text" id="modal-network-name" class="w-full px-4 py-2 rounded-lg" placeholder="my-network">
                    </div>
                </div>
                <div>
                    <label class="block text-sm mb-2">Port Mappings <span class="text-gray-500">(host:container)</span></label>
                    <div id="modal-ports" class="space-y-2"></div>
                    <button type="button" onclick="addPort()" class="mt-2 text-sm text-blue-400 hover:text-blue-300">+ Add Port</button>
                </div>
                <!-- Storage Settings -->
                <div class="section-title">Storage</div>
                <div>
                    <label class="block text-sm mb-2">Volume Mounts <span class="text-gray-500">(host path : container path)</span></label>
                    <div id="modal-volumes" class="space-y-2"></div>
                    <button type="button" onclick="addVolume()" class="mt-2 text-sm text-blue-400 hover:text-blue-300">+ Add Volume</button>
                </div>
                <div>
                    <label class="block text-sm mb-2">Bind Mounts <span class="text-gray-500">(read-only option)</span></label>
                    <div id="modal-binds" class="space-y-2"></div>
                    <button type="button" onclick="addBind()" class="mt-2 text-sm text-blue-400 hover:text-blue-300">+ Add Bind Mount</button>
                </div>
                <!-- Environment -->
                <div class="section-title">Environment Variables</div>
                <div>
                    <div id="modal-env" class="space-y-2"></div>
                    <button type="button" onclick="addEnv()" class="mt-2 text-sm text-blue-400 hover:text-blue-300">+ Add Variable</button>
                </div>
                <!-- Advanced Settings -->
                <div class="section-title">Advanced Options</div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm mb-2">Restart Policy</label>
                        <select id="modal-restart" class="w-full px-4 py-2 rounded-lg">
                            <option value="no">No</option>
                            <option value="always" selected>Always</option>
                            <option value="on-failure">On Failure</option>
                            <option value="unless-stopped">Unless Stopped</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm mb-2">Memory Limit</label>
                        <input type="text" id="modal-memory" class="w-full px-4 py-2 rounded-lg" placeholder="e.g., 512m, 2g">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm mb-2">CPU Limit</label>
                        <input type="text" id="modal-cpu" class="w-full px-4 py-2 rounded-lg" placeholder="e.g., 0.5, 2">
                    </div>
                    <div>
                        <label class="block text-sm mb-2">Hostname</label>
                        <input type="text" id="modal-hostname" class="w-full px-4 py-2 rounded-lg" placeholder="container-hostname">
                    </div>
                </div>
                <div class="flex gap-6">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="modal-privileged" class="w-4 h-4 rounded">
                        <span class="text-sm">Privileged Mode</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="modal-tty" class="w-4 h-4 rounded" checked>
                        <span class="text-sm">Allocate TTY</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="modal-interactive" class="w-4 h-4 rounded" checked>
                        <span class="text-sm">Interactive</span>
                    </label>
                </div>
                <div>
                    <label class="block text-sm mb-2">Capabilities <span class="text-gray-500">(comma-separated)</span></label>
                    <input type="text" id="modal-caps" class="w-full px-4 py-2 rounded-lg" placeholder="NET_ADMIN, SYS_PTRACE">
                </div>
                <div id="modal-error" class="hidden p-3 rounded-lg bg-red-500/20 text-red-400 text-sm"></div>
                <div class="flex gap-3 pt-2">
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
        let currentPage = 0;
        const APPS_PER_PAGE = 12;

        const APP_CATALOG = [
            // Media
            { id: 'plex', name: 'Plex', category: 'Media', image: 'plexinc/pms-docker:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/plex.png', ports: [{c:32400,h:32400}], env: {PLEX_UID:'1000',PLEX_GID:'1000',ADVERTISE_IP:'http://YOUR_SERVER_IP:32400/'}, networkMode: 'host', desc: 'Media server' },
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
            // Productivity
            { id: 'bookstack', name: 'BookStack', category: 'Productivity', image: 'linuxserver/bookstack:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/bookstack.png', ports: [{c:80,h:6875}], desc: 'Wiki & docs' },
            { id: 'wikijs', name: 'Wiki.js', category: 'Productivity', image: 'ghcr.io/requarks/wiki:2', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/wikijs.png', ports: [{c:3000,h:3005}], desc: 'Modern wiki' },
            { id: 'outline', name: 'Outline', category: 'Productivity', image: 'outlinewiki/outline:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/outline.png', ports: [{c:3000,h:3006}], desc: 'Team knowledge base' },
            { id: 'docuseal', name: 'DocuSeal', category: 'Productivity', image: 'docuseal/docuseal:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docuseal.png', ports: [{c:3000,h:3007}], desc: 'Document signing' },
            { id: 'paperless', name: 'Paperless-ngx', category: 'Productivity', image: 'ghcr.io/paperless-ngx/paperless-ngx:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/paperless-ngx.png', ports: [{c:8000,h:8000}], desc: 'Document management' },
            { id: 'stirlingpdf', name: 'Stirling PDF', category: 'Productivity', image: 'frooodle/s-pdf:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/stirling-pdf.png', ports: [{c:8080,h:8082}], desc: 'PDF tools' },
            { id: 'drawio', name: 'Draw.io', category: 'Productivity', image: 'jgraph/drawio:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/drawio.png', ports: [{c:8080,h:8083}], desc: 'Diagram editor' },
            { id: 'excalidraw', name: 'Excalidraw', category: 'Productivity', image: 'excalidraw/excalidraw:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/excalidraw.png', ports: [{c:80,h:8280}], desc: 'Whiteboard' },
            { id: 'trilium', name: 'Trilium', category: 'Productivity', image: 'zadam/trilium:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/trilium.png', ports: [{c:8080,h:8281}], desc: 'Note-taking' },
            { id: 'joplin', name: 'Joplin Server', category: 'Productivity', image: 'joplin/server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/joplin.png', ports: [{c:22300,h:22300}], desc: 'Notes sync server' },
            // Communication
            { id: 'rocket-chat', name: 'Rocket.Chat', category: 'Communication', image: 'rocket.chat:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/rocket-chat.png', ports: [{c:3000,h:3008}], desc: 'Team chat' },
            { id: 'mattermost', name: 'Mattermost', category: 'Communication', image: 'mattermost/mattermost-team-edition:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/mattermost.png', ports: [{c:8065,h:8065}], desc: 'Team messaging' },
            { id: 'element', name: 'Element', category: 'Communication', image: 'vectorim/element-web:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/element.png', ports: [{c:80,h:8282}], desc: 'Matrix client' },
            { id: 'synapse', name: 'Matrix Synapse', category: 'Communication', image: 'matrixdotorg/synapse:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/matrix.png', ports: [{c:8008,h:8008}], desc: 'Matrix server' },
            { id: 'gotify', name: 'Gotify', category: 'Communication', image: 'gotify/server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/gotify.png', ports: [{c:80,h:8283}], desc: 'Push notifications' },
            { id: 'ntfy', name: 'ntfy', category: 'Communication', image: 'binwiederhier/ntfy:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/ntfy.png', ports: [{c:80,h:8284}], desc: 'Pub-sub notifications' },
            // Gaming
            { id: 'minecraft', name: 'Minecraft', category: 'Gaming', image: 'itzg/minecraft-server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/minecraft.png', ports: [{c:25565,h:25565}], env: {EULA:'TRUE'}, desc: 'Minecraft server' },
            { id: 'valheim', name: 'Valheim', category: 'Gaming', image: 'ghcr.io/lloesche/valheim-server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/valheim.png', ports: [{c:2456,h:2456},{c:2457,h:2457}], desc: 'Valheim server' },
            { id: 'terraria', name: 'Terraria', category: 'Gaming', image: 'ryshe/terraria:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/terraria.png', ports: [{c:7777,h:7777}], desc: 'Terraria server' },
            { id: 'satisfactory', name: 'Satisfactory', category: 'Gaming', image: 'wolveix/satisfactory-server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/satisfactory.png', ports: [{c:7777,h:7778},{c:15000,h:15000}], desc: 'Satisfactory server' },
            { id: 'palworld', name: 'Palworld', category: 'Gaming', image: 'thijsvanloef/palworld-server-docker:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/palworld.png', ports: [{c:8211,h:8211}], desc: 'Palworld server' },
            { id: 'pterodactyl', name: 'Pterodactyl', category: 'Gaming', image: 'ghcr.io/pterodactyl/panel:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/pterodactyl.png', ports: [{c:80,h:8285}], desc: 'Game server panel' },
            // Security
            { id: 'crowdsec', name: 'CrowdSec', category: 'Security', image: 'crowdsecurity/crowdsec:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/crowdsec.png', ports: [{c:8080,h:8286}], desc: 'Security engine' },
            { id: 'fail2ban', name: 'Fail2Ban', category: 'Security', image: 'linuxserver/fail2ban:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/fail2ban.png', ports: [], desc: 'Intrusion prevention' },
            { id: 'openvas', name: 'OpenVAS', category: 'Security', image: 'greenbone/openvas-scanner:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/openvas.png', ports: [{c:9392,h:9392}], desc: 'Vulnerability scanner' },
            { id: 'wazuh', name: 'Wazuh', category: 'Security', image: 'wazuh/wazuh-manager:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/wazuh.png', ports: [{c:1514,h:1514}], desc: 'Security platform' },
            // Analytics
            { id: 'plausible', name: 'Plausible', category: 'Analytics', image: 'plausible/analytics:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/plausible.png', ports: [{c:8000,h:8287}], desc: 'Web analytics' },
            { id: 'umami', name: 'Umami', category: 'Analytics', image: 'ghcr.io/umami-software/umami:postgresql-latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/umami.png', ports: [{c:3000,h:3009}], desc: 'Web analytics' },
            { id: 'matomo', name: 'Matomo', category: 'Analytics', image: 'matomo:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/matomo.png', ports: [{c:80,h:8288}], desc: 'Web analytics' },
            { id: 'posthog', name: 'PostHog', category: 'Analytics', image: 'posthog/posthog:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/posthog.png', ports: [{c:8000,h:8289}], desc: 'Product analytics' },
            // Development
            { id: 'gitlab', name: 'GitLab', category: 'Development', image: 'gitlab/gitlab-ce:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/gitlab.png', ports: [{c:80,h:8290},{c:443,h:8443}], desc: 'DevOps platform' },
            { id: 'drone', name: 'Drone CI', category: 'Development', image: 'drone/drone:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/drone.png', ports: [{c:80,h:8291}], desc: 'CI/CD platform' },
            { id: 'sonarqube', name: 'SonarQube', category: 'Development', image: 'sonarqube:community', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/sonarqube.png', ports: [{c:9000,h:9001}], desc: 'Code quality' },
            { id: 'registry', name: 'Docker Registry', category: 'Development', image: 'registry:2', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png', ports: [{c:5000,h:5001}], desc: 'Private registry' },
            { id: 'verdaccio', name: 'Verdaccio', category: 'Development', image: 'verdaccio/verdaccio:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/verdaccio.png', ports: [{c:4873,h:4873}], desc: 'NPM registry' },
            { id: 'nexus', name: 'Nexus', category: 'Development', image: 'sonatype/nexus3:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/nexus.png', ports: [{c:8081,h:8292}], desc: 'Artifact repository' },
            // AI & Machine Learning
            { id: 'ollama', name: 'Ollama', category: 'AI', image: 'ollama/ollama:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/ollama.png', ports: [{c:11434,h:11434}], desc: 'Run LLMs locally' },
            { id: 'open-webui', name: 'Open WebUI', category: 'AI', image: 'ghcr.io/open-webui/open-webui:main', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/open-webui.png', ports: [{c:8080,h:8293}], desc: 'ChatGPT-like UI' },
            { id: 'stable-diffusion', name: 'Stable Diffusion', category: 'AI', image: 'ghcr.io/invoke-ai/invokeai:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/invoke-ai.png', ports: [{c:9090,h:9093}], desc: 'AI image generation' },
            { id: 'langflow', name: 'Langflow', category: 'AI', image: 'langflowai/langflow:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/langflow.png', ports: [{c:7860,h:7860}], desc: 'LLM workflow builder' },
            // Backup & Storage
            { id: 'duplicati', name: 'Duplicati', category: 'Backup', image: 'linuxserver/duplicati:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/duplicati.png', ports: [{c:8200,h:8200}], desc: 'Backup solution' },
            { id: 'restic', name: 'Restic', category: 'Backup', image: 'restic/restic:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/restic.png', ports: [], desc: 'Fast backups' },
            { id: 'borg', name: 'Borg Backup', category: 'Backup', image: 'modem7/borgbackup-docker:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/borg.png', ports: [], desc: 'Dedup backups' },
            { id: 'urbackup', name: 'UrBackup', category: 'Backup', image: 'uroni/urbackup-server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/urbackup.png', ports: [{c:55414,h:55414}], desc: 'Client-server backup' },
            // Photos
            { id: 'immich', name: 'Immich', category: 'Photos', image: 'ghcr.io/immich-app/immich-server:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/immich.png', ports: [{c:3001,h:2283}], desc: 'Photo management' },
            { id: 'photoprism', name: 'PhotoPrism', category: 'Photos', image: 'photoprism/photoprism:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/photoprism.png', ports: [{c:2342,h:2342}], desc: 'Photo library' },
            { id: 'lychee', name: 'Lychee', category: 'Photos', image: 'lycheeorg/lychee:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/lychee.png', ports: [{c:80,h:8294}], desc: 'Photo management' },
            { id: 'pigallery2', name: 'PiGallery2', category: 'Photos', image: 'bpatrik/pigallery2:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/pigallery2.png', ports: [{c:80,h:8295}], desc: 'Photo gallery' },
            // More Tools
            { id: 'n8n', name: 'n8n', category: 'Tools', image: 'n8nio/n8n:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/n8n.png', ports: [{c:5678,h:5678}], desc: 'Workflow automation' },
            { id: 'changedetection', name: 'Change Detection', category: 'Tools', image: 'ghcr.io/dgtlmoon/changedetection.io:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/changedetection-io.png', ports: [{c:5000,h:5002}], desc: 'Website monitoring' },
            { id: 'it-tools', name: 'IT Tools', category: 'Tools', image: 'corentinth/it-tools:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/it-tools.png', ports: [{c:80,h:8296}], desc: 'Developer utilities' },
            { id: 'cyberchef', name: 'CyberChef', category: 'Tools', image: 'mpepping/cyberchef:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/cyberchef.png', ports: [{c:8000,h:8297}], desc: 'Data converter' },
            { id: 'speedtest', name: 'Speedtest', category: 'Tools', image: 'ghcr.io/librespeed/speedtest:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/librespeed.png', ports: [{c:80,h:8298}], desc: 'Network speed test' },
            { id: 'glances', name: 'Glances', category: 'Monitor', image: 'nicolargo/glances:latest', iconUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/glances.png', ports: [{c:61208,h:61208}], desc: 'System monitor' },
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

        function filterCategory(cat) { selectedCategory = cat; currentPage = 0; renderCategories(); renderCatalog(); }

        function getFilteredApps() {
            return selectedCategory === 'all' ? APP_CATALOG : APP_CATALOG.filter(a => a.category === selectedCategory);
        }

        function getTotalPages() {
            return Math.ceil(getFilteredApps().length / APPS_PER_PAGE);
        }

        function prevPage() {
            if (currentPage > 0) { currentPage--; renderCatalog(); }
        }

        function nextPage() {
            if (currentPage < getTotalPages() - 1) { currentPage++; renderCatalog(); }
        }

        function goToPage(page) {
            currentPage = page; renderCatalog();
        }

        function renderCatalog() {
            const apps = getFilteredApps();
            const totalPages = getTotalPages();
            const startIdx = currentPage * APPS_PER_PAGE;
            const pageApps = apps.slice(startIdx, startIdx + APPS_PER_PAGE);

            document.getElementById('catalog').innerHTML = pageApps.map(app => `
                <button onclick='openInstallModal(${JSON.stringify(app).replace(/'/g, "\\'")})' class="card rounded-xl p-5 text-center hover:bg-white/10 hover:scale-105 transition-all duration-200 flex flex-col items-center">
                    <img src="${app.iconUrl}" class="app-icon-cat mb-3" onerror="this.src='https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png'" alt="${app.name}">
                    <div class="font-medium text-sm truncate w-full">${app.name}</div>
                    <div class="text-xs text-gray-500 mt-1">${app.category}</div>
                </button>
            `).join('');

            // Update navigation buttons
            document.getElementById('prev-btn').classList.toggle('hidden', currentPage === 0);
            document.getElementById('next-btn').classList.toggle('hidden', currentPage >= totalPages - 1);

            // Update page info
            document.getElementById('page-info').textContent = totalPages > 1 ? `Page ${currentPage + 1} of ${totalPages}` : '';

            // Update page dots
            if (totalPages > 1) {
                document.getElementById('page-dots').innerHTML = Array.from({length: totalPages}, (_, i) => `
                    <button onclick="goToPage(${i})" class="w-2.5 h-2.5 rounded-full transition-all ${i === currentPage ? 'bg-blue-500 w-6' : 'bg-white/30 hover:bg-white/50'}"></button>
                `).join('');
            } else {
                document.getElementById('page-dots').innerHTML = '';
            }
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
            document.getElementById('modal-binds').innerHTML = '';
            // Apply catalog defaults for network mode
            document.getElementById('modal-network').value = app.networkMode || 'bridge';
            document.getElementById('modal-network-name').value = '';
            document.getElementById('modal-restart').value = 'always';
            document.getElementById('modal-memory').value = '';
            document.getElementById('modal-cpu').value = '';
            document.getElementById('modal-hostname').value = '';
            document.getElementById('modal-privileged').checked = false;
            document.getElementById('modal-tty').checked = true;
            document.getElementById('modal-interactive').checked = true;
            document.getElementById('modal-caps').value = '';
            (app.ports || []).forEach(p => addPort(p.h, p.c));
            if ((app.ports || []).length === 0) addPort();
            // Apply catalog environment variables
            Object.entries(app.env || {}).forEach(([k, v]) => addEnv(k, v));
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

        function addBind(host = '', container = '', readonly = false) {
            const div = document.createElement('div');
            div.className = 'flex gap-2 items-center';
            div.innerHTML = `<input type="text" placeholder="/host/path" value="${host}" class="flex-1 px-3 py-2 rounded-lg"><input type="text" placeholder="/container/path" value="${container}" class="flex-1 px-3 py-2 rounded-lg"><label class="flex items-center gap-1 text-xs text-gray-400"><input type="checkbox" ${readonly ? 'checked' : ''} class="w-3 h-3">RO</label><button type="button" onclick="this.parentElement.remove()" class="px-3 text-red-400">&times;</button>`;
            document.getElementById('modal-binds').appendChild(div);
        }

        document.getElementById('install-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('modal-error');
            const name = document.getElementById('modal-name').value;
            const image = document.getElementById('modal-image').value;
            const networkMode = document.getElementById('modal-network').value;
            const networkName = document.getElementById('modal-network-name').value;
            const restartPolicy = document.getElementById('modal-restart').value;
            const memory = document.getElementById('modal-memory').value;
            const cpu = document.getElementById('modal-cpu').value;
            const hostname = document.getElementById('modal-hostname').value;
            const privileged = document.getElementById('modal-privileged').checked;
            const tty = document.getElementById('modal-tty').checked;
            const interactive = document.getElementById('modal-interactive').checked;
            const caps = document.getElementById('modal-caps').value.split(',').map(c => c.trim()).filter(c => c);
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
            const binds = [...document.getElementById('modal-binds').querySelectorAll('div')].map(d => {
                const inputs = d.querySelectorAll('input');
                return { host: inputs[0].value, container: inputs[1].value, readonly: inputs[2]?.checked || false };
            }).filter(b => b.host && b.container);
            const dockerConfig = { networkMode, networkName, restartPolicy, memory, cpu, hostname, privileged, tty, interactive, caps, binds };
            try {
                const isEdit = currentApp && currentApp.isEdit;
                const url = isEdit ? `/api/apps/${currentApp.id}` : '/api/apps';
                const method = isEdit ? 'PATCH' : 'POST';
                const body = isEdit 
                    ? { name, image, iconUrl: currentApp.iconUrl, ports, environment, volumes, dockerConfig }
                    : { id: currentApp.id || name.toLowerCase().replace(/\s+/g, '-'), name, image, iconUrl: currentApp.iconUrl, ports, environment, volumes, dockerConfig };
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
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
            const dc = app.dockerConfig || {};
            currentApp = { ...app, iconUrl: app.icon_url || (catalogApp ? catalogApp.iconUrl : ''), isEdit: true };
            document.getElementById('modal-icon').src = currentApp.iconUrl || 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png';
            document.getElementById('modal-title').textContent = app.name + ' (Edit)';
            document.getElementById('modal-desc').textContent = 'Modify app settings';
            document.getElementById('modal-name').value = app.name;
            document.getElementById('modal-image').value = app.image;
            document.getElementById('modal-ports').innerHTML = '';
            document.getElementById('modal-env').innerHTML = '';
            document.getElementById('modal-volumes').innerHTML = '';
            document.getElementById('modal-binds').innerHTML = '';
            document.getElementById('modal-network').value = dc.networkMode || 'bridge';
            document.getElementById('modal-network-name').value = dc.networkName || '';
            document.getElementById('modal-restart').value = dc.restartPolicy || 'always';
            document.getElementById('modal-memory').value = dc.memory || '';
            document.getElementById('modal-cpu').value = dc.cpu || '';
            document.getElementById('modal-hostname').value = dc.hostname || '';
            document.getElementById('modal-privileged').checked = dc.privileged || false;
            document.getElementById('modal-tty').checked = dc.tty !== false;
            document.getElementById('modal-interactive').checked = dc.interactive !== false;
            document.getElementById('modal-caps').value = (dc.caps || []).join(', ');
            (app.ports || []).forEach(p => addPort(p.host || p.h, p.container || p.c));
            Object.entries(app.environment || {}).forEach(([k, v]) => addEnv(k, v));
            (app.volumes || []).forEach(v => addVolume(v.host, v.container));
            (dc.binds || []).forEach(b => addBind(b.host, b.container, b.readonly));
            document.getElementById('modal-error').classList.add('hidden');
            document.getElementById('modal-submit').textContent = 'Save Changes';
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
