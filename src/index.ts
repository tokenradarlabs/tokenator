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
    .setDescription("Fetches and displays the current token price.")
    .addStringOption((option) =>
      option.setName("token")
        .setDescription("The token to fetch the price for.")
        .setRequired(true)
        .addChoices(
          { name: 'DEV', value: 'DEV' },
        ))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("uniswap")
    .setDescription("Returns the Uniswap link for the token.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("mcap")
    .setDescription("Returns the market cap of the token.")
    .addStringOption(option =>
      option.setName("token")
        .setDescription("The token to fetch the market cap for.")
        .setRequired(true)
        .addChoices(
          { name: 'DEV', value: 'DEV' },
        ))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("price-change")
    .setDescription(
      "Returns the price change over the last 24 hours of the token.")
    .addStringOption(option =>
      option.setName("token")
        .setDescription("The token to fetch the price change for.")
        .setRequired(true)
        .addChoices(
          { name: 'DEV', value: 'DEV' },
        ))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Returns the 24h volume of the token.")
    .addStringOption(option =>
      option.setName("token")
        .setDescription("The token to fetch the volume for.")
        .setRequired(true)
        .addChoices(
          { name: 'DEV', value: 'DEV' },
        ))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("total-price")
    .setDescription(
      "Calculates the USD price for a given amount of tokens."
    )
    .addNumberOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount of tokens")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("token")
        .setDescription("The token to calculate the price for.")
        .setRequired(true)
        .addChoices(
          { name: 'DEV', value: 'DEV' },
        ))
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
    const tokenName = interaction.options.getString("token", true);
    try {
      const price = await getDevPrice();
      if (price) {
        const replyMessage = `**${tokenName} Token Price:** $${price.toFixed(5)}\n`;
        await interaction.reply(replyMessage);
      } else {
        await interaction.reply(
          `Sorry, couldn't fetch the ${tokenName} price right now. Please try again later.`
        );
      }
    } catch (error) {
      logger.error(`Error fetching ${tokenName} price from Uniswap`, error);
      await interaction.reply(
        `Sorry, couldn't fetch the ${tokenName} price right now. Please try again later.`
      );
    }
  } else if (commandName === "uniswap") {
    await interaction.reply(UNISWAP_LINK);
  } else if (commandName === "volume") {
    const tokenName = interaction.options.getString("token", true);
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData) {
      const replyMessage = `**${tokenName} Token 24h Volume:** $${tokenData.usd_24h_vol?.toFixed(
        2
      )}`;
      await interaction.reply(replyMessage);
    } else {
      await interaction.reply(
        `Sorry, couldn't fetch the ${tokenName} volume right now. Please try again later.`
      );
    }
  } else if (commandName === "price-change") {
    const tokenName = interaction.options.getString("token", true);
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData) {
      const change24h = tokenData.usd_24h_change;
      const changeEmoji = change24h! >= 0 ? "📈" : "📉";
      const replyMessage = `**${tokenName} Token 24h Price Change:** ${changeEmoji}${change24h?.toFixed(
        2
      )}%`;
      await interaction.reply(replyMessage);
    } else {
      await interaction.reply(
        `Sorry, couldn't fetch the ${tokenName} price change right now. Please try again later.`
      );
    }
  } else if (commandName === "mcap") {
    const tokenName = interaction.options.getString("token", true);
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData && typeof tokenData.usd_market_cap === "number") {
      const formattedMarketCap = formatNumber(tokenData.usd_market_cap);
      const replyMessage = `**${tokenName} Token Market Cap:** $${formattedMarketCap}`;
      await interaction.reply(replyMessage);
    } else {
      await interaction.reply(
        `Sorry, couldn't fetch the ${tokenName} market cap right now. Please try again later.`
      );
    }
  } else if (commandName === "total-price") {
    const amount = interaction.options.getNumber("amount", true);
    const tokenName = interaction.options.getString("token", true);
    try {
      const price = await getDevPrice();
      if (price) {
        const totalUsdPrice = amount * price;
        const roundedUpPrice = Math.round(totalUsdPrice * 1000) / 1000;
        const replyMessage = `**${amount} ${tokenName} tokens are currently worth:** $${roundedUpPrice.toFixed(
          3
        )}`;
        await interaction.reply(replyMessage);
      } else {
        await interaction.reply(
          `Sorry, couldn't fetch the ${tokenName} price right now. Please try again later.`
        );
      }
    } catch (error) {
      logger.error(
        `Error fetching ${tokenName} price from Uniswap for total-price`,
        error
      );
      await interaction.reply(
        `Sorry, couldn't fetch the ${tokenName} price right now. Please try again later.`
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

    try {
      logger.info("Started refreshing application (/) commands.");

      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandsData,
      });

      logger.info("Successfully reloaded application (/) commands.");
    } catch (error) {
      logger.error(error);
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
