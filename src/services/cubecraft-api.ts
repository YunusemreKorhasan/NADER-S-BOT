import axios, { AxiosError } from 'axios';
import { config } from '../config.js';

const api = axios.create({
  baseURL: config.cubecraftApi.baseUrl,
  timeout: 10000,
});

export interface PlayerStats {
  username: string;
  uuid?: string;
  games: GameStats[];
  totalWins: number;
  totalKills: number;
  totalGamesPlayed: number;
  lastUpdated?: Date;
}

export interface GameStats {
  game: string;
  wins: number;
  kills: number;
  deaths: number;
  gamesPlayed: number;
  xp?: number;
  // Game-specific stats
  eggs_broken?: number;
  eliminations?: number;
  time_played?: number;
  current_win_streak?: number;
  best_win_streak?: number;
  assists?: number;
  arrows_hit?: number;
  arrows_shot?: number;
  blocks_placed?: number;
  blocks_broken?: number;
  blocks_walked?: number;
  [key: string]: any; // Allow other properties
}

export interface ServerStatus {
  online: boolean;
  players: number;
  gameModes: GameModeStatus[];
}

export interface GameModeStatus {
  name: string;
  players: number;
}

export interface LeaderboardEntry {
  position: number;
  username: string;
  value: number;
  image?: string;
}

export interface LeaderboardData {
  game: string;
  type: string;
  entries: LeaderboardEntry[];
  timePeriod?: string;
  statType?: string;
  lastUpdated?: Date;
}

export interface MarketplaceItem {
  name: string;
  price?: number;
  currency?: string;
  category?: string;
  description?: string;
  image?: string;
}

export interface XpData {
  game: string;
  levels: XpLevel[];
}

export interface XpLevel {
  level: number;
  xpRequired: number;
  totalXp: number;
}

export interface GameInfo {
  name: string;
  players: number;
  available: boolean;
}

export interface DetailedPlayer {
  username: string;
  leaderboardPositions: LeaderboardPosition[];
  stats: GameStats[];
  icon?: string;
}

export interface LeaderboardPosition {
  game: string;
  position: number;
  value: number;
  name?: string;
}

