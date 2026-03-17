import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '../../logs/bot-config.json');

// Ensure logs directory exists
const logsDir = path.dirname(CONFIG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export interface BotConfig {
  status?: string;
  activity?: {
    name: string;
    type: number;
  };
}

function loadConfig(): BotConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return {};
}

function saveConfig(config: BotConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

export function getConfig(): BotConfig {
  return loadConfig();
}

export function updateConfig(config: Partial<BotConfig>): void {
  const current = loadConfig();
  const updated = { ...current, ...config };
  saveConfig(updated);
  console.log('✅ Bot configuration saved');
}

export function clearConfig(): void {
  saveConfig({});
  console.log('✅ Bot configuration cleared');
}
