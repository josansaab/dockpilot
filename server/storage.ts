import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { 
  installedApps, 
  settings,
  type InstalledApp, 
  type InsertInstalledApp,
  type Settings,
  type InsertSettings
} from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export interface IStorage {
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
