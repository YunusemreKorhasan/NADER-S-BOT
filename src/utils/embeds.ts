import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { formatResetInfo } from './resetScheduler.js';
import type { PlayerStats, ServerStatus, LeaderboardData, MarketplaceItem } from '../services/cubecraft-api.js';

export function createMarketplaceItemEmbed(item: MarketplaceItem): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`${item.name}`)
    .setDescription(item.description || '*No description available*')
    .addFields(
      { name: '💰 Price', value: `**${item.price?.toLocaleString() || 'N/A'}** ${item.currency || 'coins'}`, inline: true },
      { name: '📦 Category', value: `**${item.category || 'General'}**`, inline: true }
    )
    .setFooter({ text: 'CubeCraft Store • made by @NADER_KANAAN' })
    .setTimestamp();

  if (item.image) {
    embed.setThumbnail(item.image);
    embed.setImage(item.image);
  }

  return embed;
}

export function createMarketplaceOverviewEmbed(items: MarketplaceItem[]): EmbedBuilder {
  const categories = new Map<string, MarketplaceItem[]>();
  items.forEach(item => {
    const cat = item.category || 'General';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(item);
  });

  const getCategoryEmoji = (cat: string): string => {
    const lower = cat.toLowerCase();
    if (lower.includes('pet')) return '🐾';
    if (lower.includes('skin')) return '🎭';
    if (lower.includes('bundle')) return '🎁';
    if (lower.includes('emote')) return '💃';
    if (lower.includes('trail')) return '✨';
    if (lower.includes('furniture')) return '🪑';
    if (lower.includes('cape')) return '🧥';
    if (lower.includes('map')) return '🗺️';
    if (lower.includes('hat')) return '🎩';
    return '📦';
  };

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('🛍️ CubeCraft Marketplace')
    .setDescription(`Explore **${items.length}** exclusive items!\n\n✨ Use \`/marketplace <item>\` to view details and prices.`)
    .setThumbnail('https://cubecraftcdn.com/bedrock/game_icons/cubecraft.png')
    .setFooter({ text: 'CubeCraft Store • made by @NADER_KANAAN' })
    .setTimestamp();

  let fieldCount = 0;
  for (const [category, categoryItems] of categories) {
    if (fieldCount >= 12) break;
    
    const topItems = categoryItems.slice(0, 3);
    const itemList = topItems
      .map(i => `**${i.name}** • ${i.price?.toLocaleString() || '?'} ${i.currency || 'coins'}`)
      .join('\n');
    
    const moreText = categoryItems.length > 3 ? `\n*+ ${categoryItems.length - 3} more...*` : '';
    
    embed.addFields({
      name: `${getCategoryEmoji(category)} ${category}`,
      value: itemList + moreText || 'No items available',
      inline: true
    });
    fieldCount++;
  }

  return embed;
}

export function createPlayerStatsEmbed(stats: PlayerStats): EmbedBuilder {
  const safeUsername = encodeURIComponent(stats.username);
  const updateTime = stats.lastUpdated || new Date();
  
  // Format the API update time in a readable way
  const unixTime = Math.floor(updateTime.getTime() / 1000);
  const timeString = `<t:${unixTime}:F>`;
  
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`🎮 ${stats.username}'s CubeCraft Stats`)
    .setDescription('> 👤 **Player Profile** • 📊 **Game Statistics**')
    .setThumbnail(`https://mc-heads.net/avatar/${safeUsername}/128`)
    .addFields(
      { name: '🏆 Total Wins', value: stats.totalWins.toLocaleString(), inline: true },
      { name: '⚔️ Total Kills', value: stats.totalKills.toLocaleString(), inline: true },
      { name: '🎯 Games Played', value: stats.totalGamesPlayed.toLocaleString(), inline: true }
    )
    .setFooter({ text: 'CubeCraft Stats Bot • made by @NADER_KANAAN' })
    .setTimestamp();

  if (stats.games.length > 0) {
    const topGames = stats.games
      .filter(g => g.wins > 0 || g.gamesPlayed > 0)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);

    if (topGames.length > 0) {
      const gameStats = topGames.map(g => {
        const kd = g.deaths > 0 ? (g.kills / g.deaths).toFixed(2) : g.kills.toString();
        return `**${formatGameName(g.game)}**: ${g.wins} wins, ${g.kills} kills (K/D: ${kd})`;
      }).join('\n');

      embed.addFields({ name: '📊 Top Games', value: gameStats, inline: false });
    }
  }

  // Add Last Updated from API and Stats Summary
  embed.addFields(
    { name: '━━━━━━━━━━━━━━━━━━━━━', value: '** **', inline: false },
    { name: '⏱️ Last API Update', value: timeString, inline: true },
    { name: '📈 Stats Summary', value: `**${stats.totalWins}** Wins • **${stats.totalKills}** Kills`, inline: true }
  );

  return embed;
}

