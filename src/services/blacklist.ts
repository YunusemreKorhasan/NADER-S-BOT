import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BLACKLIST_FILE = path.join(__dirname, '../../logs/blacklist.json');

// Ensure logs directory exists
const logsDir = path.dirname(BLACKLIST_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export interface BlacklistEntry {
  userId: string;
  username: string;
  reason?: string;
  dateAdded: string;
}

function loadBlacklist(): BlacklistEntry[] {
  try {
    if (fs.existsSync(BLACKLIST_FILE)) {
      const data = fs.readFileSync(BLACKLIST_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading blacklist:', error);
  }
  return [];
}

function saveBlacklist(list: BlacklistEntry[]): void {
  try {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(list, null, 2));
  } catch (error) {
    console.error('Error saving blacklist:', error);
  }
}

export function isBlacklisted(userId: string): boolean {
  const blacklist = loadBlacklist();
  return blacklist.some(entry => entry.userId === userId);
}

export function addToBlacklist(userId: string, username: string, reason?: string): void {
  const blacklist = loadBlacklist();
  
  // Check if already blacklisted
  if (blacklist.some(entry => entry.userId === userId)) {
    console.warn(`User ${username} (${userId}) is already blacklisted`);
    return;
  }
  
  blacklist.push({
    userId,
    username,
    reason,
    dateAdded: new Date().toISOString()
  });
  
  saveBlacklist(blacklist);
  console.log(`✅ User ${username} (${userId}) added to blacklist`);
}

export function removeFromBlacklist(userId: string): boolean {
  const blacklist = loadBlacklist();
  const initialLength = blacklist.length;
  
  const filtered = blacklist.filter(entry => entry.userId !== userId);
  
  if (filtered.length < initialLength) {
    saveBlacklist(filtered);
    console.log(`✅ User ${userId} removed from blacklist`);
    return true;
  }
  
  console.warn(`User ${userId} not found in blacklist`);
  return false;
}

export function getBlacklist(): BlacklistEntry[] {
  return loadBlacklist();
}

export function clearBlacklist(): void {
  saveBlacklist([]);
  console.log(`✅ Blacklist cleared`);
}
