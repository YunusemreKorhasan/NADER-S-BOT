import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { getMarketplace, getMarketplaceItem, getMarketplaceNames } from '../services/cubecraft-api.js';
import { createErrorEmbed, createMarketplaceItemEmbed, createMarketplaceOverviewEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('marketplace')
  .setDescription('Browse CubeCraft marketplace items and prices')
  .addStringOption(option =>
    option
      .setName('item')
      .setDescription('Search for a specific item')
      .setRequired(false)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const itemName = interaction.options.getString('item');

  await interaction.deferReply();

  try {
    if (itemName) {
      const item = await getMarketplaceItem(itemName);

      if (!item) {
        const embed = createErrorEmbed(
          'Item Not Found',
          `Could not find item **${itemName}** in the marketplace.`
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = createMarketplaceItemEmbed(item);
      await interaction.editReply({ embeds: [embed] });
    } else {
      const items = await getMarketplace();

      if (items.length === 0) {
        const embed = createErrorEmbed(
          'Marketplace Empty',
          'Could not fetch marketplace items. Please try again later.'
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = createMarketplaceOverviewEmbed(items);
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    const embed = createErrorEmbed(
      'Error',
      'Failed to fetch marketplace data. Please try again later.'
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  
  try {
    const names = await getMarketplaceNames();
    const filtered = names
      .filter(name => name.toLowerCase().includes(focusedValue))
      .slice(0, 25);
    
    await interaction.respond(
      filtered.map(name => ({ name, value: name }))
    );
  } catch {
    await interaction.respond([]);
  }
}