export async function getPlayerStats(username: string): Promise<PlayerStats | null> {
  try {
    const response = await api.get(`/bedrock/players/name/${encodeURIComponent(username)}`);
    const data = response.data;
    
    if (!data || data.error || data.message === "Unknown Player") {
      return null;
    }

    const games: GameStats[] = [];
    let totalWins = 0;
    let totalKills = 0;
    let totalGamesPlayed = 0;
    
    // Try to get API update time from response header or data
    let apiUpdateTime = new Date();
    if (response.headers['date']) {
      apiUpdateTime = new Date(response.headers['date']);
    } else if (data.timestamp) {
      apiUpdateTime = new Date(data.timestamp);
    } else if (data.lastUpdated) {
      apiUpdateTime = new Date(data.lastUpdated);
    }

    // Handle both array and object formats for leaderboards/stats
    if (data.leaderboards || data.stats) {
      const statsData = data.leaderboards || data.stats || data;
      
      // If it's an array, map it to games
      if (Array.isArray(statsData)) {
        statsData.forEach((entry: any) => {
          if (!entry || typeof entry !== 'object') return;
          
          const gameName = entry.name || entry.game || '';
          if (!gameName) return;
          
          const wins = entry.wins || entry.points || entry.value || 0;
          // Use wins as gamesPlayed if not available (since one win = one game at minimum)
          const kills = entry.kills ?? entry.eliminations ?? 0;
          const deaths = entry.deaths ?? 0;
          const gamesPlayed = entry.games_played ?? entry.gamesPlayed ?? entry.played ?? entry.matches ?? wins;
          const xp = entry.xp || 0;

          const isFfa = gameName.toLowerCase().includes('ffa');
          const adjustedWins = isFfa ? Math.floor(wins / 5) : wins;

          const gameStatEntry: GameStats = {
            game: gameName,
            wins,
            kills: kills > 0 ? kills : 0,
            deaths: deaths > 0 ? deaths : 0,
            gamesPlayed: gamesPlayed > 0 ? gamesPlayed : wins,
            xp,
            // Add all additional stats with better fallbacks
            eggs_broken: entry.eggs_broken ?? entry.eggsbroken ?? 0,
            eliminations: entry.eliminations ?? entry.kills ?? 0,
            time_played: entry.time_played ?? entry.timeplayed ?? 0,
            current_win_streak: entry.current_win_streak ?? entry.currentwinstreak ?? 0,
            best_win_streak: entry.best_win_streak ?? entry.bestwinstreak ?? 0,
            assists: entry.assists ?? 0,
            arrows_hit: entry.arrows_hit ?? entry.arrowshit ?? 0,
            arrows_shot: entry.arrows_shot ?? entry.arrowsshot ?? 0,
            blocks_placed: entry.blocks_placed ?? entry.blocksplaced ?? 0,
            blocks_broken: entry.blocks_broken ?? entry.blocksbroken ?? 0,
            blocks_walked: entry.blocks_walked ?? entry.blockswalked ?? 0,
          };

          // Copy all other properties from entry
          for (const key in entry) {
            if (!gameStatEntry.hasOwnProperty(key) && key !== 'name' && key !== 'position') {
              gameStatEntry[key] = entry[key];
            }
          }

          games.push(gameStatEntry);

          totalWins += adjustedWins;
          totalKills += gameStatEntry.kills;
          totalGamesPlayed += gameStatEntry.gamesPlayed;
        });
      } else {
        // Handle object format
        for (const [gameName, gameData] of Object.entries(statsData)) {
          if (typeof gameData !== 'object' || gameData === null) continue;
          const stats = gameData as Record<string, number>;
          const wins = stats.wins || stats.Wins || 0;
          const kills = stats.kills || stats.Kills || 0;
          const deaths = stats.deaths || stats.Deaths || 0;
          const gamesPlayed = stats.games_played || stats.gamesPlayed || stats.played || wins;
          const xp = stats.xp || stats.Xp || 0;

          const isFfa = gameName.toLowerCase().includes('ffa');
          const adjustedWins = isFfa ? Math.floor(wins / 5) : wins;

          games.push({
            game: gameName,
            wins,
            kills,
            deaths,
            gamesPlayed,
            xp,
          });

          totalWins += adjustedWins;
          totalKills += kills;
          totalGamesPlayed += gamesPlayed;
        }
      }
    }

    return {
      username: data.username || data.name || username,
      uuid: data.uuid,
      games,
      totalWins,
      totalKills,
      totalGamesPlayed,
      lastUpdated: apiUpdateTime,
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 404) {
        return null;
      }
    }
    throw error;
  }
}

export async function getServerStatus(): Promise<ServerStatus> {
  try {
    const response = await api.get('/bedrock/status');
    const data = response.data;

    const gameModes: GameModeStatus[] = [];
    let totalPlayers = 0;

    if (Array.isArray(data)) {
      for (const mode of data) {
        const name = mode.name || mode.game || 'Unknown';
        const players = typeof mode.value === 'number' ? mode.value : (mode.players || mode.count || 0);
        gameModes.push({ name, players });
        totalPlayers += players;
      }
    } else if (data.games) {
      for (const [name, count] of Object.entries(data.games)) {
        const playerCount = typeof count === 'number' ? count : 0;
        gameModes.push({ name, players: playerCount });
        totalPlayers += playerCount;
      }
    }

    return {
      online: true,
      players: data.players || data.totalPlayers || data.online || totalPlayers,
      gameModes: gameModes.sort((a, b) => b.players - a.players),
    };
  } catch (error) {
    return {
      online: false,
      players: 0,
      gameModes: [],
    };
  }
}

