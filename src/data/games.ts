export interface GameData {
  name: string;
  players: string[];
  icon: string;
  lastUpdated: number;
}

export const allGames: GameData[] = [
  {
    name: "eggwars-solo",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/eggwars.png",
    lastUpdated: Date.now()
  },
  {
    name: "eggwars-teams-of-2",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/eggwars.png",
    lastUpdated: Date.now()
  },
  {
    name: "eggwars-teams-of-4",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/eggwars.png",
    lastUpdated: Date.now()
  },
  {
    name: "eggwars-mega",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/eggwars.png",
    lastUpdated: Date.now()
  },
  {
    name: "eggwars-duels",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/eggwars.png",
    lastUpdated: Date.now()
  },
  {
    name: "skywars-solo",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/skywars.png",
    lastUpdated: Date.now()
  },
  {
    name: "skywars-teams-of-2",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/skywars.png",
    lastUpdated: Date.now()
  },
  {
    name: "skywars-teams-of-4",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/skywars.png",
    lastUpdated: Date.now()
  },
  {
    name: "skywars-mega",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/skywars.png",
    lastUpdated: Date.now()
  },
  {
    name: "skywars-duels",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/skywars.png",
    lastUpdated: Date.now()
  },
  {
    name: "parkour",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/parkour.png",
    lastUpdated: Date.now()
  },
  {
    name: "lucky-blocks-solo",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/lucky-blocks.png",
    lastUpdated: Date.now()
  },
  {
    name: "lucky-blocks-teams-of-4",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/lucky-blocks.png",
    lastUpdated: Date.now()
  },
  {
    name: "blockwars-bridges",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/blockwars.png",
    lastUpdated: Date.now()
  },
  {
    name: "blockwars-ctf",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/blockwars.png",
    lastUpdated: Date.now()
  },
  {
    name: "survival-games-solo",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/survival-games.png",
    lastUpdated: Date.now()
  },
  {
    name: "survival-games-teams-of-2",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/survival-games.png",
    lastUpdated: Date.now()
  },
  {
    name: "minerware",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/minerware.png",
    lastUpdated: Date.now()
  },
  {
    name: "battle-arena-duels",
    players: [],
    icon: "https://cubecraftcdn.com/bedrock/game_icons/battle-arena.png",
    lastUpdated: Date.now()
  }
];

export function getGameData(gameName: string): GameData | undefined {
  return allGames.find(g => g.name.toLowerCase() === gameName.toLowerCase());
}

export function getAllGameIcons(): Record<string, string> {
  const icons: Record<string, string> = {};
  allGames.forEach(game => {
    icons[game.name] = game.icon;
  });
  return icons;
}