export function createServerStatusEmbed(status: ServerStatus): EmbedBuilder {
  const statusEmoji = status.online ? '🟢' : '🔴';
  const statusText = status.online ? 'Online' : 'Offline';

  const embed = new EmbedBuilder()
    .setColor(status.online ? config.colors.success : config.colors.error)
    .setTitle(`${statusEmoji} CubeCraft Server Status`)
    .setDescription(`**Status:** ${statusText}`)
    .addFields(
      { name: '👥 Total Players', value: status.players.toLocaleString(), inline: true }
    )
    .setFooter({ text: 'CubeCraft Stats Bot • play.cubecraft.net' })
    .setTimestamp();

  if (status.gameModes.length > 0) {
    const modeStats = status.gameModes.map(m => {
      const emoji = getGameEmoji(m.name);
      return `${emoji} **${formatGameName(m.name)}**: ${m.players.toLocaleString()} players`;
    }).join('\n');

    embed.addFields({ name: '🎮 Game Modes', value: modeStats || 'No data available', inline: false });
    
    embed.addFields({ 
      name: '📊 Number of Game Modes', 
      value: `**${status.gameModes.length}** GameMode(s)`, 
      inline: false 
    });

    embed.addFields({ 
      name: '📊 Number of Players', 
      value: `**${status.players.toLocaleString()}** Player(s)`, 
      inline: false 
    });
  }

  return embed;
}

export function createLeaderboardEmbed(data: LeaderboardData, top3?: any[], highlightPlayer?: string): EmbedBuilder {
  const emoji = getGameEmoji(data.game);
  const timePeriod = data.timePeriod || 'alltime';
  const timeDisplay = timePeriod === 'alltime' ? 'All-Time' : timePeriod.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const updateTime = data.lastUpdated || new Date();
  
  // Convert to Discord timestamp format
  const unixTime = Math.floor(updateTime.getTime() / 1000);
  const discordTimestamp = `<t:${unixTime}:F>`;
  
  // Special title for total-wins
  const titleText = data.game === 'total-wins' ? 'Wins' : formatGameName(data.game);
  
  // Use success color (Green) as requested
  const embed = new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle(titleText)
    .setDescription(`> ${emoji} **Top Players** • 📊 **${timeDisplay}**`)
    .setFooter({ text: 'CubeCraft Stats Bot • play.cubecraft.net • made by @NADER_KANAAN', iconURL: 'https://cdn-icons-png.flaticon.com/512/3050/3050159.png' })
    .setTimestamp(updateTime);
  

  if (data.entries.length > 0) {
    const statType = data.statType || 'wins';
    const statDisplay = statType.charAt(0).toUpperCase() + statType.slice(1);
    
    // Format leaderboard with better spacing and styling
    const leaderboardLines = data.entries.map((entry, index) => {
      const position = entry.position;
      const isHighlighted = highlightPlayer && entry.username.toLowerCase() === highlightPlayer.toLowerCase();
      const value = entry.value.toLocaleString();
      
      // Get medal emoji
      let medal = '';
      if (position === 1) medal = '🥇';
      else if (position === 2) medal = '🥈';
      else if (position === 3) medal = '🥉';
      else medal = '🏅';
      
      // If highlighted, wrap name and value in underscores and bold
      if (isHighlighted) {
        return `${medal} (#${position}) __**${entry.username}** • ${value}__`;
      }
      
      // Format with emoji decorations for top 3
      if (position === 1) {
        return `${medal} (#${position}) **${entry.username}** ⭐ ${value}`;
      } else if (position === 2) {
        return `${medal} (#${position}) **${entry.username}** ✨ ${value}`;
      } else if (position === 3) {
        return `${medal} (#${position}) **${entry.username}** 💫 ${value}`;
      } else {
        return `${medal} (#${position}) **${entry.username}** • ${value}`;
      }
    });

    // Split into chunks to avoid exceeding 1024 char limit per field
    const chunks: string[] = [];
    let currentChunk = '';
    for (const line of leaderboardLines) {
      if ((currentChunk + '\n' + line).length > 1024) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n' + line : line;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    // Add fields for each chunk
    chunks.forEach((chunk, idx) => {
      embed.addFields({
        name: idx === 0 ? '━━━━━━━━━━━━━━━━━━━━━' : '━━━━━━━━━━━━━━━━━━━━━',
        value: chunk,
        inline: false
      });
    });
    
    // Add summary stats with top 3 (use provided top3 or fall back to current entries)
    const displayTop3 = top3 && top3.length > 0 ? top3 : data.entries.slice(0, 3);
    let summaryValue = '';
    
    if (displayTop3.length >= 1) {
      const needsFor1 = 0;
      summaryValue += `🥇 **${displayTop3[0].username}** (+${needsFor1})\n`;
    }
    if (displayTop3.length >= 2) {
      const needsFor2 = (displayTop3[0].value - displayTop3[1].value) + 1;
      summaryValue += `🥈 **${displayTop3[1].username}** (+${needsFor2})\n`;
    }
    if (displayTop3.length >= 3) {
      const needsFor3 = (displayTop3[1].value - displayTop3[2].value) + 1;
      summaryValue += `🥉 **${displayTop3[2].username}** (+${needsFor3})\n`;
    }
    
    summaryValue += `👥 **${data.entries.length}** Players`;
    
    // Add Last Updated and Stats Summary outside the regular fields
    embed.addFields(
      { name: '━━━━━━━━━━━━━━━━━━━━━', value: '** **', inline: false },
      { name: '📌 Last Updated', value: discordTimestamp, inline: true },
      { name: '📈 Stats Summary', value: summaryValue, inline: true }
    );
  } else {
    embed.addFields({ name: '🏅 Rankings', value: 'No data available', inline: false });
  }

  // Add reset info for time-based leaderboards with better styling
  if (timePeriod && timePeriod !== 'alltime') {
    const resetInfo = formatResetInfo(timePeriod as 'daily' | 'weekly' | 'monthly');
    embed.addFields({
      name: '🔄 Reset Schedule',
      value: `\`\`\`${resetInfo.replace('⏱️ Next reset: ', '')}\`\`\``,
      inline: false
    });
  }

  return embed;
}

export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setFooter({ text: 'CubeCraft Stats Bot' })
    .setTimestamp();
}

