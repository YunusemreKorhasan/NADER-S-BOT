export interface LeaderboardEntry {
  name: string;
  points: number;
  position: number;
}

export interface TopPlayer {
  icon: string;
  rawName: string;
  name: string;
  leaderboards: LeaderboardEntry[];
}

export const topPlayers: Record<string, TopPlayer[]> = {
  "parkour": [
    {
      icon: "https://icons.cubecraftcdn.com/render-skin?playerId=95bcc488-6717-4e41-850f-1cc9194d4e5d&default=profile/pfp_default&background=backgrounds-cube_default&border=loot-borders-default&hr=467646",
      rawName: "§r§8§lMrSterdy",
      name: "MrSterdy",
      leaderboards: [
        {
          name: "parkour",
          points: 2385,
          position: 10
        }
      ]
    }
  ],
  "eggwars-solo": [],
  "eggwars-teams-of-2": [],
  "eggwars-teams-of-4": [],
  "eggwars-mega": [],
  "eggwars-duels": [],
  "skywars-solo": [],
  "skywars-teams-of-2": [],
  "skywars-teams-of-4": [],
  "skywars-mega": [],
  "skywars-duels": [],
  "lucky-blocks-solo": [],
  "lucky-blocks-teams-of-4": [],
  "blockwars-bridges": [],
  "blockwars-ctf": [],
  "survival-games-solo": [],
  "survival-games-teams-of-2": [],
  "minerware": [],
  "battle-arena-duels": []
};

export function getTopPlayers(leaderboard: string): TopPlayer[] {
  return topPlayers[leaderboard.toLowerCase()] || [];
}

export function updateTopPlayers(leaderboard: string, players: TopPlayer[]): void {
  topPlayers[leaderboard.toLowerCase()] = players;
}

export function addTopPlayer(leaderboard: string, player: TopPlayer): void {
  const key = leaderboard.toLowerCase();
  if (!topPlayers[key]) {
    topPlayers[key] = [];
  }
  topPlayers[key].push(player);
}
