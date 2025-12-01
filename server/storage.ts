import { eq, lt } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { 
  users,
  sessions,
  installedApps, 
  settings,
  type User,
  type InsertUser,
  type Session,
  type InsertSession,
  type InstalledApp, 
  type InsertInstalledApp,
  type Settings,
  type InsertSettings
} from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

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

export class DbStorage implements IStorage {
  // Users
  async getUserCount(): Promise<number> {
    const result = await db.select().from(users);
    return result.length;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values([user]).returning();
    return result[0];
  }

  // Sessions
  async getSession(id: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id));
    return result[0];
  }

  async createSession(session: InsertSession): Promise<Session> {
    const result = await db.insert(sessions).values([session]).returning();
    return result[0];
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  // Installed Apps
  async getInstalledApps(): Promise<InstalledApp[]> {
    return await db.select().from(installedApps);
  }

  async getInstalledApp(id: string): Promise<InstalledApp | undefined> {
    const result = await db.select().from(installedApps).where(eq(installedApps.id, id));
    return result[0];
  }

  async createInstalledApp(app: InsertInstalledApp): Promise<InstalledApp> {
    const result = await db.insert(installedApps).values([app]).returning();
    return result[0];
  }

  async updateInstalledApp(id: string, app: Partial<InsertInstalledApp>): Promise<InstalledApp | undefined> {
    const result = await db
      .update(installedApps)
      .set(app as any)
      .where(eq(installedApps.id, id))
      .returning();
    return result[0];
  }

  async deleteInstalledApp(id: string): Promise<void> {
    await db.delete(installedApps).where(eq(installedApps.id, id));
  }

  // Settings
  async getSettings(): Promise<Settings | undefined> {
    const result = await db.select().from(settings);
    if (result.length === 0) {
      // Initialize default settings
      const defaultSettings = await db
        .insert(settings)
        .values({ id: 'default' })
        .returning();
      return defaultSettings[0];
    }
    return result[0];
  }

  async updateSettings(updatedSettings: Partial<InsertSettings>): Promise<Settings> {
    const current = await this.getSettings();
    const result = await db
      .update(settings)
      .set({ ...updatedSettings, updatedAt: new Date() })
      .where(eq(settings.id, current?.id || 'default'))
      .returning();
    return result[0];
  }
}

export const storage = new DbStorage();
