import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export interface ActivityLog {
  timestamp: string;
  type: 'command' | 'guild_join' | 'guild_leave' | 'dm' | 'invite';
  userId?: string;
  username?: string;
  guildId?: string;
  guildName?: string;
  commandName?: string;
  content?: string;
  details?: Record<string, any>;
}

function getLogsPath(type: string): string {
  const today = new Date().toISOString().split('T')[0];
  return path.join(LOGS_DIR, `${type}_${today}.json`);
}

function loadLogs(logPath: string): ActivityLog[] {
  try {
    if (fs.existsSync(logPath)) {
      const data = fs.readFileSync(logPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  }
  return [];
}

function saveLogs(logPath: string, logs: ActivityLog[]): void {
  try {
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error saving logs:', error);
  }
}

export function logCommandUsage(
  userId: string,
  username: string,
  commandName: string,
  guildId?: string,
  guildName?: string
): void {
  const logPath = getLogsPath('commands');
  const logs = loadLogs(logPath);
  
  logs.push({
    timestamp: new Date().toISOString(),
    type: 'command',
    userId,
    username,
    commandName,
    guildId,
    guildName
  });
  
  saveLogs(logPath, logs);
}

export function logGuildJoin(
  guildId: string,
  guildName: string,
  memberCount: number,
  ownerId: string
): void {
  const logPath = getLogsPath('guild_joins');
  const logs = loadLogs(logPath);
  
  logs.push({
    timestamp: new Date().toISOString(),
    type: 'guild_join',
    guildId,
    guildName,
    details: { memberCount, ownerId }
  });
  
  saveLogs(logPath, logs);
}

export function logGuildLeave(guildId: string, guildName: string): void {
  const logPath = getLogsPath('guild_leaves');
  const logs = loadLogs(logPath);
  
  logs.push({
    timestamp: new Date().toISOString(),
    type: 'guild_leave',
    guildId,
    guildName
  });
  
  saveLogs(logPath, logs);
}

export function logDM(userId: string, username: string, content: string): void {
  const logPath = getLogsPath('dms');
  const logs = loadLogs(logPath);
  
  logs.push({
    timestamp: new Date().toISOString(),
    type: 'dm',
    userId,
    username,
    content: content.substring(0, 200) // Limit content length
  });
  
  saveLogs(logPath, logs);
}

export function getAllLogs(type?: string, limit: number = 100): ActivityLog[] {
  const today = new Date().toISOString().split('T')[0];
  const files = fs.readdirSync(LOGS_DIR);
  const allLogs: ActivityLog[] = [];

  const relevantFiles = type
    ? files.filter(f => f.startsWith(type) && f.includes(today))
    : files.filter(f => f.includes(today));

  for (const file of relevantFiles) {
    const filePath = path.join(LOGS_DIR, file);
    const logs = loadLogs(filePath);
    allLogs.push(...logs);
  }

  return allLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getLogsStats(): Record<string, number> {
  const today = new Date().toISOString().split('T')[0];
  const files = fs.readdirSync(LOGS_DIR);
  const stats: Record<string, number> = {};

  for (const file of files) {
    if (file.includes(today)) {
      const filePath = path.join(LOGS_DIR, file);
      const logs = loadLogs(filePath);
      const type = file.split('_')[0];
      stats[type] = (stats[type] || 0) + logs.length;
    }
  }

  return stats;
}
