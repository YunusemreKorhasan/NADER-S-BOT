import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const TIER_TESTER_ROLE_ID = '1361434462227009816';
const ADMIN_ROLE_ID = '1310986436492791808';
const ADMIN_CHANNEL_ID = '1311073373924884550'; // #🪖┃admins
const CHANGELOG_CHANNEL_ID = '1361460205367463987'; // #📮┃tier・changelog

// Store pending tier applications
const pendingTiers = new Map<string, {
  userId: string;
  username: string;
  discordUsername: string;
  gamemode: string;
  kits: string;
  result: string;
  tier: string;
  testedBy: string;
  testedByDiscord: string;
  region: string;
  note: string;
  decided?: boolean;
}>();

function getTierColor(tier: string): number {
  const tierLetter = tier.charAt(0).toUpperCase();
  if (tierLetter === 'S') return 0x470000;
  if (tierLetter === 'A') return 0x293880;
  if (tierLetter === 'B') return 0x718300;
  if (tierLetter === 'C') return 0x340073;
  if (tierLetter === 'D') return 0x00a4aa;
  return 0x470000;
}

export const data = new SlashCommandBuilder()
  .setName('tier')
  .setDescription('Submit a tier ranking (Tester role only)')
  .addStringOption(option =>
    option
      .setName('username')
      .setDescription('Player username')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('gamemode')
      .setDescription('write here the GameMode which u tested him with. ex: battle arena, etc')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('kits')
      .setDescription('write here the kits which u tested him, ex: Tank, OP EggWars, etc')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('result')
      .setDescription('write here the result, ex: 3-1 TANK / 2-1 OP EggWars')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('tier')
      .setDescription('Tier ranking')
      .setRequired(true)
      .addChoices(
        { name: 'S+', value: 'S+' },
        { name: 'S', value: 'S' },
        { name: 'S-', value: 'S-' },
        { name: 'A+', value: 'A+' },
        { name: 'A', value: 'A' },
        { name: 'A-', value: 'A-' },
        { name: 'B+', value: 'B+' },
        { name: 'B', value: 'B' },
        { name: 'B-', value: 'B-' },
        { name: 'C+', value: 'C+' },
        { name: 'C', value: 'C' },
        { name: 'C-', value: 'C-' },
        { name: 'D+', value: 'D+' },
        { name: 'D', value: 'D' },
        { name: 'D-', value: 'D-' }
      )
  )
  .addStringOption(option =>
    option
      .setName('tested_by')
      .setDescription('Tester username')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('region')
      .setDescription('Region')
      .setRequired(true)
      .addChoices(
        { name: 'EU', value: 'EU' },
        { name: 'NA', value: 'NA' },
        { name: 'AS', value: 'AS' }
      )
  )
  .addStringOption(option =>
    option
      .setName('note')
      .setDescription('Additional notes (optional)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check if user has tester role
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member?.roles.cache.has(TIER_TESTER_ROLE_ID)) {
    await interaction.reply({
      content: '❌ You need the Tester role to use this command.',
      ephemeral: true
    });
    return;
  }

  const username = interaction.options.getString('username', true);
  const gamemode = interaction.options.getString('gamemode', true);
  const kits = interaction.options.getString('kits', true);
  const result = interaction.options.getString('result', true);
  const tier = interaction.options.getString('tier', true);
  const testedByUsername = interaction.options.getString('tested_by', true);
  const region = interaction.options.getString('region', true);
  const note = interaction.options.getString('note', false) || '';

  const testerUsername = interaction.user.username;

  const tierColor = getTierColor(tier);

  // Create embed for confirmation
  const confirmEmbed = new EmbedBuilder()
    .setColor(tierColor)
    .setTitle(`${username}`)
    .setDescription(
      `> **GameMode:** ${gamemode}\n` +
      `> **KITS:** ${kits}\n` +
      `> **RESULT:** ${result}\n` +
      `> **TIER:** ${tier}\n` +
      `> **TESTED BY:** ${testedByUsername}\n` +
      `> **REGION:** ${region}\n` +
      (note ? `> -# **NOTE:** ${note}\n` : '')
    )
    .setFooter({ text: 'Tier Ranking System' })
    .setTimestamp();

  // Create Edit/Submit buttons
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('tier_edit')
        .setLabel('✏️ Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tier_submit')
        .setLabel('✅ Submit')
        .setStyle(ButtonStyle.Success)
    );

  await interaction.reply({
    embeds: [confirmEmbed],
    components: [row],
    ephemeral: true
  });

  // Store tier data for later use
  const messagePromise = interaction.fetchReply();
  messagePromise.then(message => {
    pendingTiers.set(message.id, {
      userId: interaction.user.id,
      username,
      discordUsername: testerUsername,
      gamemode,
      kits,
      result,
      tier,
      testedBy: testedByUsername,
      testedByDiscord: testedByUsername,
      region,
      note,
      decided: false
    });
  });
}