function formatGameName(name: string): string {
  // Game name mapping for proper capitalization
  const gameMap: Record<string, string> = {
    'eggwars': 'EggWars',
    'skywars': 'SkyWars',
    'blockwars': 'BlockWars',
    'luckyblocks': 'Lucky Blocks',
    'luckyislands': 'Lucky Islands',
    'survivalgames': 'Survival Games',
    'minerware': 'MinerWare',
    'parkour': 'Parkour',
    'battlearena': 'Battle Arena',
    'buildbattle': 'Build Battle',
    'towerdefense': 'Tower Defense',
    'ffa': 'FFA',
  };

  const cleaned = name
    .replace(/legacy-games-/gi, '')
    .replace(/legacy\s*game\s*/gi, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();

  // Check if it matches a game in the map (without spaces)
  const cleanedNoSpace = cleaned.replace(/\s+/g, '');
  if (gameMap[cleanedNoSpace]) {
    const mapped = gameMap[cleanedNoSpace];
    const mode = cleaned.replace(cleanedNoSpace, '').trim();
    return mode ? `${mapped} ${mode.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : mapped;
  }

  // Default Title Case
  return cleaned
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function getGameEmoji(game: string): string {
  const gameKey = game.toLowerCase().replace(/[_\s-]/g, '');
  const emojiMap: Record<string, string> = {
    eggwars: '🥚',
    skywars: '🎆',
    luckyisland: '🍀',
    blockwars: '🔳',
    duels: '🤺',
    totalwins: '⭐',
    topplayers: '🏆',
    bedwars: '🛏️',
    survivalgames: '🗡️',
    legacygames: '📜',
  };
  return emojiMap[gameKey] || '🎮';
}

function getGameImage(game: string): string {
  const gameKey = game.toLowerCase().split('-')[0].replace(/[_\s]/g, '');
  const imageMap: Record<string, string> = {
    eggwars: 'https://cubecraftcdn.com/bedrock/game_icons/eggwars.png',
    skywars: 'https://cubecraftcdn.com/bedrock/game_icons/skywars.png',
    luckyislands: 'https://cubecraftcdn.com/bedrock/game_icons/luckyislands.png',
    blockwars: 'https://cubecraftcdn.com/bedrock/game_icons/blockwars.png',
    towerdefense: 'https://cubecraftcdn.com/bedrock/game_icons/towerdefense.png',
    survivalgames: 'https://cubecraftcdn.com/bedrock/game_icons/survivalgames.png',
    minerware: 'https://cubecraftcdn.com/bedrock/game_icons/minerware.png',
    parkour: 'https://cubecraftcdn.com/bedrock/game_icons/parkour.png',
    ffa: 'https://cubecraftcdn.com/bedrock/game_icons/ffa.png',
    duels: 'https://cubecraftcdn.com/bedrock/game_icons/duels.png',
    lucky: 'https://cubecraftcdn.com/bedrock/game_icons/luckyislands.png',
    battle: 'https://cubecraftcdn.com/bedrock/game_icons/battlearena.png',
  };
  return imageMap[gameKey] || 'https://cubecraftcdn.com/bedrock/game_icons/cubecraft.png';
}

export function getMedal(position: number): string {
  switch (position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '🏅';
  }
}
