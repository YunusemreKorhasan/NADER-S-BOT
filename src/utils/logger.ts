import { Client, EmbedBuilder, TextChannel } from 'discord.js';

const LOG_CHANNEL_ID = '1445042754982903908';

export class Logger {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  private async sendToChannel(embed: EmbedBuilder): Promise<void> {
    try {
      // Disabled channel logging due to Unknown Channel error
      /*
      const channel = await this.client.channels.fetch(LOG_CHANNEL_ID);
      if (channel && 'send' in channel) {
        await (channel as TextChannel).send({ embeds: [embed] });
      }
      */
    } catch (error) {
      // console.error('❌ Failed to send log to channel:', error);
    }
  }

  // Log command usage
  async logCommandUsage(commandName: string, userName: string, userId: string, guildName: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle(`📝 Command Used: /${commandName}`)
      .addFields(
        { name: 'User', value: `${userName} (${userId})`, inline: true },
        { name: 'Server', value: guildName || 'Unknown', inline: true },
        { name: 'Command', value: `/${commandName}`, inline: true },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'Command Usage Log' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.log(`✅ Logged command: /${commandName} by ${userName}`);
  }

  // Log errors
  async logError(commandName: string, error: any, userName?: string, userId?: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack?.substring(0, 1024) : 'No stack trace';

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`❌ Error in /${commandName}`)
      .addFields(
        { name: 'Command', value: `/${commandName}`, inline: true },
        { name: 'User', value: userName ? `${userName} (${userId})` : 'System', inline: true },
        { name: 'Error', value: `\`\`\`${errorMessage}\`\`\``, inline: false },
        { name: 'Stack Trace', value: `\`\`\`${errorStack}\`\`\``, inline: false },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'Error Log' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.error(`❌ Error in /${commandName}:`, error);
  }

  // Log bot startup
  async logBotStartup(tag: string, guildCount: number, commandCount: number): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0x43B581)
      .setTitle('🟢 Bot Started')
      .addFields(
        { name: 'Bot Tag', value: tag, inline: true },
        { name: 'Servers', value: String(guildCount), inline: true },
        { name: 'Commands', value: String(commandCount), inline: true },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'made by @NADER_KANAAN' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.log(`✅ Bot startup logged`);
  }

  // Log bot shutdown
  async logBotShutdown(): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔴 Bot Offline')
      .addFields(
        { name: 'Status', value: 'Bot is shutting down', inline: false },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'made by @NADER_KANAAN' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.log(`✅ Bot shutdown logged`);
  }

  // Log API errors
  async logApiError(endpoint: string, error: any, playerName?: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const errorMessage = error instanceof Error ? error.message : String(error);

    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle('⚠️ API Error')
      .addFields(
        { name: 'Endpoint', value: endpoint, inline: true },
        { name: 'Player', value: playerName || 'N/A', inline: true },
        { name: 'Error', value: `\`\`\`${errorMessage}\`\`\``, inline: false },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'API Error Log' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.error(`❌ API Error (${endpoint}):`, error);
  }

  // Log button interactions
  async logButtonInteraction(buttonId: string, userName: string, userId: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle(`🔘 Button Clicked: ${buttonId}`)
      .addFields(
        { name: 'Button ID', value: buttonId, inline: true },
        { name: 'User', value: `${userName} (${userId})`, inline: true },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'Button Interaction Log' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.log(`✅ Logged button interaction: ${buttonId} by ${userName}`);
  }

  // Log modal submissions
  async logModalSubmission(modalId: string, userName: string, userId: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle(`📋 Modal Submitted: ${modalId}`)
      .addFields(
        { name: 'Modal ID', value: modalId, inline: true },
        { name: 'User', value: `${userName} (${userId})`, inline: true },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'Modal Submission Log' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.log(`✅ Logged modal submission: ${modalId} by ${userName}`);
  }

  // Log recent changes/updates
  async logUpdates(changes: string[]): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const changesText = changes.map(change => `• ${change}`).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('📝 Recent Updates')
      .addFields(
        { name: 'Changes Made', value: changesText, inline: false },
        { name: 'Time', value: `<t:${timestamp}:F>`, inline: false }
      )
      .setFooter({ text: 'made by @NADER_KANAAN' })
      .setTimestamp();

    await this.sendToChannel(embed);
    console.log(`✅ Logged updates: ${changes.length} changes`);
  }
}

let loggerInstance: Logger;

export function initLogger(client: Client): Logger {
  loggerInstance = new Logger(client);
  return loggerInstance;
}

export function getLogger(): Logger {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call initLogger first.');
  }
  return loggerInstance;
}
