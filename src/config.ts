export const config = {
  colors: {
    primary: 0xFF6B35,
    secondary: 0x4A90E2,
    background: 0x2C2F33,
    accent: 0x7289DA,
    success: 0x43B581,
    error: 0xED4245,
  },
  cubecraftApi: {
    baseUrl: 'https://api.cc-data.ru',
  },
  gameModes: [
    { name: 'EggWars Solo', value: 'eggwars-solo', emoji: '🥚' },
    { name: 'EggWars Teams of 2', value: 'eggwars-teams-of-2', emoji: '🥚' },
    { name: 'EggWars Teams of 4', value: 'eggwars-teams-of-4', emoji: '🥚' },
    { name: 'EggWars Mega', value: 'eggwars-mega', emoji: '🥚' },
    { name: 'EggWars Duels', value: 'eggwars-duels', emoji: '🥚' },
    { name: 'SkyWars Solo', value: 'skywars-solo', emoji: '🌌' },
    { name: 'SkyWars Teams of 2', value: 'skywars-teams-of-2', emoji: '🌌' },
    { name: 'SkyWars Teams of 4', value: 'skywars-teams-of-4', emoji: '🌌' },
    { name: 'SkyWars Mega', value: 'skywars-mega', emoji: '🌌' },
    { name: 'SkyWars Duels', value: 'skywars-duels', emoji: '🌌' },
    { name: 'Parkour', value: 'parkour', emoji: '🏃' },
  ],
  xpGameModes: [
    { name: 'EggWars', value: 'eggwars-teams-of-1/2/4/10', emoji: '🥚' },
    { name: 'SkyWars', value: 'skywars-teams-of-1/2/4/10', emoji: '🌌' },
    { name: 'Lucky Islands', value: 'lucky-blocks-teams-of-1/4', emoji: '🍀' },
    { name: 'BlockWars Bridges', value: 'blockwars-bridges', emoji: '🧱' },
    { name: 'BlockWars CTF', value: 'blockwars-ctf', emoji: '🧱' },
    { name: 'Survival Games', value: 'survival-games-teams-of-1/2', emoji: '⚔️' },
    { name: 'MinerWare', value: 'minerware', emoji: '⛏️' },
    { name: 'Battle Arena', value: 'battle-arena-duels', emoji: '🤺' },
    { name: 'Parkour', value: 'parkour', emoji: '🏃' },
  ],
} as const;

export type GameMode = typeof config.gameModes[number]['value'];
export type XpGameMode = typeof config.xpGameModes[number]['value'];
