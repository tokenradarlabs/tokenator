import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ApplicationCommandDataResolvable,
} from "discord.js";
import logger from "./utils/logger";
import { startDevPriceUpdateJob } from "./cron/priceUpdateJob";
import { fetchTokenPrice, formatNumber } from "./utils/coinGecko";
import { UNISWAP_LINK } from "./utils/constants";
import {
  createPriceAlertCommand,
  handleCreatePriceAlert,
} from "./alertCommands/createPriceAlert";
import {
  listPriceAlertsCommand,
  handleListPriceAlerts,
} from "./alertCommands/listPriceAlerts";
import {
  editPriceAlertCommand,
  handleEditPriceAlert,
} from "./alertCommands/editPriceAlert";

import { getDevPrice } from "./utils/uniswapPrice";

const token: string | undefined = process.env.DISCORD_TOKEN;

// Check if the token is set
if (!token) {
  logger.error("Error: DISCORD_TOKEN is not set in the .env file.");
  logger.info(
    "Please create a .env file in the root directory and add your bot token as DISCORD_TOKEN=your_token_here."
  );
  logger.info(
    "You can also set a BOT_PREFIX in the .env file (e.g., BOT_PREFIX=?)"
  );
  process.exit(1);
}

// Define command data
const commandsData: ApplicationCommandDataResolvable[] = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Fetches and displays the current DEV token price.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("uniswap")
    .setDescription("Returns the Uniswap link for the token.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("mcap")
    .setDescription("Returns the market cap of the token.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("price-change")
    .setDescription(
      "Returns the price change over the last 24 hours of the DEV token."
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Returns the 24h volume of the token.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("total-price")
    .setDescription(
      "Calculates the USD price for a given amount of DEV tokens."
    )
    .addNumberOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount of DEV tokens")
        .setRequired(true)
    )
    .toJSON(),
  createPriceAlertCommand,
  listPriceAlertsCommand,
  editPriceAlertCommand,
];

async function createDiscordServer(): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  await client.login(token!);
  return client;
}

async function handleInteractionCommands(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    await interaction.reply("Pong!");
  } else if (commandName === "price") {
    try {
      const price = await getDevPrice();
      if (price) {
        const replyMessage = `**DEV Token Price:** $${price.toFixed(5)}\n`;
        await interaction.reply(replyMessage);
      } else {
        await interaction.reply(
          "Sorry, couldn't fetch the price right now. Please try again later."
        );
      }
    } catch (error) {
      logger.error("Error fetching DEV price from Uniswap", error);
      await interaction.reply(
        "Sorry, couldn't fetch the price right now. Please try again later."
      );
    }
  } else if (commandName === "uniswap") {
    await interaction.reply(UNISWAP_LINK);
  } else if (commandName === "volume") {
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData) {
      const replyMessage = `**DEV Token 24h Volume:** $${tokenData.usd_24h_vol?.toFixed(
        2
      )}`;
      await interaction.reply(replyMessage);
    } else {
      await interaction.reply(
        "Sorry, couldn't fetch the volume right now. Please try again later."
      );
    }
  } else if (commandName === "price-change") {
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData) {
      const change24h = tokenData.usd_24h_change;
      const changeEmoji = change24h! >= 0 ? "📈" : "📉";
      const replyMessage = `**DEV Token 24h Price Change:** ${changeEmoji}${change24h?.toFixed(
        2
      )}%`;
      await interaction.reply(replyMessage);
    } else {
      await interaction.reply(
        "Sorry, couldn't fetch the price change right now. Please try again later."
      );
    }
  } else if (commandName === "mcap") {
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData && typeof tokenData.usd_market_cap === "number") {
      const formattedMarketCap = formatNumber(tokenData.usd_market_cap);
      const replyMessage = `**DEV Token Market Cap:** $${formattedMarketCap}`;
      await interaction.reply(replyMessage);
    } else {
      await interaction.reply(
        "Sorry, couldn't fetch the market cap right now. Please try again later."
      );
    }
  } else if (commandName === "total-price") {
    const amount = interaction.options.getNumber("amount", true);
    try {
      const price = await getDevPrice();
      if (price) {
        const totalUsdPrice = amount * price;
        const roundedUpPrice = Math.round(totalUsdPrice * 1000) / 1000;
        const replyMessage = `**${amount} DEV tokens are currently worth:** $${roundedUpPrice.toFixed(
          3
        )}`;
        await interaction.reply(replyMessage);
      } else {
        await interaction.reply(
          "Sorry, couldn't fetch the token price right now. Please try again later."
        );
      }
    } catch (error) {
      logger.error(
        "Error fetching DEV price from Uniswap for total-price",
        error
      );
      await interaction.reply(
        "Sorry, couldn't fetch the token price right now. Please try again later."
      );
    }
  } else if (commandName === "create-price-alert") {
    await handleCreatePriceAlert(interaction);
  } else if (commandName === "list-alerts") {
    await handleListPriceAlerts(interaction);
  } else if (commandName === "edit-price-alert") {
    await handleEditPriceAlert(interaction);
  }
}

/**
 * Initializes and starts all cron jobs for the application.
 * @param client The Discord Client instance
 */
function initializeCronJobs(client: Client): void {
  logger.info("Initializing cron jobs...");
  startDevPriceUpdateJob(client);
  logger.info("Cron jobs initialized.");
}

async function main(): Promise<void> {
  try {
    const client = await createDiscordServer();

    if (!client.user) {
      logger.error("Client user is not available after login.");
      process.exit(1);
    }

    logger.info("Started bot successfully", { tag: client.user.tag });

    const rest = new REST({ version: "10" }).setToken(token!);

    // Fetch existing application commands
    // The REST get operation returns an array of unknown and needs to be cast.
    // We are interested in objects that have at least an id and a name.
    const existingCommands = (await rest.get(
      Routes.applicationCommands(client.user.id)
    )) as { id: string; name: string }[];

    // Commands to delete
    const commandsToDelete = existingCommands.filter(
      (command) =>
        !commandsData.some(
          (data) => "name" in data && data.name === command.name
        )
    );

    for (const command of commandsToDelete) {
      await rest.delete(Routes.applicationCommand(client.user.id, command.id));
      logger.info("Deleted unused command", { command: command.name });
    }

    // Commands to create/update (simplified: just create new ones)
    // For a full update, one might compare more properties or use PUT requests for individual commands
    const newCommandsToRegister = commandsData.filter(
      (data) =>
        "name" in data && !existingCommands.some((c) => c.name === data.name)
    );

    if (newCommandsToRegister.length > 0) {
      logger.info("Registering new slash commands...");
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commandsData } // We can send all commandsData; Discord API handles updates/creations.
        // Or, send only newCommandsToRegister for more granular control as in the example.
        // For simplicity here, sending all.
      );
      newCommandsToRegister.forEach((command) => {
        if ("name" in command) {
          logger.info("Slash command created/updated", {
            command: command.name,
          });
        }
      });
    }

    client.on("interactionCreate", async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await handleInteractionCommands(interaction);
      }
    });

    logger.info(`Ready! Logged in as ${client.user.tag}`);

    initializeCronJobs(client);
  } catch (error) {
    logger.error("Detailed error starting bot:", error);
    console.error("[CONSOLE] Detailed error starting bot:", error);
    process.exit(1);
  }
}

logger.info("Bot is starting...");
main();