export async function getLeaderboard(
  game: string, 
  timePeriod: string = 'alltime', 
  limit: number = 10, 
  offset: number = 0
): Promise<LeaderboardData | null> {
  try {
    // Ignore timePeriod for API call - fetch all-time data
    const mode = '';
    let gameName = game;
    
    if (game === 'battle-arena' || game === 'battlearena') {
      gameName = 'battle-arena-duels';
    }
    
    // Normalize game name for API
    const apiGameName = gameName.toLowerCase().replace(' ', '-');
    
    // Build endpoint
    let endpoint = `/bedrock/leaderboards/name/${encodeURIComponent(apiGameName)}`;
    
    const response = await api.get(endpoint);
    const data = response.data;

    if (!data) {
      return null;
    }

    let allEntries: LeaderboardEntry[] = [];
    let statType = 'wins';
    
    // Extract all data first
    let rawData: any[] = [];
    if (Array.isArray(data)) {
      rawData = data;
    } else if (data.leaderboard && Array.isArray(data.leaderboard)) {
      rawData = data.leaderboard;
    } else if (data.players && Array.isArray(data.players)) {
      rawData = data.players;
    }

    // Process all entries first to detect stat type
    allEntries = rawData.map((entry: any, index: number) => {
      // Detect stat type from first entry
      if (index === 0) {
        if (entry.medals !== undefined) statType = 'medals';
        else if (entry.points !== undefined) statType = 'points';
        else if (entry.score !== undefined) statType = 'score';
        else if (entry.wins !== undefined) statType = 'wins';
      }
      const username = entry.username || entry.name || entry.player || 'Unknown';
      return {
        position: index + 1,
        username,
        value: entry.value || entry.wins || entry.medals || entry.points || entry.score || 0,
        image: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`,
      };
    });

    // Apply offset and limit
    const entries = allEntries
      .slice(offset, offset + limit)
      .map((entry, index) => ({
        ...entry,
        position: offset + index + 1, // Update position based on offset
      }));

    return { game: gameName, type: 'wins', entries, timePeriod, statType, lastUpdated: new Date() };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getGameModes(game: string): Promise<string[]> {
  try {
    const allGames = await getAvailableGames();
    
    const normalizedGame = game.toLowerCase()
      .replace('battlearena', 'battle-arena');
    
    const gameModes = allGames
      .filter(g => g.toLowerCase().startsWith(normalizedGame + '-'))
      .map(g => g.substring(normalizedGame.length + 1))
      .filter((mode, index, arr) => arr.indexOf(mode) === index);
    
    return gameModes.length > 0 ? gameModes : [];
  } catch {
    return [];
  }
}

export async function getAvailableGames(): Promise<string[]> {
  try {
    const response = await api.get('/bedrock/leaderboards/names');
    const data = response.data;
    
    if (Array.isArray(data)) {
      return data.map((item: any) => typeof item === 'string' ? item : item.name || item.game || '').filter(Boolean);
    }
    return [];
  } catch (error) {
    return [];
  }
}

export interface Punishment {
  reason: string;
  type: string;
  date: string;
  expiry?: string;
  active?: boolean;
}

export interface AppealData {
  username: string;
  banned: boolean;
  activePunishments: Punishment[];
  pastPunishments: Punishment[];
  uuid?: string;
}

export async function checkBanStatus(username: string): Promise<AppealData | null> {
  try {
    const puppeteer = await import('puppeteer');
    let data: any = null;
    
    // Try Puppeteer approach with the search page
    try {
      const browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // Set shorter timeout and navigation timeout
      page.setDefaultNavigationTimeout(20000);
      page.setDefaultTimeout(20000);
      
      // Encoded username for URL
      const encodedUsername = username.replace(/ /g, '%20');
      const url = `https://appeals.cubecraft.net/find_appeals/username/${encodedUsername}/MCO`;
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      } catch (navError) {
        // Continue even if navigation times out
        console.warn('Navigation timeout, trying to extract content anyway');
      }
      
      // Get the page content
      const html = await page.content();
      
      // Try to find JSON data in the page
      const jsonMatch = html.match(/window\.__data\s*=\s*({[\s\S]*?});/) || 
                       html.match(/var\s+data\s*=\s*({[\s\S]*?});/) ||
                       html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          data = JSON.parse(jsonStr);
        } catch (e) {
          // Try to extract from pre tag
          const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
          if (preMatch) {
            data = JSON.parse(preMatch[1].trim());
          }
        }
      }
      
      await page.close();
      await browser.close();
    } catch (puppeteerError) {
      console.error('Puppeteer error:', (puppeteerError as Error).message);
    }
    
    // If Puppeteer didn't work, try direct API call
    if (!data) {
      try {
        const response = await axios.get(
          `https://appeals.cubecraft.net/api/v1/players/${encodeURIComponent(username)}/MCO`,
          {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept': 'application/json'
            },
            validateStatus: () => true
          }
        );
        
        if (response.status === 200) {
          data = response.data;
        }
      } catch (apiError) {
        console.error('Direct API error:', (apiError as Error).message);
      }
    }
    
    // If still no data, return null
    if (!data || data.message === 'Unknown Player' || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    // Parse the response - could be array or object
    let playerData = Array.isArray(data) ? data[0] : data;
    
    const activePunishments: Punishment[] = [];
    const pastPunishments: Punishment[] = [];
    let isBanned = false;

    // Process punishments
    if (playerData.punishments && Array.isArray(playerData.punishments)) {
      playerData.punishments.forEach((p: any) => {
        const punishment: Punishment = {
          reason: p.reason || p.ban_reason || 'No reason provided',
          type: p.type || p.punishment_type || p.punishmentType || 'Punishment',
          date: p.date || p.created_at || p.createdAt || new Date().toLocaleDateString(),
          expiry: (p.expiry || p.expires_at || p.expiresAt || 'Permanent').toString(),
          active: p.active !== false && !p.removed
        };

        if (punishment.active) {
          activePunishments.push(punishment);
          if (punishment.type.toLowerCase().includes('ban')) {
            isBanned = true;
          }
        } else {
          pastPunishments.push(punishment);
        }
      });
    }

    // Check direct ban status
    if ((playerData.banned || playerData.isBanned || playerData.is_banned) && !isBanned && activePunishments.length === 0) {
      isBanned = true;
      activePunishments.push({
        reason: playerData.banReason || playerData.ban_reason || 'Banned',
        type: 'Ban',
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        expiry: 'Permanent',
        active: true
      });
    }

    return {
      username: playerData.username || playerData.name || username,
      banned: isBanned || activePunishments.length > 0,
      activePunishments,
      pastPunishments,
      uuid: playerData.uuid || playerData.id
    };
  } catch (error) {
    console.error('Error checking ban status:', error);
    return null;
  }
}

