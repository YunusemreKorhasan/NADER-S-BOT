import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const SUGGESTION_CHANNEL_ID = '1311073373924884550';
const ADMIN_ROLE_ID = '1310986436492791808';

// Store pending suggestions
const pendingSuggestions = new Map<string, { userId: string; suggestion: string; decided?: boolean }>();
// Track processed suggestions per user
const processedSuggestions = new Map<string, string>(); // userId -> 'accepted' or 'rejected'

export const data = new SlashCommandBuilder()
  .setName('suggestion')
  .setDescription('Submit a suggestion for the CubeCraft Stats Bot');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Show modal to get the suggestion text
  await interaction.showModal({
    customId: 'suggestion_modal',
    title: 'Submit a Suggestion',
    components: [
      {
        type: 1,
        components: [
          {
            type: 4,
            customId: 'suggestion_text',
            label: 'Your Suggestion',
            style: 2,
            placeholder: 'Describe your idea for the bot...',
            required: true,
            minLength: 10,
            maxLength: 2000
          }
        ]
      }
    ]
  } as any);
}

export async function handleSuggestionModal(interaction: any): Promise<void> {
  const suggestion = interaction.fields.getTextInputValue('suggestion_text');
  
  // Check if user already has a suggestion
  const existingStatus = processedSuggestions.get(interaction.user.id);
  if (existingStatus) {
    console.log(`📝 [SUGGESTION LOG] User ${interaction.user.username} (${interaction.user.id}) submitted new suggestion after previous decision: ${existingStatus}`);
  }
  
  // Defer the interaction immediately
  await interaction.deferReply({ ephemeral: true });

  // Show confirmation to user
  await interaction.editReply({
    content: '✅ Your suggestion has been submitted! Thank you for helping us improve the bot.'
  });

  // Send to suggestion channel with buttons
  try {
    const channel = await interaction.client.channels.fetch(SUGGESTION_CHANNEL_ID);
    
    if (channel && 'send' in channel) {
      // Get member info
      const member = interaction.member;
      const user = interaction.user;
      const createdAt = user.createdAt.toLocaleDateString('en-US');
      const joinedAt = member?.joinedAt?.toLocaleDateString('en-US') || 'Unknown';
      const roles = member?.roles?.cache?.map((r: any) => r.name).slice(0, 5).join(', ') || 'No roles';

      const embed = new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle('📝 New Suggestion')
        .setDescription(suggestion)
        .setAuthor({ 
          name: user.username,
          iconURL: user.displayAvatarURL()
        })
        .addFields(
          { name: '👤 Username', value: `${user.username}#${user.discriminator || '0'}`, inline: true },
          { name: '🔑 User ID', value: user.id, inline: true },
          { name: '📅 Account Created', value: createdAt, inline: true },
          { name: '📍 Joined Server', value: joinedAt, inline: true },
          { name: '🏷️ Roles', value: roles, inline: false }
        )
        .setFooter({ text: 'Suggestion System' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`accept_suggestion`)
            .setLabel('✅ Accept')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_suggestion`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger)
        );

      const message = await channel.send({ 
        content: `<@&${ADMIN_ROLE_ID}> 📢 New suggestion from ${user.username}!`,
        embeds: [embed],
        components: [row]
      });

      // Send log message
      const logEmbed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle('📊 Suggestion Submitted')
        .addFields(
          { name: '👤 From', value: user.username, inline: true },
          { name: '🆔 User ID', value: user.id, inline: true },
          { name: '📝 Suggestion', value: suggestion, inline: false }
        )
        .setFooter({ text: 'Suggestion Log' })
        .setTimestamp();

      await channel.send({ embeds: [logEmbed] });

      console.log(`📝 [SUGGESTION LOG] User ${user.username} (${user.id}) submitted suggestion: "${suggestion}"`);

      // Store suggestion data
      pendingSuggestions.set(message.id, {
        userId: interaction.user.id,
        suggestion: suggestion,
        decided: false
      });
    }
  } catch (error) {
    console.error('Failed to send suggestion to channel:', error);
  }
}

export async function handleSuggestionButton(interaction: any): Promise<void> {
  const messageId = interaction.message.id;
  const suggestionData = pendingSuggestions.get(messageId);

  if (!suggestionData) {
    await interaction.reply({
      content: '❌ Suggestion data not found.',
      ephemeral: true
    });
    return;
  }

  // Check if already decided
  if (suggestionData.decided) {
    console.log(`⚠️ [SUGGESTION LOG] User ${interaction.user.username} (${interaction.user.id}) tried to change decision on already processed suggestion`);
    await interaction.reply({
      content: '❌ This suggestion has already been decided.',
      ephemeral: true
    });
    return;
  }

  const action = interaction.customId.split('_')[0]; // 'accept' or 'reject'
  const userId = suggestionData.userId;

  try {
    if (action === 'accept') {
      // Show modal for acceptance reason
      await interaction.showModal({
        customId: `accept_modal_${messageId}`,
        title: 'Accept Suggestion',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                customId: 'acceptance_reason',
                label: 'Reason for acceptance (optional)',
                style: 2,
                placeholder: 'Why are we accepting this suggestion?',
                required: false,
                maxLength: 1000
              }
            ]
          }
        ]
      } as any);

    } else if (action === 'reject') {
      // Show modal for rejection reason
      await interaction.showModal({
        customId: `reject_modal_${messageId}`,
        title: 'Reject Suggestion',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                customId: 'rejection_reason',
                label: 'Reason for rejection',
                style: 2,
                placeholder: 'Why are we rejecting this suggestion?',
                required: true,
                maxLength: 1000
              }
            ]
          }
        ]
      } as any);
    }
  } catch (error) {
    console.error('Error handling suggestion button:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Error processing suggestion.',
        ephemeral: true
      });
    }
  }
}

export async function handleAcceptanceModal(interaction: any): Promise<void> {
  const messageId = interaction.customId.split('_')[2]; // Extract messageId from accept_modal_messageId
  const reason = interaction.fields.getTextInputValue('acceptance_reason');
  const suggestionData = pendingSuggestions.get(messageId);

  if (!suggestionData) {
    await interaction.reply({
      content: '❌ Suggestion data not found.',
      ephemeral: true
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    const user = await interaction.client.users.fetch(suggestionData.userId);
    const embed = new EmbedBuilder()
      .setColor(0x43B581)
      .setTitle('✅ Your Suggestion Was Accepted!')
      .addFields(
        { name: '💡 Suggestion', value: suggestionData.suggestion, inline: false },
        ...(reason ? [{ name: '📝 Reason', value: reason, inline: false }] : [])
      )
      .setFooter({ text: 'Thank you for your feedback!' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => {
      console.warn(`Could not send acceptance DM to user ${suggestionData.userId}`);
    });

    // Update message to disable buttons
    const channel = await interaction.client.channels.fetch(SUGGESTION_CHANNEL_ID);
    if (channel && 'messages' in channel) {
      const message = await channel.messages.fetch(messageId);
      const disabledRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`accept_suggestion`)
            .setLabel('✅ Accept')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`reject_suggestion`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await message.edit({ components: [disabledRow] });
    }

    await interaction.editReply({
      content: '✅ Suggestion accepted and user notified!'
    });

    // Mark as decided
    if (suggestionData) {
      suggestionData.decided = true;
    }
    processedSuggestions.set(suggestionData.userId, 'accepted');
    console.log(`✅ [SUGGESTION LOG] Suggestion from ${user.username} (${suggestionData.userId}) ACCEPTED${reason ? ` - Reason: ${reason}` : ''}`);

    // Clean up
    pendingSuggestions.delete(messageId);

  } catch (error) {
    console.error('Error handling acceptance modal:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Error processing acceptance.',
        ephemeral: true
      });
    }
  }
}

export async function handleRejectionModal(interaction: any): Promise<void> {
  const messageId = interaction.customId.split('_')[2]; // Extract messageId from reject_modal_messageId
  const reason = interaction.fields.getTextInputValue('rejection_reason');
  const suggestionData = pendingSuggestions.get(messageId);

  if (!suggestionData) {
    await interaction.reply({
      content: '❌ Suggestion data not found.',
      ephemeral: true
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    const user = await interaction.client.users.fetch(suggestionData.userId);
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('❌ Your Suggestion Was Rejected')
      .addFields(
        { name: '💡 Suggestion', value: suggestionData.suggestion, inline: false },
        { name: '📋 Reason', value: reason, inline: false }
      )
      .setFooter({ text: 'Thank you for your feedback!' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => {
      console.warn(`Could not send rejection DM to user ${suggestionData.userId}`);
    });

    // Update message to disable buttons
    const channel = await interaction.client.channels.fetch(SUGGESTION_CHANNEL_ID);
    if (channel && 'messages' in channel) {
      const message = await channel.messages.fetch(messageId);
      const disabledRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`accept_suggestion`)
            .setLabel('✅ Accept')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`reject_suggestion`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await message.edit({ components: [disabledRow] });
    }

    await interaction.editReply({
      content: '✅ Rejection reason sent to user!'
    });

    // Mark as decided
    if (suggestionData) {
      suggestionData.decided = true;
    }
    processedSuggestions.set(suggestionData.userId, 'rejected');
    console.log(`❌ [SUGGESTION LOG] Suggestion from ${user.username} (${suggestionData.userId}) REJECTED - Reason: ${reason}`);

    // Clean up
    pendingSuggestions.delete(messageId);

  } catch (error) {
    console.error('Error sending rejection reason:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Error processing rejection.',
        ephemeral: true
      });
    }
  }
}
