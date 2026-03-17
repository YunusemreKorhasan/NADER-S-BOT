import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Bot will send your message')
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('The message to send')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2000)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check if user has admin permissions
  const permissions = interaction.member?.permissions;
  if (!permissions || (typeof permissions !== 'string' && !permissions.has(PermissionFlagsBits.Administrator))) {
    await interaction.reply({
      content: '❌ You do not have permission to use this command. Only administrators can use `/say`.',
      ephemeral: true
    });
    return;
  }

  const message = interaction.options.getString('message', true);

  try {
    // Send the message to the channel
    if (interaction.channel && 'send' in interaction.channel) {
      await interaction.channel.send(message);
    }
    
    // Respond to the interaction
    await interaction.reply({
      content: '✅ Message sent successfully!',
      ephemeral: true
    });
  } catch (error) {
    console.error('Error sending message:', error);
    await interaction.reply({
      content: '❌ Failed to send message.',
      ephemeral: true
    });
  }
}
