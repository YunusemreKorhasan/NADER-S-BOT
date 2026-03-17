import express from "express";
import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Events,
  ActivityType,
} from "discord.js";
import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  AutocompleteInteraction,
} from "discord.js";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import { setupDashboard, setBotClient } from "./dashboard.js";

const app = express();
const PORT_EXPRESS = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint for UptimeRobot monitoring
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    botReady: client.isReady()
  });
});

// Ping endpoint for simple health check
app.get("/ping", (req, res) => {
  res.send("pong");
});

// API endpoint for player statistics
app.get("/api/statistics/:username/:game", async (req, res) => {
  try {
    const { username, game } = req.params;
    
    if (!username || !game) {
      return res.status(400).json({
        success: false,
        error: "Missing username or game parameter"
      });
    }

    console.log(`📊 API Request: /statistics/${username}/${game}`);
    
    const playerStats = await getPlayerStats(username);
    
    if (!playerStats || !playerStats.games || playerStats.games.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Player "${username}" not found or has no game stats`
      });
    }

    // Find the game in the player's stats (case-insensitive)
    const gameStats = playerStats.games.find(
      g => g.game.toLowerCase() === game.toLowerCase()
    );

    if (!gameStats) {
      const availableGames = playerStats.games.map(g => g.game).join(", ");
      return res.status(404).json({
        success: false,
        error: `Game "${game}" not found for player "${username}"`,
        available_games: playerStats.games.map(g => g.game)
      });
    }

    // Prepare statistics object - include all non-zero stats
    const stats: any = {
      wins: gameStats.wins || 0,
    };
    
    if (gameStats.kills && gameStats.kills > 0) stats.kills = gameStats.kills;
    if (gameStats.deaths && gameStats.deaths > 0) stats.deaths = gameStats.deaths;
    if (gameStats.gamesPlayed && gameStats.gamesPlayed > 0) stats.games_played = gameStats.gamesPlayed;
    if (gameStats.xp && gameStats.xp > 0) stats.xp = gameStats.xp;
    if (gameStats.eggs_broken && gameStats.eggs_broken > 0) stats.eggs_broken = gameStats.eggs_broken;
    if (gameStats.eliminations && gameStats.eliminations > 0) stats.eliminations = gameStats.eliminations;
    if (gameStats.time_played && gameStats.time_played > 0) stats.time_played = gameStats.time_played;
    if (gameStats.current_win_streak && gameStats.current_win_streak > 0) stats.current_win_streak = gameStats.current_win_streak;
    if (gameStats.best_win_streak && gameStats.best_win_streak > 0) stats.best_win_streak = gameStats.best_win_streak;
    if (gameStats.assists && gameStats.assists > 0) stats.assists = gameStats.assists;
    if (gameStats.arrows_hit && gameStats.arrows_hit > 0) stats.arrows_hit = gameStats.arrows_hit;
    if (gameStats.arrows_shot && gameStats.arrows_shot > 0) stats.arrows_shot = gameStats.arrows_shot;
    if (gameStats.blocks_placed && gameStats.blocks_placed > 0) stats.blocks_placed = gameStats.blocks_placed;
    if (gameStats.blocks_broken && gameStats.blocks_broken > 0) stats.blocks_broken = gameStats.blocks_broken;
    if (gameStats.blocks_walked && gameStats.blocks_walked > 0) stats.blocks_walked = gameStats.blocks_walked;

    // Calculate ratios
    const ratios: any = {};
    if (gameStats.kills && gameStats.deaths && gameStats.deaths > 0) {
      ratios.kd_ratio = parseFloat((gameStats.kills / gameStats.deaths).toFixed(2));
    }
    if (gameStats.gamesPlayed && gameStats.gamesPlayed > gameStats.wins) {
      ratios.win_rate = parseFloat(((gameStats.wins / gameStats.gamesPlayed) * 100).toFixed(1));
    }

    // Return formatted response
    const response = {
      success: true,
      player: username,
      game: gameStats.game,
      statistics: stats
    };
    
    if (Object.keys(ratios).length > 0) {
      (response as any).ratios = ratios;
    }
    
    (response as any).timestamp = new Date().toISOString();
    
    res.json(response);
    console.log(`✅ API Response sent for ${username}/${gameStats.game}`);
    
  } catch (error: any) {
    console.error("❌ API Error:", error);
    
    // Handle specific API errors
    if (error.response?.status === 400 || error.message?.includes('400')) {
      return res.status(404).json({
        success: false,
        error: `Player "${req.params.username}" not found on CubeCraft`
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Download bot files endpoint
app.get('/api/download-bot', (req, res) => {
  try {
    const botDir = process.cwd();
    const zipPath = path.join('/tmp', 'CubeCraftBot.zip');
    
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    let responseStarted = false;
    
    archive.on('error', (err: any) => {
      console.error('Archive error:', err);
      if (!responseStarted) {
        responseStarted = true;
        res.status(500).json({ error: 'Failed to create archive' });
      }
    });
    
    output.on('error', (err: any) => {
      console.error('Output stream error:', err);
      if (!responseStarted) {
        responseStarted = true;
        res.status(500).json({ error: 'Failed to write file' });
      }
    });
    
    output.on('close', () => {
      if (!responseStarted) {
        responseStarted = true;
        res.download(zipPath, 'CubeCraftBot.zip', (err) => {
          if (err) console.error('Download error:', err);
          fs.unlink(zipPath, () => {});
        });
      }
    });
    
    archive.pipe(output);
    archive.directory(`${botDir}/src`, 'src');
    archive.directory(`${botDir}/logs`, 'logs');
    archive.file(`${botDir}/package.json`, { name: 'package.json' });
    archive.file(`${botDir}/tsconfig.json`, { name: 'tsconfig.json' });
    
    // README is optional
    if (fs.existsSync(`${botDir}/README.md`)) {
      archive.file(`${botDir}/README.md`, { name: 'README.md' });
    }
    
    archive.finalize();
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download bot files' });
  }
});

// Setup dashboard
setupDashboard(app);

app.listen(parseInt(PORT_EXPRESS.toString()), "0.0.0.0", async () => {
  console.log(`Server is alive on port ${PORT_EXPRESS}`);
  
  // Initialize daily snapshots here so the web server is responsive immediately
  await initializeDailySnapshots();
});

import * as leaderboardCommand from "./commands/leaderboard.js";
import * as helpCommand from "./commands/help.js";
import * as pingCommand from "./commands/ping.js";
import * as marketplaceCommand from "./commands/marketplace.js";
import * as playerCommand from "./commands/player.js";
import * as sayCommand from "./commands/say.js";
import * as suggestionCommand from "./commands/suggestion.js";
import * as tierCommand from "./commands/tier.js";
import { initLogger, getLogger } from "./utils/logger.js";
import {
  getAvailableGames,
  getLeaderboard,
  getTotalWinsLeaderboard,
  getPlayerStats,
} from "./services/cubecraft-api.js";
import { cleanOldSnapshots, calculatePeriodWins } from "./services/snapshot.js";
import { logCommandUsage, logGuildJoin, logGuildLeave, logDM } from "./services/activity-logger.js";
import { isBlacklisted } from "./services/blacklist.js";
import { getConfig } from "./services/config-manager.js";
import cron from "node-cron";

interface Command {
  data: {
    name: string;
    toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

const commands: Command[] = [
  leaderboardCommand,
  helpCommand,
  pingCommand,
  marketplaceCommand,
  playerCommand,
  sayCommand,
  suggestionCommand,
  tierCommand,
];

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) {
  console.error("❌ Missing DISCORD_BOT_TOKEN environment variable");
  process.exit(1);
}

if (!clientId) {
  console.error("❌ Missing DISCORD_CLIENT_ID environment variable");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commandCollection = new Collection<string, Command>();
for (const command of commands) {
  commandCollection.set(command.data.name, command);
}

async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(token!);

  console.log("🔄 Registering slash commands...");

  try {
    const commandData = commands.map((cmd) => cmd.data.toJSON());

    await rest.put(Routes.applicationCommands(clientId!), {
      body: commandData,
    });

    console.log(
      `✅ Successfully registered ${commands.length} slash commands globally`,
    );
  } catch (error) {
    console.error("❌ Failed to register slash commands:", error);
    throw error;
  }
}

client.on(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot is online as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} server(s)`);
  console.log(
    `🎮 Commands: ${commands.map((c) => "/" + c.data.name).join(", ")}`,
  );

  // Set bot client for dashboard
  setBotClient(readyClient);

  // Initialize logger after client is ready
  initLogger(readyClient);

  // Load saved configuration and apply
  const savedConfig = getConfig();
  try {
    if (savedConfig.status) {
      await readyClient.user.setStatus(savedConfig.status as any);
      console.log(`📌 Restored bot status: ${savedConfig.status}`);
    }
    if (savedConfig.activity) {
      await readyClient.user.setActivity(savedConfig.activity.name, { type: savedConfig.activity.type as any });
      console.log(`📌 Restored bot activity: ${savedConfig.activity.name}`);
    } else {
      // Default activity if none saved
      await readyClient.user.setActivity("/help", { type: ActivityType.Watching });
    }
  } catch (error) {
    console.error('Error loading saved config:', error);
    // Fallback to default activity
    await readyClient.user.setActivity("/help", { type: ActivityType.Watching });
  }

  // Log bot joins
  readyClient.on('guildCreate', (guild) => {
    logGuildJoin(guild.id, guild.name, guild.memberCount, guild.ownerId);
    console.log(`✅ Bot joined guild: ${guild.name} (${guild.memberCount} members)`);
  });

  // Log bot leaves
  readyClient.on('guildDelete', (guild) => {
    logGuildLeave(guild.id, guild.name);
    console.log(`❌ Bot left guild: ${guild.name}`);
  });

  // Log DMs (including from bots)
  readyClient.on('messageCreate', (message) => {
    if (!message.guild) {
      logDM(message.author.id, message.author.username, message.content);
      console.log(`💬 DM from ${message.author.username}: ${message.content.substring(0, 50)}...`);
    }
  });

  // Schedule automatic resets at 00:00 UTC every day
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("🕒 [Cron] Running scheduled daily snapshot update...");
      await initializeDailySnapshots();
      console.log("✅ [Cron] Daily reset complete.");
    },
    {
      timezone: "UTC",
    },
  );
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const command = commandCollection.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(
            `Error in autocomplete for ${interaction.commandName}:`,
            error,
          );
          try {
            const logger = getLogger();
            await logger.logError(
              interaction.commandName,
              error,
              interaction.user.username,
              interaction.user.id,
            );
          } catch (logError) {
            console.error("Failed to log autocomplete error:", logError);
          }
        }
      }
      return;
    }

    // Handle modals
    if (interaction.isModalSubmit()) {
      const logger = getLogger();
      await logger.logModalSubmission(
        interaction.customId,
        interaction.user.username,
        interaction.user.id,
      );

      if (interaction.customId === "suggestion_modal") {
        try {
          await suggestionCommand.handleSuggestionModal(interaction);
        } catch (error) {
          console.error("Error handling suggestion modal:", error);
          await logger.logError(
            "suggestion",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      } else if (interaction.customId.startsWith("reject_modal_")) {
        try {
          await suggestionCommand.handleRejectionModal(interaction);
        } catch (error) {
          console.error("Error handling rejection modal:", error);
          await logger.logError(
            "suggestion",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      } else if (interaction.customId.startsWith("accept_modal_")) {
        try {
          await suggestionCommand.handleAcceptanceModal(interaction);
        } catch (error) {
          console.error("Error handling acceptance modal:", error);
          await logger.logError(
            "suggestion",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      } else if (interaction.customId.startsWith("lb_jump_modal_")) {
        try {
          await leaderboardCommand.handleJumpToPlayerModal(interaction);
        } catch (error) {
          console.error("Error handling jump to player modal:", error);
          await logger.logError(
            "leaderboard",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      } else if (interaction.customId.startsWith("tier_edit_modal_")) {
        try {
          await tierCommand.handleTierEditModal(interaction);
        } catch (error) {
          console.error("Error handling tier edit modal:", error);
          await logger.logError(
            "tier",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      }
      return;
    }

    // Handle buttons
    if (interaction.isButton()) {
      const logger = getLogger();

      // Handle stats pagination buttons
      if (interaction.customId.startsWith("stats_")) {
        // Forward to the original interaction (this is handled by collector)
        return;
      }
      await logger.logButtonInteraction(
        interaction.customId,
        interaction.user.username,
        interaction.user.id,
      );

      if (interaction.customId.includes("_suggestion")) {
        try {
          await suggestionCommand.handleSuggestionButton(interaction);
        } catch (error) {
          console.error("Error handling suggestion button:", error);
          await logger.logError(
            "suggestion",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      } else if (interaction.customId.startsWith("lb_")) {
        try {
          await leaderboardCommand.handleLeaderboardButton(interaction);
        } catch (error) {
          console.error("Error handling leaderboard button:", error);
          await logger.logError(
            "leaderboard",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      } else if (interaction.customId.includes("tier_")) {
        try {
          if (interaction.customId === 'tier_edit' || interaction.customId === 'tier_submit') {
            await tierCommand.handleTierButton(interaction);
          } else if (interaction.customId.includes('tier_accept_') || interaction.customId.includes('tier_reject_')) {
            await tierCommand.handleTierAdminButton(interaction);
          }
        } catch (error) {
          console.error("Error handling tier button:", error);
          await logger.logError(
            "tier",
            error,
            interaction.user.username,
            interaction.user.id,
          );
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commandCollection.get(interaction.commandName);

    if (!command) {
      console.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    // Check if user is blacklisted
    if (isBlacklisted(interaction.user.id)) {
      await interaction.reply({
        content: "❌ You have been **BANNED** from using this bot.",
        ephemeral: true,
        embeds: []
      });
      console.warn(`Blocked blacklisted user: ${interaction.user.username} (${interaction.user.id})`);
      return;
    }

    // Log command usage
    const logger = getLogger();
    const guildName = interaction.guild?.name || "Unknown Guild";
    await logger.logCommandUsage(
      interaction.commandName,
      interaction.user.username,
      interaction.user.id,
      guildName,
    );
    
    // Log to activity logger
    logCommandUsage(
      interaction.user.id,
      interaction.user.username,
      interaction.commandName,
      interaction.guild?.id,
      guildName
    );

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(
        `Error executing command ${interaction.commandName}:`,
        error,
      );
      await logger.logError(
        interaction.commandName,
        error,
        interaction.user.username,
        interaction.user.id,
      );

      const errorMessage =
        "There was an error executing this command. Please try again later.";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  } catch (error) {
    console.error("Fatal error in interaction handler:", error);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function initFileServer(): void {
  const publicDir = path.join(__dirname, "../public");

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!req.url || req.url === "/" || req.url === "") {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CubeCraft Bot - Download</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: #fff; }
            h1 { color: #FF6B35; }
            a { display: inline-block; margin: 10px; padding: 10px 20px; background: #FF6B35; color: #fff; text-decoration: none; border-radius: 5px; }
            a:hover { background: #ff5500; }
          </style>
        </head>
        <body>
          <h1>CubeCraft Discord Bot</h1>
          <p>تحميل ملفات المشروع</p>
          <a href="/cubecraft-bot.tar.gz">⬇️ تحميل المشروع (cubecraft-bot.tar.gz)</a>
        </body>
        </html>
      `;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlContent);
      return;
    }

    const fileName = req.url.split("/").pop();
    const filePath = path.join(publicDir, fileName!);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("File not found");
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      ".tar.gz": "application/gzip",
      ".gz": "application/gzip",
      ".zip": "application/zip",
      ".png": "image/png",
      ".jpg": "image/jpeg",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    const stat = fs.statSync(filePath);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });

  server.listen(5000, "0.0.0.0", () => {
    console.log("📂 File server running at http://localhost:5000");
  });
}

async function initializeDailySnapshots(): Promise<void> {
  try {
    console.log("📸 Initializing daily snapshots for all games...");

    // Clean old files first (keep 90 days for monthly stats)
    cleanOldSnapshots(90);

    const games = await getAvailableGames();

    if (!games || games.length === 0) {
      console.warn("⚠️  No games found for snapshot initialization");
      return;
    }

    console.log(`📊 Found ${games.length} games. Creating snapshots...`);

    // Process all games in parallel with a slightly higher concurrency for initial setup
    const chunks = [];
    const size = 10;
    for (let i = 0; i < games.length; i += size) {
      chunks.push(games.slice(i, i + size));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (game) => {
          try {
            const lb = await getLeaderboard(game, "alltime", 100);
            if (lb && lb.entries) {
              calculatePeriodWins(lb.entries, game, "daily");
              calculatePeriodWins(lb.entries, game, "weekly");
              calculatePeriodWins(lb.entries, game, "monthly");
            }
          } catch (error) {
            // Silent catch for individual games
          }
        }),
      );
    }

    console.log(`✅ Snapshots initialized for all games.`);
  } catch (error) {
    console.error("❌ Failed to initialize daily snapshots:", error);
  }
}

async function main(): Promise<void> {
  console.log("🚀 Starting CubeCraft Stats Bot...");

  // Register commands first
  await registerCommands();

  // Initialize daily snapshots for all games before logging in
  // Move this after app.listen to ensure dashboard is up while snapshots load
  
  await client.login(token);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
