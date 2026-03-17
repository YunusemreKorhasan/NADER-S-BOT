export interface BotUpdate {
  id: string;
  date: string;
  title: string;
  changes: string[];
}

export const botUpdates: BotUpdate[] = [
  {
    id: 'update_20251201_001',
    date: '2025-12-01',
    title: 'Separate Updates Notifications',
    changes: [
      'Added automatic update detection system',
      'Updates are now sent as separate notifications',
      'Real-time update tracking when bot restarts'
    ]
  },
  {
    id: 'update_20251201_000',
    date: '2025-12-01',
    title: 'Status Notifications',
    changes: [
      'Added Online/Offline/Restart notifications',
      'Discord timestamp formatting',
      'Last online time tracking'
    ]
  },
  {
    id: 'update_20251130_000',
    date: '2025-11-30',
    title: 'Daily/Weekly/Monthly Leaderboards',
    changes: [
      'Fixed time period query parameters',
      'Added daily, weekly, monthly leaderboard support'
    ]
  },
  {
    id: 'update_20251129_000',
    date: '2025-11-29',
    title: 'Initial Release',
    changes: [
      'Slash commands: /player, /leaderboard, /marketplace, /help',
      'CubeCraft API integration',
      'Autocomplete for player names and items'
    ]
  }
];

export function getUpdatesSummary(): string {
  if (botUpdates.length === 0) return 'No updates available';
  
  const latest = botUpdates[0];
  return `**${latest.title}**\n${latest.changes.map(c => `• ${c}`).join('\n')}`;
}

export function getAllUpdates(): string {
  return botUpdates
    .map(update => `**${update.title}** (${update.date})\n${update.changes.map(c => `• ${c}`).join('\n')}`)
    .join('\n\n');
}

export function getUpdateById(id: string): BotUpdate | undefined {
  return botUpdates.find(u => u.id === id);
}