export async function getMarketplace(): Promise<MarketplaceItem[]> {
  try {
    const response = await api.get('/bedrock/marketplace');
    const data = response.data;

    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        name: item.name || item.title || 'Unknown Item',
        price: item.price || item.cost || 0,
        currency: item.currency || 'coins',
        category: item.category || item.type || 'General',
        description: item.description || '',
        image: item.image || item.icon || item.texture || '',
      }));
    }
    return [];
  } catch (error) {
    return [];
  }
}

export async function getMarketplaceItem(name: string): Promise<MarketplaceItem | null> {
  try {
    const response = await api.get(`/bedrock/marketplace/name/${encodeURIComponent(name)}`);
    const data = response.data;

    if (!data) return null;

    return {
      name: data.name || data.title || name,
      price: data.price || data.cost || 0,
      currency: data.currency || 'coins',
      category: data.category || data.type || 'General',
      description: data.description || '',
      image: data.image || data.icon || data.texture || '',
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getMarketplaceNames(): Promise<string[]> {
  try {
    const response = await api.get('/bedrock/marketplace/names');
    const data = response.data;
    
    if (Array.isArray(data)) {
      return data.map((item: any) => typeof item === 'string' ? item : item.name || '').filter(Boolean);
    }
    return [];
  } catch (error) {
    return [];
  }
}

export async function getXpData(game: string): Promise<XpData | null> {
  try {
    const response = await api.get(`/bedrock/xp/name/${encodeURIComponent(game)}`);
    const data = response.data;

    if (!data) return null;

    const levels: XpLevel[] = [];
    
    if (Array.isArray(data)) {
      data.forEach((item: any, index: number) => {
        levels.push({
          level: item.level || index + 1,
          xpRequired: item.xp || item.xpRequired || item.required || 0,
          totalXp: item.totalXp || item.total || 0,
        });
      });
    } else if (data.levels && Array.isArray(data.levels)) {
      data.levels.forEach((item: any, index: number) => {
        levels.push({
          level: item.level || index + 1,
          xpRequired: item.xp || item.xpRequired || item.required || 0,
          totalXp: item.totalXp || item.total || 0,
        });
      });
    } else if (typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        const levelNum = parseInt(key);
        if (!isNaN(levelNum)) {
          levels.push({
            level: levelNum,
            xpRequired: typeof value === 'number' ? value : (value as any).xp || 0,
            totalXp: typeof value === 'number' ? value : (value as any).total || 0,
          });
        }
      }
    }

    return { game, levels: levels.sort((a, b) => a.level - b.level) };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getXpNames(): Promise<string[]> {
  try {
    const response = await api.get('/bedrock/xp/names');
    const data = response.data;
    
    if (Array.isArray(data)) {
      return data.map((item: any) => typeof item === 'string' ? item : item.name || '').filter(Boolean);
    }
    return [];
  } catch (error) {
    return [];
  }
}

export async function getAllGamesWithStatus(): Promise<GameInfo[]> {
  try {
    const [statusResponse, namesResponse] = await Promise.all([
      api.get('/bedrock/status'),
      api.get('/bedrock/leaderboards/names'),
    ]);

    const statusData = statusResponse.data;
    const namesData = namesResponse.data;

    const games: GameInfo[] = [];
    const gameMap = new Map<string, number>();

    if (Array.isArray(statusData)) {
      statusData.forEach((mode: any) => {
        const name = mode.name || mode.game || '';
        const players = typeof mode.value === 'number' ? mode.value : (mode.players || mode.count || 0);
        if (name) {
          gameMap.set(name.toLowerCase(), players);
          games.push({
            name,
            players,
            available: true,
          });
        }
      });
    }

    if (Array.isArray(namesData)) {
      namesData.forEach((item: any) => {
        const name = typeof item === 'string' ? item : item.name || '';
        if (name && !gameMap.has(name.toLowerCase())) {
          games.push({
            name,
            players: 0,
            available: true,
          });
        }
      });
    }

    return games.sort((a, b) => b.players - a.players);
  } catch (error) {
    return [];
  }
}

export interface AppealData {
  username: string;
  banned: boolean;
  reason?: string;
  expiry?: string;
  type?: string;
}

export async function getDetailedPlayer(username: string): Promise<DetailedPlayer | null> {
  try {
    // Try original case first
    let response = await api.get(`/bedrock/players/name/${encodeURIComponent(username)}`);
    let data = response.data;

    // If not found, and it's not all lowercase, try lowercase
    if ((!data || data.error) && username !== username.toLowerCase()) {
      try {
        const retryResponse = await api.get(`/bedrock/players/name/${encodeURIComponent(username.toLowerCase())}`);
        if (retryResponse.data && !retryResponse.data.error) {
          data = retryResponse.data;
        }
      } catch (e) {
        // Ignore retry error
      }
    }

    if (!data || data.error) return null;

    const stats: GameStats[] = [];
    const leaderboardPositions: LeaderboardPosition[] = [];

    // Try multiple possible data structures
    const leaderboardsData = data.leaderboards || data.leaderboardPositions || data.positions || data;

    if (leaderboardsData && typeof leaderboardsData === 'object') {
      for (const [game, gameData] of Object.entries(leaderboardsData)) {
        if (typeof gameData !== 'object' || gameData === null || game === 'username' || game === 'name') continue;
        const gd = gameData as Record<string, any>;
        
        // Extract position and wins/value from various possible fields
        const position = gd.position || gd.rank || gd.pos || 0;
        const wins = gd.value || gd.wins || gd.points || gd.score || 0;
        
        if (position > 0 && wins > 0) {
          leaderboardPositions.push({
            game,
            position,
            value: wins,
            name: gd.name || gd.leaderboard_name || gd.leaderboardName || game,
          });
        }

        const isFfa = game.toLowerCase().includes('ffa');
        const adjustedWins = isFfa ? Math.floor(wins / 5) : wins;

        stats.push({
          game,
          wins: gd.wins || gd.Wins || gd.value || gd.points || 0,
          kills: gd.kills || gd.Kills || 0,
          deaths: gd.deaths || gd.Deaths || 0,
          gamesPlayed: gd.played || gd.games_played || gd.gamesPlayed || 0,
          xp: gd.xp || gd.Xp || 0,
        });
      }
    }

    if (data.stats && typeof data.stats === 'object') {
      for (const [game, gameData] of Object.entries(data.stats)) {
        if (typeof gameData !== 'object' || gameData === null) continue;
        if (stats.find(s => s.game === game)) continue;
        
        const gd = gameData as Record<string, any>;
        stats.push({
          game,
          wins: gd.wins || gd.Wins || 0,
          kills: gd.kills || gd.Kills || 0,
          deaths: gd.deaths || gd.Deaths || 0,
          gamesPlayed: gd.played || gd.games_played || gd.gamesPlayed || 0,
          xp: gd.xp || gd.Xp || 0,
        });
      }
    }

    // Extract player icon/avatar from various possible fields
    const playerIcon = data.icon || data.avatar || data.profile_picture || data.profilePicture || data.skin || null;

    return {
      username: data.username || data.name || username,
      leaderboardPositions: leaderboardPositions.sort((a, b) => a.position - b.position).slice(0, 10),
      stats,
      icon: playerIcon,
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

import { cleanOldSnapshots, calculatePeriodWins } from './snapshot.js';

export async function getTotalWinsLeaderboard(timePeriod: string = 'alltime', limit: number = 10000): Promise<LeaderboardData | null> {
  try {
    const allGames = await getAvailableGames();
    
    if (!allGames || allGames.length === 0) {
      return null;
    }

    // Map to aggregate wins by player
    const playerWins = new Map<string, number>();

    // Fetch each game's leaderboard and aggregate
    for (const game of allGames) {
      const isFfa = game.toLowerCase().includes('ffa');
      try {
        const leaderboard = await getLeaderboard(game, 'alltime', 100);
        if (leaderboard && leaderboard.entries) {
          let entries = leaderboard.entries;
          if (timePeriod !== 'alltime') {
            entries = calculatePeriodWins(entries, game, timePeriod as 'daily' | 'weekly' | 'monthly');
          }
          for (const entry of entries) {
            const currentWins = playerWins.get(entry.username) || 0;
            // If it's FFA, divide wins by 5 as requested
            const winsToAdd = isFfa ? Math.floor(entry.value / 5) : entry.value;
            playerWins.set(entry.username, currentWins + winsToAdd);
          }
        }
      } catch (error) {
        // Skip games that fail to load
        continue;
      }
    }

    // Convert to sorted leaderboard entries
    const sortedEntries = Array.from(playerWins.entries())
      .map(([username, totalWins]) => ({
        position: 0,
        username,
        value: totalWins,
        image: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`,
      }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value);

    // Update positions after sorting
    const finalEntries = sortedEntries.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

    return {
      game: 'total-wins',
      type: 'wins',
      entries: finalEntries,
      timePeriod: timePeriod,
      statType: 'wins',
      lastUpdated: new Date(),
    };
  } catch (error) {
    return null;
  }
}