export async function handleTierButton(interaction: any): Promise<void> {
  const messageId = interaction.message.id;
  const tierData = pendingTiers.get(messageId);

  if (!tierData) {
    await interaction.reply({
      content: '❌ Tier data not found.',
      ephemeral: true
    });
    return;
  }

  if (tierData.decided) {
    await interaction.reply({
      content: '❌ This tier has already been decided.',
      ephemeral: true
    });
    return;
  }

  if (interaction.customId === 'tier_edit') {
    // Show edit modal with all fields
    await interaction.showModal({
      customId: `tier_edit_modal_${messageId}`,
      title: 'Edit Tier Ranking',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              customId: 'tier_username',
              label: 'Username',
              style: 1,
              value: tierData.username,
              required: true,
              maxLength: 100
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              customId: 'tier_gamemode',
              label: 'GameMode (e.g. Battle Arena / EggWars Duels)',
              style: 1,
              value: tierData.gamemode,
              required: true,
              maxLength: 500,
              placeholder: 'Multiple choices separated by /'
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              customId: 'tier_kits',
              label: 'Kits (e.g. TANK / OP EggWars)',
              style: 1,
              value: tierData.kits,
              required: true,
              maxLength: 500,
              placeholder: 'Multiple choices separated by /'
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              customId: 'tier_result',
              label: 'Result',
              style: 2,
              value: tierData.result,
              required: true,
              maxLength: 500
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              customId: 'tier_note',
              label: 'Note (optional)',
              style: 2,
              value: tierData.note,
              required: false,
              maxLength: 500
            }
          ]
        }
      ]
    } as any);

  } else if (interaction.customId === 'tier_submit') {
    // Send to admin channel
    await interaction.deferReply({ ephemeral: true });

    try {
      const adminChannel = await interaction.client.channels.fetch(ADMIN_CHANNEL_ID);
      
      if (adminChannel && 'send' in adminChannel) {
        const tierColor = getTierColor(tierData.tier);
        
        const tierEmbed = new EmbedBuilder()
          .setColor(tierColor)
          .setTitle(`${tierData.username}`)
          .setDescription(
            `> **GameMode:** ${tierData.gamemode}\n` +
            `> **KITS:** ${tierData.kits}\n` +
            `> **RESULT:** ${tierData.result}\n` +
            `> **TIER:** ${tierData.tier}\n` +
            `> **TESTED BY:** ${tierData.testedBy}\n` +
            `> **REGION:** ${tierData.region}\n` +
            (tierData.note ? `> -# **NOTE:** ${tierData.note}\n` : '')
          )
          .setFooter({ text: 'Tier Ranking System' })
          .setTimestamp();

        const adminRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`tier_accept_${messageId}`)
              .setLabel('✅ Accept')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`tier_reject_${messageId}`)
              .setLabel('❌ Reject')
              .setStyle(ButtonStyle.Danger)
          );

        const adminMsg = await adminChannel.send({
          content: `<@&${ADMIN_ROLE_ID}> New tier ranking for review!`,
          embeds: [tierEmbed],
          components: [adminRow]
        });

        // Update tier data with admin message id
        tierData.decided = true;
        pendingTiers.set(messageId, tierData);

        // Store admin message for accepting/rejecting
        pendingTiers.set(adminMsg.id, tierData);

        await interaction.editReply({
          content: '✅ Tier ranking submitted to admins for review!'
        });
      }
    } catch (error) {
      console.error('Error submitting tier:', error);
      await interaction.editReply({
        content: '❌ Error submitting tier ranking.'
      });
    }
  }
}

