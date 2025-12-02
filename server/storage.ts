import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { 
  type User,
  type InsertUser,
  type Session,
  type InsertSession,
  type InstalledApp, 
  type InsertInstalledApp,
  type Settings,
  type InsertSettings
} from "@shared/schema";

// Determine database path
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'dockpilot.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS installed_apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    icon TEXT,
    category TEXT,
    description TEXT,
    container_id TEXT,
    status TEXT DEFAULT 'stopped',
    ports TEXT,
    environment TEXT,
    volumes TEXT,
    docker_config TEXT,
    installed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    server_name TEXT DEFAULT 'DockPilot-Home',
    web_port INTEGER DEFAULT 8080,
    data_path TEXT DEFAULT '/opt/dockpilot/data',
    start_on_boot INTEGER DEFAULT 1,
    auto_update INTEGER DEFAULT 0,
    auto_prune INTEGER DEFAULT 0,
    analytics INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO settings (id) VALUES ('default');
`);

export interface IStorage {
  // Users
  getUserCount(): Promise<number>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Sessions
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  // Installed Apps
  getInstalledApps(): Promise<InstalledApp[]>;
  getInstalledApp(id: string): Promise<InstalledApp | undefined>;
  createInstalledApp(app: InsertInstalledApp): Promise<InstalledApp>;
  updateInstalledApp(id: string, app: Partial<InsertInstalledApp>): Promise<InstalledApp | undefined>;
  deleteInstalledApp(id: string): Promise<void>;

  // Settings
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at ? new Date(row.created_at) : new Date()
  };
}

function rowToSession(row: any): Session {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: new Date(row.expires_at),
    createdAt: row.created_at ? new Date(row.created_at) : new Date()
  };
}

function rowToApp(row: any): InstalledApp {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    icon: row.icon,
    category: row.category,
    description: row.description,
    containerId: row.container_id,
    status: row.status,
    ports: row.ports ? JSON.parse(row.ports) : null,
    environment: row.environment ? JSON.parse(row.environment) : null,
    volumes: row.volumes ? JSON.parse(row.volumes) : null,
    dockerConfig: row.docker_config ? JSON.parse(row.docker_config) : null,
    installedAt: row.installed_at ? new Date(row.installed_at) : new Date()
  };
}

function rowToSettings(row: any): Settings {
  return {
    id: row.id,
    serverName: row.server_name,
    webPort: row.web_port,
    dataPath: row.data_path,
    startOnBoot: Boolean(row.start_on_boot),
    autoUpdate: Boolean(row.auto_update),
    autoPrune: Boolean(row.auto_prune),
    analytics: Boolean(row.analytics),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
  };
}

export class DbStorage implements IStorage {
  // Users
  async getUserCount(): Promise<number> {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    return result.count;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return row ? rowToUser(row) : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? rowToUser(row) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
      .run(user.id, user.username, user.passwordHash);
    return this.getUserById(user.id) as Promise<User>;
  }

  // Sessions
  async getSession(id: string): Promise<Session | undefined> {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return row ? rowToSession(row) : undefined;
  }

  async createSession(session: InsertSession): Promise<Session> {
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .run(session.id, session.userId, session.expiresAt.toISOString());
    return this.getSession(session.id) as Promise<Session>;
  }

  async deleteSession(id: string): Promise<void> {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  async deleteExpiredSessions(): Promise<void> {
    db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  }

  // Installed Apps
  async getInstalledApps(): Promise<InstalledApp[]> {
    const rows = db.prepare('SELECT * FROM installed_apps ORDER BY installed_at DESC').all();
    return rows.map(rowToApp);
  }

  async getInstalledApp(id: string): Promise<InstalledApp | undefined> {
    const row = db.prepare('SELECT * FROM installed_apps WHERE id = ?').get(id);
    return row ? rowToApp(row) : undefined;
  }

  async createInstalledApp(app: InsertInstalledApp): Promise<InstalledApp> {
    const id = app.id || crypto.randomUUID();
    db.prepare(`
      INSERT INTO installed_apps (id, name, image, icon, category, description, container_id, status, ports, environment, volumes, docker_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      app.name,
      app.image,
      app.icon || null,
      app.category || null,
      app.description || null,
      app.containerId || null,
      app.status || 'stopped',
      app.ports ? JSON.stringify(app.ports) : null,
      app.environment ? JSON.stringify(app.environment) : null,
      app.volumes ? JSON.stringify(app.volumes) : null,
      app.dockerConfig ? JSON.stringify(app.dockerConfig) : null
    );
    return this.getInstalledApp(id) as Promise<InstalledApp>;
  }

  async updateInstalledApp(id: string, app: Partial<InsertInstalledApp>): Promise<InstalledApp | undefined> {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (app.name !== undefined) { updates.push('name = ?'); values.push(app.name); }
    if (app.image !== undefined) { updates.push('image = ?'); values.push(app.image); }
    if (app.icon !== undefined) { updates.push('icon = ?'); values.push(app.icon); }
    if (app.category !== undefined) { updates.push('category = ?'); values.push(app.category); }
    if (app.description !== undefined) { updates.push('description = ?'); values.push(app.description); }
    if (app.containerId !== undefined) { updates.push('container_id = ?'); values.push(app.containerId); }
    if (app.status !== undefined) { updates.push('status = ?'); values.push(app.status); }
    if (app.ports !== undefined) { updates.push('ports = ?'); values.push(JSON.stringify(app.ports)); }
    if (app.environment !== undefined) { updates.push('environment = ?'); values.push(JSON.stringify(app.environment)); }
    if (app.volumes !== undefined) { updates.push('volumes = ?'); values.push(JSON.stringify(app.volumes)); }
    if (app.dockerConfig !== undefined) { updates.push('docker_config = ?'); values.push(JSON.stringify(app.dockerConfig)); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE installed_apps SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    return this.getInstalledApp(id);
  }

  async deleteInstalledApp(id: string): Promise<void> {
    db.prepare('DELETE FROM installed_apps WHERE id = ?').run(id);
  }

  // Settings
  async getSettings(): Promise<Settings | undefined> {
    const row = db.prepare('SELECT * FROM settings WHERE id = ?').get('default');
    return row ? rowToSettings(row) : undefined;
  }

  async updateSettings(updatedSettings: Partial<InsertSettings>): Promise<Settings> {
    const updates: string[] = ['updated_at = datetime("now")'];
    const values: any[] = [];
    
    if (updatedSettings.serverName !== undefined) { updates.push('server_name = ?'); values.push(updatedSettings.serverName); }
    if (updatedSettings.webPort !== undefined) { updates.push('web_port = ?'); values.push(updatedSettings.webPort); }
    if (updatedSettings.dataPath !== undefined) { updates.push('data_path = ?'); values.push(updatedSettings.dataPath); }
    if (updatedSettings.startOnBoot !== undefined) { updates.push('start_on_boot = ?'); values.push(updatedSettings.startOnBoot ? 1 : 0); }
    if (updatedSettings.autoUpdate !== undefined) { updates.push('auto_update = ?'); values.push(updatedSettings.autoUpdate ? 1 : 0); }
    if (updatedSettings.autoPrune !== undefined) { updates.push('auto_prune = ?'); values.push(updatedSettings.autoPrune ? 1 : 0); }
    if (updatedSettings.analytics !== undefined) { updates.push('analytics = ?'); values.push(updatedSettings.analytics ? 1 : 0); }

    if (values.length > 0) {
      db.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = 'default'`).run(...values);
    }
    
    return this.getSettings() as Promise<Settings>;
  }
}

export const storage = new DbStorage();
