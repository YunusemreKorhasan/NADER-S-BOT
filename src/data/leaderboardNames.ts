export const leaderboardNamesMapping: Record<string | number, string> = {
  '0': 'Eggwars Duels',
  '1': 'Buy N Build',
  '2': 'Ender',
  '3': 'Disasters',
  '4': 'Lucky Blocks Solo',
  '5': 'Lucky Blocks Teams',
  '6': 'SkyWars Solo',
  '7': 'SkyWars Teams',
  '8': 'Battle Arena',
  '9': 'MinerWare',
  '10': 'BlockWars Bridges',
  '11': 'BlockWars CTF',
  '12': 'Survival Games',
  '13': 'Parkour',
  '14': 'Parkour Challenge',
  '15': 'Void Run',
  '16': 'Speed Builders',
  '17': 'Sky Builders',
  '18': 'Race',
  '19': 'Tower Stack',
};

export function getLeaderboardName(gameId: string | number): string {
  const idStr = String(gameId);
  
  // Direct numeric lookup
  if (leaderboardNamesMapping[idStr]) {
    return leaderboardNamesMapping[idStr];
  }
  
  // Try lowercase
  const lowerStr = idStr.toLowerCase();
  if (leaderboardNamesMapping[lowerStr]) {
    return leaderboardNamesMapping[lowerStr];
  }
  
  // Remove "legacy-games-" and "legacy game" prefixes
  let cleanedStr = idStr
    .replace(/legacy-games-/gi, '')
    .replace(/legacy\s*game\s*/gi, '')
    .replace(/-/g, ' ')
    .trim();
  
  // Apply Title Case formatting
  return (cleanedStr || idStr)
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