export async function handleTierEditModal(interaction: any): Promise<void> {
  const messageId = interaction.customId.split('_')[3]; // Extract from tier_edit_modal_messageId
  const tierData = pendingTiers.get(messageId);

  if (!tierData) {
    await interaction.reply({
      content: '❌ Tier data not found.',
      ephemeral: true
    });
    return;
  }

  try {
    const username = interaction.fields.getTextInputValue('tier_username');
    const gamemode = interaction.fields.getTextInputValue('tier_gamemode');
    const kits = interaction.fields.getTextInputValue('tier_kits');
    const result = interaction.fields.getTextInputValue('tier_result');
    const note = interaction.fields.getTextInputValue('tier_note');

    tierData.username = username;
    tierData.gamemode = gamemode;
    tierData.kits = kits;
    tierData.result = result;
    tierData.note = note;

    pendingTiers.set(messageId, tierData);

    await interaction.reply({
      content: '✅ Tier updated successfully!',
      ephemeral: true
    });
  } catch (error) {
    console.error('Error in edit modal:', error);
    await interaction.reply({
      content: '❌ Error updating tier.',
      ephemeral: true
    });
  }
}

export async function handleTierAdminButton(interaction: any): Promise<void> {
  const messageId = interaction.message.id;
  const tierData = pendingTiers.get(messageId);

  if (!tierData) {
    await interaction.reply({
      content: '❌ Tier data not found.',
      ephemeral: true
    });
    return;
  }

  // Check if user is admin
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member?.permissions.has('ADMINISTRATOR')) {
    await interaction.reply({
      content: '❌ Only admins can approve or reject tiers.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  if (interaction.customId.includes('accept')) {
    try {
      // Send to changelog channel
      const changelogChannel = await interaction.client.channels.fetch(CHANGELOG_CHANNEL_ID);
      
      if (changelogChannel && 'send' in changelogChannel) {
        const tierColor = getTierColor(tierData.tier);
        
        const tierEmbed = new EmbedBuilder()
          .setColor(tierColor)
          .setTitle(`${tierData.username}`)
          .setDescription(
            `> **GameMode:** ${tierData.gamemode}\n` +
            `> **KITS:** ${tierData.kits}\n` +
            `> **RESULT:** ${tierData.result}\n` +
            `> **TIER:** ${tierData.tier}\n` +
            `> **TESTED BY:** ${tierData.testedBy}\n` +
            `> **REGION:** ${tierData.region}\n` +
            (tierData.note ? `> -# **NOTE:** ${tierData.note}\n` : '')
          )
          .setFooter({ text: 'Tier Ranking System' })
          .setTimestamp();

        await changelogChannel.send({
          embeds: [tierEmbed]
        });
      }

      // Update admin message
      const disabledRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`tier_accept_${messageId}`)
            .setLabel('✅ Accept')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`tier_reject_${messageId}`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await interaction.message.edit({
        components: [disabledRow],
        content: `${interaction.message.content}\n\n✅ **ACCEPTED** by ${interaction.user.username}`
      });

      await interaction.editReply({
        content: '✅ Tier accepted and posted to changelog!'
      });
    } catch (error) {
      console.error('Error accepting tier:', error);
      await interaction.editReply({
        content: '❌ Error accepting tier.'
      });
    }

  } else if (interaction.customId.includes('reject')) {
    try {
      // Update admin message
      const disabledRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`tier_accept_${messageId}`)
            .setLabel('✅ Accept')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`tier_reject_${messageId}`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await interaction.message.edit({
        components: [disabledRow],
        content: `${interaction.message.content}\n\n❌ **REJECTED** by ${interaction.user.username}`
      });

      await interaction.editReply({
        content: '❌ Tier rejected!'
      });
    } catch (error) {
      console.error('Error rejecting tier:', error);
      await interaction.editReply({
        content: '❌ Error rejecting tier.'
      });
    }
  }
}
