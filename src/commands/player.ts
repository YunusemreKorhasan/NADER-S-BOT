import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { getDetailedPlayer, getAvailableGames, getLeaderboard, getTotalWinsLeaderboard } from '../services/cubecraft-api.js';
import { createErrorEmbed, getMedal } from '../utils/embeds.js';
import { config } from '../config.js';
import { getLeaderboardName } from '../data/leaderboardNames.js';

export const data = new SlashCommandBuilder()
  .setName('player')
  .setDescription('Get CubeCraft player profile')
  .addStringOption(option =>
    option
      .setName('username')
      .setDescription('Minecraft player username to look up')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(16)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const username = interaction.options.getString('username', true);

  await interaction.deferReply();

  try {
    const player = await getDetailedPlayer(username);

    if (!player) {
      const embed = createErrorEmbed(
        'Player Not Found',
        `Could not find player **${username}** on CubeCraft.\n\nMake sure the username is spelled correctly.`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const safeUsername = encodeURIComponent(player.username);
    const profileImage = player.icon || `https://mc-heads.net/avatar/${safeUsername}/128`;
    
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`🎮 CubeCraft Profile`)
      .setDescription(`**${player.username}**`)
      .setThumbnail(profileImage)
      .setFooter({ text: 'CubeCraft Stats Bot • made by @NADER_KANAAN' })
      .setTimestamp();

    if (player.leaderboardPositions && player.leaderboardPositions.length > 0) {
      let totalWins = 0;
      const positionList = player.leaderboardPositions
        .map((p, index) => {
          const medal = getMedal(p.position);
          let leaderboardName = p.name || getLeaderboardName(p.game || index);
          
          const isFfa = (p.game || '').toLowerCase().includes('ffa') || leaderboardName.toLowerCase().includes('ffa');
          const wins = p.value;
          const adjustedWins = isFfa ? Math.floor(wins / 5) : wins;
          totalWins += adjustedWins;

          leaderboardName = leaderboardName
            .replace(/legacy-games-/gi, '')
            .replace(/legacy\s*game\s*/gi, '')
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
            
          const positionDisplay = p.position <= 10 ? medal : p.position;
          return `**${index + 1}.** ${positionDisplay} **${leaderboardName}** - 🏆 ${wins.toLocaleString()}${isFfa ? ' (÷5)' : ''}`;
        }).join('\n');

      embed.addFields({
        name: '🏆 Leaderboard Rankings',
        value: positionList || 'No rankings available',
        inline: false
      });

      embed.addFields({
        name: '💰 Total Wins',
        value: `**${totalWins.toLocaleString()}**`,
        inline: false
      });

      embed.addFields({
        name: '📊 Number of Leaderboards',
        value: `**${player.leaderboardPositions.length}** LeaderBoard(s)`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '📊 Leaderboard Rankings',
        value: 'No leaderboard positions found',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching player profile:', error);
    const embed = createErrorEmbed(
      'Error',
      'Failed to fetch player profile. Please try again later.'
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

function formatGameName(name: string): string {
  return name
    .replace(/legacy-games-/gi, '')
    .replace(/legacy\s*game\s*/gi, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => {
      if (!word) return word;
      if (word.length > 1 && word[0] === word[0].toUpperCase() && word[1] === word[1].toUpperCase()) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Cache for usernames (10 minute expiry)
let usernamesCache: { names: Set<string>; timestamp: number } = { names: new Set(), timestamp: 0 };
let cachePromise: Promise<Set<string>> | null = null;

// Initialize cache on module load (non-blocking)
async function initializeCache(): Promise<void> {
  try {
    await getCachedUsernames();
    console.log('✅ Player autocomplete cache initialized');
  } catch (err) {
    console.error('⚠️ Failed to initialize cache:', err);
  }
}

// Start cache initialization in the background
initializeCache().catch(err => console.error('Cache init error:', err));

async function getCachedUsernames(): Promise<Set<string>> {
  const now = Date.now();
  const cacheExpiry = 10 * 60 * 1000; // 10 minutes
  
  // Return cached data if still valid
  if (usernamesCache.timestamp && now - usernamesCache.timestamp < cacheExpiry && usernamesCache.names.size > 0) {
    return usernamesCache.names;
  }

  // Use existing promise if cache is already being fetched
  if (cachePromise) {
    return cachePromise;
  }

  // Fetch new data from available games
  cachePromise = (async () => {
    const usernames = new Set<string>();

    try {
      // Get all available games from API
      const allGames = await getAvailableGames();
      
      // Fetch all games to have a complete player list
      const topGames = allGames;
      
      const leaderboardPromises = topGames.map(game =>
        getLeaderboard(game, 'alltime', 100).catch(err => {
          console.error(`Failed to get leaderboard for ${game}:`, err);
          return null;
        })
      );

      // Add Total Wins leaderboard to the cache too
      leaderboardPromises.push(
        getTotalWinsLeaderboard('alltime', 100).catch(() => null)
      );

      const leaderboards = await Promise.all(leaderboardPromises);

      leaderboards.forEach(lb => {
        if (lb?.entries) {
          lb.entries.forEach(entry => {
            if (entry.username) {
              usernames.add(entry.username);
            }
          });
        }
      });
    } catch (err) {
      console.error('Error fetching usernames from leaderboards:', err);
    }

    // Update cache
    usernamesCache = { names: usernames, timestamp: now };
    cachePromise = null; // Reset promise
    return usernames;
  })();

  return cachePromise;
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focusedValue = (interaction.options.getFocused(true).value || '').toLowerCase();
    
    // Get cached usernames with timeout - increased to 5 seconds for better reliability
    const usernames = await Promise.race([
      getCachedUsernames(),
      new Promise<Set<string>>((_, reject) => 
        setTimeout(() => reject(new Error('Autocomplete timeout')), 5000)
      )
    ]);

    let allPlayers = Array.from(usernames).sort((a, b) => a.localeCompare(b));

    let results = allPlayers;
    // Filter only if user has typed something
    if (focusedValue && focusedValue.trim()) {
      results = allPlayers.filter(name => name.toLowerCase().includes(focusedValue));
    }

    // If no results from filter, show first 25 players
    if (results.length === 0) {
      results = allPlayers.slice(0, 25);
    } else {
      results = results.slice(0, 25);
    }

    const response = results.map(name => ({ name, value: name }));
    await interaction.respond(response);
  } catch (error) {
    console.error('Autocomplete error:', error);
    try {
      // Respond with empty array on error instead of no response
      await interaction.respond([]);
    } catch (e) {
      console.error('Failed to respond to autocomplete:', e);
    }
  }
}
