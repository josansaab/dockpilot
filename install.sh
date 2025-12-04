#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

APP_DIR="/opt/dockpilot"
SERVICE_NAME="dockpilot"
PORT=8080
GITHUB_REPO="https://github.com/josansaab/dockpilot.git"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║       ██████╗  ██████╗  ██████╗██╗  ██╗                      ║"
echo "║       ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝                      ║"
echo "║       ██║  ██║██║   ██║██║     █████╔╝                       ║"
echo "║       ██║  ██║██║   ██║██║     ██╔═██╗                       ║"
echo "║       ██████╔╝╚██████╔╝╚██████╗██║  ██╗                      ║"
echo "║       ╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝                      ║"
echo "║                                                               ║"
echo "║       ██████╗ ██╗██╗      ██████╗ ████████╗                  ║"
echo "║       ██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝                  ║"
echo "║       ██████╔╝██║██║     ██║   ██║   ██║                     ║"
echo "║       ██╔═══╝ ██║██║     ██║   ██║   ██║                     ║"
echo "║       ██║     ██║███████╗╚██████╔╝   ██║                     ║"
echo "║       ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝                     ║"
echo "║                                                               ║"
echo "║              Docker Container Management GUI                  ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Check for supported OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS. This script supports Ubuntu/Debian.${NC}"
    exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo -e "${YELLOW}Warning: This script is tested on Ubuntu/Debian. Your OS ($OS) may not be fully supported.${NC}"
fi

echo -e "${GREEN}[1/7]${NC} Updating system packages..."
apt update -qq

echo -e "${GREEN}[2/7]${NC} Installing dependencies..."
apt install -y -qq curl git

# Install storage management tools (RAID and ZFS)
echo -e "${GREEN}[2/7]${NC} Installing storage management tools..."
apt install -y -qq mdadm
apt install -y -qq zfsutils-linux 2>/dev/null || echo -e "${YELLOW}ZFS not available on this system (kernel module may be missing)${NC}"

# Install Node.js if not present or version is too old
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    echo -e "${GREEN}[2/7]${NC} Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo -e "${GREEN}[3/7]${NC} Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo -e "${GREEN}[3/7]${NC} Docker already installed"
fi

# Add current user to docker group
if [ -n "$SUDO_USER" ]; then
    usermod -aG docker $SUDO_USER
fi

echo -e "${GREEN}[4/7]${NC} Removing old installation if exists..."
# Stop service if running
systemctl stop $SERVICE_NAME 2>/dev/null || true
systemctl disable $SERVICE_NAME 2>/dev/null || true
rm -rf $APP_DIR
rm -f /etc/systemd/system/$SERVICE_NAME.service

echo -e "${GREEN}[5/7]${NC} Cloning DockPilot from GitHub..."
git clone --depth 1 $GITHUB_REPO $APP_DIR

echo -e "${GREEN}[6/7]${NC} Installing Node.js dependencies..."
cd $APP_DIR

# Install build tools for native modules (better-sqlite3)
apt install -y -qq build-essential python3

npm install --production --silent
npm install systeminformation better-sqlite3 --save --silent

# Rebuild native modules
npm rebuild better-sqlite3 --silent 2>/dev/null || true

# Create data directory
mkdir -p $APP_DIR/data

echo -e "${GREEN}[7/7]${NC} Setting up systemd service..."

# Determine the user to run the service
RUN_USER=${SUDO_USER:-root}

cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=DockPilot - Docker Container Management GUI
Documentation=https://github.com/josansaab/dockpilot
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
Group=docker
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/dist/index.cjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dockpilot

# Environment
Environment=NODE_ENV=production
Environment=PORT=$PORT

# Security hardening
NoNewPrivileges=false
ProtectSystem=false
ProtectHome=false

[Install]
WantedBy=multi-user.target
EOF

# Build the application if build script exists
if [ -f "$APP_DIR/package.json" ] && grep -q '"build"' "$APP_DIR/package.json"; then
    echo -e "${YELLOW}Building application...${NC}"
    npm run build --silent 2>/dev/null || true
fi

# Reload systemd and start service
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# Wait for service to start
sleep 3

# Check if service is running
if systemctl is-active --quiet $SERVICE_NAME; then
    STATUS="${GREEN}Running${NC}"
else
    STATUS="${RED}Failed to start${NC}"
    echo -e "${RED}Service failed to start. Check logs with: journalctl -u $SERVICE_NAME -f${NC}"
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║          DockPilot Installation Complete!                     ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Status: $STATUS                                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Access your dashboard:                                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    ${CYAN}http://$SERVER_IP:$PORT${NC}                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    ${CYAN}http://localhost:$PORT${NC}                                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Manage the service:                                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    ${YELLOW}sudo systemctl status $SERVICE_NAME${NC}                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    ${YELLOW}sudo systemctl restart $SERVICE_NAME${NC}                     ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    ${YELLOW}sudo journalctl -u $SERVICE_NAME -f${NC}                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}First time? Create your admin account at the web interface.${NC}"
echo ""
