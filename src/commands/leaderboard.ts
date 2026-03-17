import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction } from 'discord.js';
import { getLeaderboard, getAvailableGames, getTotalWinsLeaderboard, LeaderboardEntry } from '../services/cubecraft-api.js';
import { calculatePeriodWins } from '../services/snapshot.js';
import { 
  createLeaderboardEmbed, 
  createErrorEmbed,
  getGameEmoji 
} from '../utils/embeds.js';
import { getLogger } from '../utils/logger.js';

// Track leaderboard state: messageId -> { gameName, limit, currentPage, userId, top3, fullLeaderboard, timePeriod }
const leaderboardStates = new Map<string, { gameName: string; limit: number; currentPage: number; userId: string; top3: LeaderboardEntry[]; fullLeaderboard: LeaderboardEntry[]; timePeriod: string }>();

// Format game mode name from eggwars-duels to EggWars Duels
function formatGameName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Get the leaderboard for a CubeCraft game mode or total wins')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Choose a game mode or Total Wins')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('time')
      .setDescription('Choose a time period')
      .setRequired(false)
      .addChoices(
        { name: '📅 Daily', value: 'daily' },
        { name: '📊 Weekly', value: 'weekly' },
        { name: '📈 Monthly', value: 'monthly' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true);
  const timePeriod = interaction.options.getString('time', false) || 'alltime';
  const limit = 10; // Show 10 players per page (5 pages total)

  await interaction.deferReply();

  try {
    let fullLeaderboard;

    // Handle Total Wins
    if (name === 'total-wins') {
      fullLeaderboard = await getTotalWinsLeaderboard(timePeriod, 10000);
    } else if (['eggwars', 'skywars', 'luckyislands', 'blockwars', 'bedwars', 'survival-games', 'legacy-games'].includes(name)) {
      // Grouped leaderboard for the whole game (all modes aggregated)
      const allGames = await getAvailableGames();
      
      // Robust matching for game categories
      const searchName = name.replace(/-/g, '').toLowerCase();
      const relevantGames = allGames.filter(g => {
        const normalizedG = g.toLowerCase().replace(/-/g, '');
        return (normalizedG.includes(searchName) || searchName.includes(normalizedG));
      });
      
      // Fallback if no games found for category
      if (relevantGames.length === 0) {
        if (name === 'luckyislands') relevantGames.push('lucky-islands-solo', 'lucky-islands-teams', 'lucky-islands-duels');
        else if (name === 'eggwars') relevantGames.push('eggwars-solo', 'eggwars-teams', 'eggwars-duels');
        else if (name === 'skywars') relevantGames.push('skywars-solo', 'skywars-teams', 'skywars-duels');
      }
      
      const playerWins = new Map<string, number>();
      for (const game of relevantGames) {
        try {
          const lb = await getLeaderboard(game, 'alltime', 100);
          if (lb && lb.entries) {
            let entries = lb.entries;
            // Apply time period delta if needed
            if (timePeriod !== 'alltime') {
              entries = calculatePeriodWins(entries, game, timePeriod as 'daily' | 'weekly' | 'monthly');
            }
            
            const isFfa = game.toLowerCase().includes('ffa');
            for (const entry of entries) {
              const current = playerWins.get(entry.username.toLowerCase()) || 0;
              const winsToAdd = isFfa ? Math.floor(entry.value / 5) : entry.value;
              playerWins.set(entry.username.toLowerCase(), current + winsToAdd);
            }
          }
        } catch (e) { continue; }
      }

      const sortedEntries = Array.from(playerWins.entries())
        .map(([username, val]) => ({
          position: 0,
          username,
          value: val,
          image: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`,
        }))
        .sort((a, b) => b.value - a.value);

      const finalEntries = sortedEntries.length > 0 
        ? sortedEntries.slice(0, 100) 
        : [];
        
      if (finalEntries.length === 0 && timePeriod !== 'alltime') {
         // Fallback to top players with 0 if no period data exists
         for (const game of relevantGames.slice(0, 1)) {
            try {
              const lb = await getLeaderboard(game, 'alltime', 10);
              if (lb && lb.entries) {
                for (const entry of lb.entries) {
                  playerWins.set(entry.username.toLowerCase(), 0);
                }
              }
            } catch (e) {}
         }
         const fallbackSorted = Array.from(playerWins.entries()).map(([username, val]) => ({
           position: 0, username, value: val, image: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`
         }));
         finalEntries.push(...fallbackSorted.slice(0, 10));
      }

      fullLeaderboard = {
        game: name,
        type: 'wins',
        entries: finalEntries.map((e, i) => ({ ...e, position: i + 1 })),
        timePeriod: timePeriod,
        statType: 'wins',
        lastUpdated: new Date()
      };
    } else {
      // Get full leaderboard (200 for wider search) to extract top 3
      fullLeaderboard = await getLeaderboard(name, 'alltime', 200);
      
      if (fullLeaderboard && timePeriod !== 'alltime') {
        fullLeaderboard.entries = calculatePeriodWins(fullLeaderboard.entries, name, timePeriod as 'daily' | 'weekly' | 'monthly');
        fullLeaderboard.timePeriod = timePeriod;
      }
    }

    if (!fullLeaderboard || (fullLeaderboard.entries.length === 0 && timePeriod === 'alltime')) {
      const embed = createErrorEmbed(
        'Leaderboard Not Found',
        `No statistics found for **${name}** in this time period (${timePeriod}).`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Extract top 3 for permanent display
    const top3 = fullLeaderboard.entries.slice(0, 3);

    // Get first page data
    const firstPageEntries = fullLeaderboard.entries.slice(0, limit);
    const firstPageLeaderboard = { ...fullLeaderboard, entries: firstPageEntries };
    
    if (!firstPageLeaderboard) {
      const embed = createErrorEmbed(
        'Error',
        'Failed to fetch leaderboard data.'
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = createLeaderboardEmbed(firstPageLeaderboard, top3);
    embed.setColor(0x43B581); // Green color

    // Build navigation buttons row
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`lb_first_${name}_${timePeriod}_${limit}`)
          .setEmoji('⏪')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`lb_prev_${name}_${timePeriod}_${limit}`)
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`lb_next_${name}_${timePeriod}_${limit}`)
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`lb_last_${name}_${timePeriod}_${limit}`)
          .setEmoji('⏩')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`lb_jump_${name}_${timePeriod}`)
          .setEmoji('🔍')
          .setStyle(ButtonStyle.Danger)
      );

    const timeEmoji = timePeriod === 'alltime' ? '🏆' : timePeriod === 'daily' ? '📅' : timePeriod === 'weekly' ? '📊' : '📈';
    const timeLabel = timePeriod === 'alltime' ? 'All-Time' : timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1);
    
    const embedWithTitle = embed.setTitle(name === 'total-wins' ? 'Wins' : formatGameName(name));
    embedWithTitle.setDescription(`> ${getGameEmoji(name)} **Top Players** • ${timeEmoji} **${timeLabel}**\n> 📄 **Page 1/${Math.ceil(fullLeaderboard.entries.length / limit) || 1}** • Showing players 1-${Math.min(limit, fullLeaderboard.entries.length)}`);
    
    // Explicitly set the icon/footer for daily
    if (timePeriod === 'daily') {
      embedWithTitle.setFooter({ text: "📅 Daily Rankings • made by @NADER_KANAAN" });
    }

    const reply = await interaction.editReply({ embeds: [embedWithTitle], components: [row] });
    
    // Store state for pagination (include full leaderboard for jump feature)
    leaderboardStates.set(reply.id, {
      gameName: name,
      limit,
      currentPage: 1,
      userId: interaction.user.id,
      top3,
      fullLeaderboard: fullLeaderboard.entries,
      timePeriod
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    const embed = createErrorEmbed(
      'Error',
      'Failed to fetch leaderboard data. Please try again later.'
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

export async function handleLeaderboardButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  
  if (!customId.startsWith('lb_')) return;

  // Check if user owns this leaderboard
  const messageId = interaction.message.id;
  const state = leaderboardStates.get(messageId);
  
  if (!state) {
    return;
  }

  // Check if user owns this leaderboard
  if (state.userId !== interaction.user.id) {
    await interaction.reply({ content: '❌ You can only navigate your own leaderboards!', ephemeral: true });
    return;
  }

  const parts = customId.split('_');
  const buttonType = parts[1]; // 'prev', 'next', or 'jump'

  // Handle jump to player
  if (buttonType === 'jump') {
    const gameName = parts[2];
    const timePeriod = parts[3];
    
    const modal = new ModalBuilder()
      .setCustomId(`lb_jump_modal_${messageId}_${timePeriod}_${gameName}`)
      .setTitle('🔍 Jump to Player');

    const playerNameInput = new TextInputBuilder()
      .setCustomId('player_name')
      .setLabel('Enter player username')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('write the IGN of the Leaderboard Player')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(playerNameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  const direction = buttonType; // 'prev' or 'next'
  const gameName = parts[2];
  const timePeriod = parts[3];
  const limit = parseInt(parts[4]);

  await interaction.deferUpdate();

  try {
    const logger = getLogger();
    await logger.logButtonInteraction(customId, interaction.user.username, interaction.user.id);

    // Calculate new page
    let newPage = state.currentPage;
    const totalMaxPages_config = Math.ceil(state.fullLeaderboard.length / limit) || 1;

    if (buttonType === 'first') {
      newPage = 1;
    } else if (buttonType === 'last') {
      newPage = totalMaxPages_config;
    } else if (direction === 'next') {
      newPage++;
    } else if (direction === 'prev') {
      newPage = Math.max(1, newPage - 1);
    }

    if (newPage > totalMaxPages_config) {
      newPage = totalMaxPages_config;
    }

    // Use state's full leaderboard instead of refetching
    const entries = state.fullLeaderboard;
    
    // Calculate offset
    const offset = (newPage - 1) * limit;

    // Apply pagination
    const pageEntries = entries.slice(offset, offset + limit);
    const leaderboard = { 
      game: state.gameName,
      type: 'wins',
      entries: pageEntries,
      timePeriod: state.timePeriod,
      lastUpdated: new Date()
    };

    state.currentPage = newPage;
    const totalPages = Math.ceil(state.fullLeaderboard.length / limit) || 1;
    
    // Create the embed
    const embed = createLeaderboardEmbed(leaderboard, state.top3);
    
    const timeEmoji_btn = state.timePeriod === 'alltime' ? '🏆' : state.timePeriod === 'daily' ? '📅' : state.timePeriod === 'weekly' ? '📊' : '📈';
    const timeLabel_btn = state.timePeriod === 'alltime' ? 'All-Time' : state.timePeriod.charAt(0).toUpperCase() + state.timePeriod.slice(1);

    embed.setTitle(gameName === 'total-wins' ? 'Wins' : formatGameName(gameName));
    embed.setDescription(`> ${getGameEmoji(gameName)} **Top Players** • ${timeEmoji_btn} **${timeLabel_btn}**\n> 📄 **Page ${state.currentPage}/${totalPages}** • Showing players ${(state.currentPage - 1) * limit + 1}-${Math.min(state.currentPage * limit, state.fullLeaderboard.length)}`);
    embed.setColor(0x43B581); // Set to Green as requested

    // Recreate navigation buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`lb_first_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('⏪')
          .setStyle(ButtonStyle.Success) // Green
          .setDisabled(state.currentPage === 1),
        new ButtonBuilder()
          .setCustomId(`lb_prev_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(state.currentPage === 1),
        new ButtonBuilder()
          .setCustomId(`lb_next_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(state.currentPage >= totalPages),
        new ButtonBuilder()
          .setCustomId(`lb_last_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('⏩')
          .setStyle(ButtonStyle.Success) // Green
          .setDisabled(state.currentPage >= totalPages),
        new ButtonBuilder()
          .setCustomId(`lb_jump_${gameName}_${state.timePeriod}`)
          .setEmoji('🔍')
          .setStyle(ButtonStyle.Danger) // Red color as requested
      );

    const replyEmbed = embed;
    if (state.timePeriod === 'daily') {
      replyEmbed.setFooter({ text: "📅 Daily Rankings • made by @NADER_KANAAN" });
    }

    await interaction.editReply({ embeds: [replyEmbed], components: [row] });
  } catch (error) {
    console.error('Error handling leaderboard button:', error);
    try {
      const logger = getLogger();
      await logger.logError('leaderboard', error, interaction.user.username, interaction.user.id);
    } catch (logError) {
      console.error('Failed to log leaderboard button error:', logError);
    }

    const embed = createErrorEmbed(
      'Error',
      'Failed to update leaderboard. Please try again later.'
    );
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function handleJumpToPlayerModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const playerName = interaction.fields.getTextInputValue('player_name').trim();
    const customIdParts = interaction.customId.split('_');
    const messageId = customIdParts[3];
    const timePeriod = customIdParts[4];
    const gameName = customIdParts.slice(5).join('_');

    let state = leaderboardStates.get(messageId);
    const userId = interaction.user.id;

    // If state expired, try to reconstruct by fetching fresh data
    if (!state) {
      let fullLeaderboardData;
      

      if (gameName === 'total-wins') {
        fullLeaderboardData = await getTotalWinsLeaderboard(timePeriod, 10000);
      } else if (['eggwars', 'skywars', 'luckyislands', 'blockwars', 'bedwars', 'survival-games', 'legacy-games'].includes(gameName)) {
        // Reconstruct grouped leaderboard
        const allGames = await getAvailableGames();
        
        // Robust matching for game categories
        const searchName = gameName.replace(/-/g, '').toLowerCase();
        const relevantGames = allGames.filter(g => {
          const normalizedG = g.toLowerCase().replace(/-/g, '');
          return (normalizedG.includes(searchName) || searchName.includes(normalizedG));
        });
        
        if (relevantGames.length === 0) {
          if (gameName === 'luckyislands') relevantGames.push('lucky-islands-solo', 'lucky-islands-teams', 'lucky-islands-duels');
          else if (gameName === 'eggwars') relevantGames.push('eggwars-solo', 'eggwars-teams', 'eggwars-duels');
          else if (gameName === 'skywars') relevantGames.push('skywars-solo', 'skywars-teams', 'skywars-duels');
        }
        
        const playerWins = new Map<string, number>();
        for (const g of relevantGames) {
          try {
            const lb = await getLeaderboard(g, 'alltime', 100);
            if (lb && lb.entries) {
              let entries = lb.entries;
              if (timePeriod !== 'alltime') {
                entries = calculatePeriodWins(entries, g, timePeriod as 'daily' | 'weekly' | 'monthly');
              }
              const isFfa = g.toLowerCase().includes('ffa');
              for (const entry of entries) {
                const current = playerWins.get(entry.username.toLowerCase()) || 0;
                const winsToAdd = isFfa ? Math.floor(entry.value / 5) : entry.value;
                playerWins.set(entry.username.toLowerCase(), current + winsToAdd);
              }
            }
          } catch (e) {}
        }
        const sorted = Array.from(playerWins.entries())
          .map(([username, val]) => ({
            position: 0,
            username,
            value: val,
            image: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`,
          }))
          .sort((a, b) => b.value - a.value);
        
        const finalEntriesData = sorted.length > 0 ? sorted.slice(0, 100) : [];
        
        // If empty but timePeriod is not alltime, we might still want to show 0s
        if (finalEntriesData.length === 0 && timePeriod !== 'alltime') {
           // Fallback to top players with 0
           for (const g of relevantGames.slice(0, 1)) {
              try {
                const lb = await getLeaderboard(g, 'alltime', 10);
                if (lb && lb.entries) {
                  for (const entry of lb.entries) {
                    playerWins.set(entry.username.toLowerCase(), 0);
                  }
                }
              } catch (e) {}
           }
           const fallbackSorted = Array.from(playerWins.entries()).map(([username, val]) => ({
             position: 0, username, value: val, image: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`
           }));
           finalEntriesData.push(...fallbackSorted.slice(0, 10));
        }

        fullLeaderboardData = {
          game: gameName,
          type: 'wins',
          entries: finalEntriesData.map((e, i) => ({ ...e, position: i + 1 })),
          timePeriod: timePeriod
        };
      } else {
        fullLeaderboardData = await getLeaderboard(gameName, timePeriod, 200);
        if (fullLeaderboardData && timePeriod !== 'alltime') {
          fullLeaderboardData.entries = calculatePeriodWins(fullLeaderboardData.entries, gameName, timePeriod as 'daily' | 'weekly' | 'monthly');
        }
      }

      if (!fullLeaderboardData) {
        await interaction.reply({ content: `❌ Player \`${playerName}\` not found!`, ephemeral: true });
        return;
      }
      
      // Reconstruct state
      state = {
        gameName,
        limit: 10,
        currentPage: 1,
        userId,
        top3: fullLeaderboardData.entries.slice(0, 3),
        fullLeaderboard: fullLeaderboardData.entries,
        timePeriod
      };
    }

    // Check user ownership
    if (state.userId !== userId) {
      await interaction.reply({ content: '❌ You can only navigate your own leaderboards!', ephemeral: true });
      return;
    }

    // Find player in full leaderboard
    const playerIndex = state.fullLeaderboard.findIndex(p => p.username.toLowerCase() === playerName.toLowerCase());

    if (playerIndex === -1) {
      await interaction.reply({ content: `❌ Player **${playerName}** not found in leaderboard!`, ephemeral: true });
      return;
    }

    // Calculate which page the player is on
    const limit = state.limit;
    const pageNumber = Math.floor(playerIndex / limit) + 1;
    const offset = (pageNumber - 1) * limit;

    // Use state's full leaderboard instead of refetching
    const pageEntries = state.fullLeaderboard.slice(offset, offset + limit);
    const leaderboard = { 
      game: state.gameName,
      type: 'wins',
      entries: pageEntries,
      timePeriod: state.timePeriod,
      lastUpdated: new Date()
    };

    if (!leaderboard) {
      await interaction.reply({ content: '❌ Failed to fetch player data.', ephemeral: true });
      return;
    }

    // Get the original message and edit it
    const message = await interaction.channel?.messages.fetch(messageId);
    if (!message) {
      await interaction.reply({ content: '❌ Could not find original message.', ephemeral: true });
      return;
    }

    // Create embed with highlight on the searched player
    const embed = createLeaderboardEmbed(leaderboard, state.top3, playerName);
    embed.setColor(0x43B581); // Green color
    const totalPagesCount = Math.ceil(state.fullLeaderboard.length / 10) || 1;
    const timeEmoji_modal = state.timePeriod === 'alltime' ? '🏆' : state.timePeriod === 'daily' ? '📅' : state.timePeriod === 'weekly' ? '📊' : '📈';
    const timeLabel_modal = state.timePeriod === 'alltime' ? 'All-Time' : state.timePeriod.charAt(0).toUpperCase() + state.timePeriod.slice(1);

    embed.setTitle(gameName === 'total-wins' ? 'Wins' : formatGameName(gameName));
    embed.setDescription(`> ${getGameEmoji(gameName)} **Top Players** • ${timeEmoji_modal} **${timeLabel_modal}**\n> 🎯 **Jumped to \`${playerName}\`** • 📄 **Page ${pageNumber}/${totalPagesCount}** • Showing players ${offset + 1}-${Math.min(offset + limit, state.fullLeaderboard.length)}`);

    // Update state
    state.currentPage = pageNumber;
    leaderboardStates.set(messageId, state);

    // Recreate navigation buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`lb_first_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('⏪')
          .setStyle(ButtonStyle.Success)
          .setDisabled(pageNumber === 1),
        new ButtonBuilder()
          .setCustomId(`lb_prev_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageNumber === 1),
        new ButtonBuilder()
          .setCustomId(`lb_next_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageNumber >= totalPagesCount),
        new ButtonBuilder()
          .setCustomId(`lb_last_${gameName}_${state.timePeriod}_${limit}`)
          .setEmoji('⏩')
          .setStyle(ButtonStyle.Success)
          .setDisabled(pageNumber >= totalPagesCount),
        new ButtonBuilder()
          .setCustomId(`lb_jump_${gameName}_${state.timePeriod}`)
          .setEmoji('🔍')
          .setStyle(ButtonStyle.Danger)
      );

    const finalEmbed = embed;
    if (state.timePeriod === 'daily') {
      finalEmbed.setFooter({ text: "📅 Daily Rankings • made by @NADER_KANAAN" });
    }

    await message.edit({ embeds: [finalEmbed], components: [row] });
    await interaction.reply({ content: `✅ Jumped to **${playerName}**!`, ephemeral: true });
  } catch (error) {
    console.error('Error handling jump to player modal:', error);
    try {
      await interaction.reply({ content: '❌ An error occurred while searching for the player.', ephemeral: true });
    } catch {
      // Already responded
    }
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused(true).value.toLowerCase();
    const allGames = await getAvailableGames();
    
    // Group categories
    const mainCategories = ['eggwars', 'skywars', 'luckyislands', 'blockwars', 'bedwars', 'survival-games', 'legacy-games'];
    
    // Add "total-wins" and categories as top options
    const topOptions = ['total-wins', ...mainCategories];
    const gamesList = [...topOptions, ...allGames];
    
    const filtered = gamesList
      .filter((game, index, self) => self.indexOf(game) === index && game.toLowerCase().includes(focusedValue))
      .slice(0, 25);
    
    await interaction.respond(
      filtered.map(game => {
        let displayName;
        if (game === 'total-wins') displayName = 'Total Wins';
        else if (game === 'eggwars') displayName = 'EggWars';
        else if (game === 'skywars') displayName = 'SkyWars';
        else if (game === 'luckyislands') displayName = 'LuckyIsland';
        else if (game === 'blockwars') displayName = 'BlockWars';
        else if (game === 'bedwars') displayName = 'BedWars';
        else if (game === 'survival-games') displayName = 'Survival Games';
        else if (game === 'legacy-games') displayName = 'Legacy Games';
        else displayName = formatGameName(game);
        
        return { name: displayName, value: game };
      })
    );
  } catch {
    await interaction.respond([]);
  }
}
