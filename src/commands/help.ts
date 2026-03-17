import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all available commands and how to use them');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('🎮 CubeCraft Stats Bot - Help')
    .setDescription('Get player statistics and server information from CubeCraft Bedrock!')
    .addFields(
      {
        name: '📊 Player Stats Commands',
        value: 
          '`/player <name>` - Detailed player profile with stats and rankings\n' +
          '`/leaderboard <name> [time]` - Top players in game modes (paginated, with daily/weekly/monthly filters)\n' +
          '`/marketplace [item]` - Browse shop items with autocomplete',
        inline: false
      },
      {
        name: '🔧 Utility Commands',
        value:
          '`/ping` - Check Discord bot latency and your network connection speed\n' +
          '`/help` - Show this help message',
        inline: false
      },
      {
        name: '💬 Community Commands',
        value:
          '`/suggestion` - Submit ideas to improve the bot\n' +
          '`/say <message>` - Post messages (Admin only)',
        inline: false
      },
      {
        name: '📌 Tips',
        value:
          '💡 Use `/ping` to diagnose connection issues\n' +
          '💡 Use `/suggestion` to submit ideas for new features\n' +
          '💡 Game mode names support autocomplete for easier selection',
        inline: false
      }
    )
    .setFooter({ text: 'made by @NADER_KANAAN' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
