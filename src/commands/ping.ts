import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check connection speed');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const ping = Math.round(interaction.client.ws.ping);
  
  await interaction.reply({
    content: `Pong!🏓 Your ping is **${ping}** MS`
  });
}
