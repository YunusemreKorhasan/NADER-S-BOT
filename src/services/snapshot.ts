import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LeaderboardEntry } from './cubecraft-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotDir = path.join(__dirname, '../data/snapshots');

// Ensure snapshots directory exists
if (!fs.existsSync(snapshotDir)) {
  fs.mkdirSync(snapshotDir, { recursive: true });
}

interface TimelineSnapshot {
  game: string;
  timestamp: number;
  entries: Array<{ username: string; value: number }>;
}

function getTodayKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayKey(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekKey(date: Date): string {
  // Sunday is start of week
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek;
  const weekStart = new Date(d.setDate(diff));
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}-week`;
}

function getLastWeekKey(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return getWeekKey(date);
}

function getMonthKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-month`;
}

function getLastMonthKey(): string {
  const date = new Date();
  // Use UTC to avoid timezone shifts
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // getUTCMonth is 0-indexed
  
  // If it's January (0), last month was December (11) of previous year
  if (month === 0) {
    return `${year - 1}-12-month`;
  }
  
  const lastMonth = String(month).padStart(2, '0');
  return `${year}-${lastMonth}-month`;
}

function normalizeGameName(game: string): string {
  return game.toLowerCase()
    .trim()
    .replace(/[\s/]/g, '-')
    .replace(/-+/g, '-');
}

function saveSnapshot(game: string, entries: LeaderboardEntry[], period: 'daily' | 'weekly' | 'monthly'): void {
  const normalizedGame = normalizeGameName(game);
  const fileName = period === 'daily'
    ? `${normalizedGame}_daily_${getTodayKey()}.json`
    : period === 'weekly'
    ? `${normalizedGame}_weekly_${getWeekKey(new Date())}.json`
    : `${normalizedGame}_monthly_${getMonthKey()}.json`;
  
  const filePath = path.join(snapshotDir, fileName);
  
  const snapshot: TimelineSnapshot = {
    game,
    timestamp: Date.now(),
    entries: entries.map(e => ({ username: e.username, value: e.value }))
  };
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  } catch (error) {
    console.error('Failed to save snapshot:', error);
  }
}

function loadPreviousSnapshot(game: string, period: 'daily' | 'weekly' | 'monthly'): TimelineSnapshot | null {
  const normalizedGame = normalizeGameName(game);
  const fileName = period === 'daily'
    ? `${normalizedGame}_daily_${getYesterdayKey()}.json`
    : period === 'weekly'
    ? `${normalizedGame}_weekly_${getLastWeekKey()}.json`
    : `${normalizedGame}_monthly_${getLastMonthKey()}.json`;
  
  const filePath = path.join(snapshotDir, fileName);
  
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load previous snapshot:', error);
  }
  
  return null;
}

export function calculatePeriodWins(
  currentEntries: LeaderboardEntry[],
  game: string,
  period: 'daily' | 'weekly' | 'monthly'
): LeaderboardEntry[] {
  // Load previous period snapshot
  const previousSnapshot = loadPreviousSnapshot(game, period);
  
  // Save current snapshot for this period
  saveSnapshot(game, currentEntries, period);
  
  // If no previous snapshot, return empty entries for deltas
  if (!previousSnapshot) {
    return currentEntries.map(e => ({ ...e, value: 0 }));
  }
  
  // Create a map of previous values
  const prevEntries = previousSnapshot.entries.sort((a, b) => b.value - a.value);
  const prevMap = new Map(prevEntries.map(e => [e.username.toLowerCase(), e.value]));
  
  // Find the wins of the 50th player in the previous snapshot
  // If there are fewer than 50, use the last player's wins or 0
  const p50Value = prevEntries.length >= 50 
    ? prevEntries[49].value 
    : (prevEntries.length > 0 ? prevEntries[prevEntries.length - 1].value : 0);
  
  // Calculate period wins as difference
  const periodEntries: LeaderboardEntry[] = [];
  
  for (const entry of currentEntries) {
    const usernameLow = entry.username.toLowerCase();
    let prevValue = 0;
    
    if (prevMap.has(usernameLow)) {
      prevValue = prevMap.get(usernameLow) || 0;
    } else {
      // New player on leaderboard: assume their "starting" value was p50Value
      // so we only count wins earned ABOVE the previous leaderboard entry threshold
      prevValue = p50Value;
    }
      
    const periodWins = Math.max(0, entry.value - prevValue);
    
    // Only include players who have earned at least 1 win in this period
    // This makes the period leaderboards much cleaner
    if (periodWins > 0) {
      periodEntries.push({
        ...entry,
        value: periodWins
      });
    }
  }
  
  // If no one earned wins yet today, return top players with 0 for display
  if (periodEntries.length === 0) {
    return currentEntries.slice(0, 10).map(e => ({ ...e, value: 0 }));
  }
  
  // Sort by period wins descending
  periodEntries.sort((a, b) => b.value - a.value);
  
  // Reorder positions after sorting
  return periodEntries.map((entry, index) => ({
    ...entry,
    position: index + 1
  }));
}

export function cleanOldSnapshots(daysToKeep: number = 90): void {
  try {
    const files = fs.readdirSync(snapshotDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      const filePath = path.join(snapshotDir, file);
      const stat = fs.statSync(filePath);
      
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Failed to clean old snapshots:', error);
  }
}
