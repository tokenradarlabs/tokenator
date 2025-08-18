import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ApplicationCommandDataResolvable,
} from 'discord.js';
import { config } from './config';
import logger from './utils/logger';
import { startDevPriceUpdateJob } from './cron/priceUpdateJob';
import {
  formatNumber,
  fetchTokenPriceDetailed,
  buildFriendlyCoinGeckoError,
} from './utils/coinGecko';
import { getLatestTokenPriceFromDatabase } from './utils/databasePrice';
import { formatPriceForDisplay } from './utils/priceFormatter';
import {
  createPriceAlertCommand,
  handleCreatePriceAlert,
} from './alertCommands/createPriceAlert';
import {
  listPriceAlertsCommand,
  handleListPriceAlerts,
} from './alertCommands/listPriceAlerts';
import {
  editPriceAlertCommand,
  handleEditPriceAlert,
} from './alertCommands/editPriceAlert';
import {
  deletePriceAlertCommand,
  handleDeletePriceAlert,
} from './alertCommands/deletePriceAlert';
import {
  disablePriceAlertCommand,
  handleDisablePriceAlert,
} from './alertCommands/disablePriceAlert';
import {
  enablePriceAlertCommand,
  handleEnablePriceAlert,
} from './alertCommands/enablePriceAlert';
import {
  alertStatsCommand,
  handleAlertStats,
} from './alertCommands/alertStats';
import { getStandardizedTokenId } from './utils/constants';


const token: string = config.DISCORD_TOKEN;

// Token is now guaranteed to be available due to config validation

// Define command data
const commandsData: ApplicationCommandDataResolvable[] = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('Fetches and displays the current token price.')
    .addStringOption(option =>
      option
        .setName('token-id')
        .setDescription("The token's coingecko id (e.g. scout-protocol-token)")
        .setRequired(true)
        .addChoices(
          { name: 'DEV Token', value: 'scout-protocol-token' },
          { name: 'Bitcoin', value: 'bitcoin' },
          { name: 'Ethereum', value: 'ethereum' }
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('mcap')
    .setDescription('Returns the market cap of the token.')
    .addStringOption(option =>
      option
        .setName('token-id')
        .setDescription("The token's coingecko id (e.g. scout-protocol-token)")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('price-change')
    .setDescription(
      'Returns the price change over the last 24 hours of the token.'
    )
    .addStringOption(option =>
      option
        .setName('token-id')
        .setDescription("The token's coingecko id (e.g. scout-protocol-token)")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Returns the 24h volume of the token.')
    .addStringOption(option =>
      option
        .setName('token-id')
        .setDescription("The token's coingecko id (e.g. scout-protocol-token)")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('total-price')
    .setDescription('Calculates the USD price for a given amount of tokens.')
    .addNumberOption(option =>
      option
        .setName('amount')
        .setDescription('The amount of tokens')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('token-id')
        .setDescription("The token's coingecko id (e.g. scout-protocol-token)")
        .setRequired(true)
    )
    .toJSON(),
  createPriceAlertCommand,
  listPriceAlertsCommand,
  editPriceAlertCommand,
  deletePriceAlertCommand,
  disablePriceAlertCommand,
  enablePriceAlertCommand,
  alertStatsCommand,
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

  await client.login(token);
  return client;
}

async function handleInteractionCommands(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('Pong!');
  } else if (commandName === 'price') {
    const tokenId = interaction.options.getString('token-id', true);
    try {
      // Get standardized token ID for database lookup
      const standardizedTokenId = getStandardizedTokenId(tokenId);

      if (!standardizedTokenId) {
        await interaction.reply(
          `Sorry, **${tokenId}** is not a supported token. Please use one of the available choices.`
        );
        return;
      }

      // Get the latest price from the database using the utility function
      const latestPrice = await getLatestTokenPriceFromDatabase(standardizedTokenId);

      if (latestPrice) {
        const replyMessage = `**${tokenId}** Price: ${formatPriceForDisplay(latestPrice)}\n`;
        await interaction.reply(replyMessage);
      } else {
        await interaction.reply(
          `Sorry, couldn't find any price data for **${tokenId}**. Please try again later.`
        );
      }
    } catch (error) {
      logger.error(`Error fetching **${tokenId}** price`, error);
      await interaction.reply(
        `Sorry, an unexpected error occurred fetching **${tokenId}** price.`
      );
    }
  } else if (commandName === 'volume') {
    const tokenId = interaction.options.getString('token-id', true);
    const result = await fetchTokenPriceDetailed(tokenId);
    if (result.ok) {
      const vol = result.data.usd_24h_vol ?? 0;
      const replyMessage = `**${tokenId}** Token 24h Volume: $${vol.toFixed(2)}`;
      await interaction.reply(replyMessage);
    } else {
      const friendly = buildFriendlyCoinGeckoError(tokenId, result);
      await interaction.reply(friendly);
    }
  } else if (commandName === 'price-change') {
    const tokenId = interaction.options.getString('token-id', true);
    const result = await fetchTokenPriceDetailed(tokenId);
    if (result.ok) {
      const change24h = result.data.usd_24h_change ?? 0;
      const changeEmoji = change24h >= 0 ? '📈' : '📉';
      const replyMessage = `**${tokenId}** Token 24h Price Change: ${changeEmoji}${change24h.toFixed(
        2
      )}%`;
      await interaction.reply(replyMessage);
    } else {
      const friendly = buildFriendlyCoinGeckoError(tokenId, result);
      await interaction.reply(friendly);
    }
  } else if (commandName === 'mcap') {
    const tokenId = interaction.options.getString('token-id', true);
    const result = await fetchTokenPriceDetailed(tokenId);
    if (result.ok && typeof result.data.usd_market_cap === 'number') {
      const formattedMarketCap = formatNumber(result.data.usd_market_cap);
      const replyMessage = `**${tokenId}** Token Market Cap: $${formattedMarketCap}`;
      await interaction.reply(replyMessage);
    } else if (!result.ok) {
      const friendly = buildFriendlyCoinGeckoError(tokenId, result);
      await interaction.reply(friendly);
    } else {
      await interaction.reply(
        `Market cap data not available for **${tokenId}** at the moment.`
      );
    }
  } else if (commandName === 'total-price') {
    const amount = interaction.options.getNumber('amount', true);
    const tokenId = interaction.options.getString('token-id', true);
    try {
      // Get standardized token ID for database lookup
      const standardizedTokenId = getStandardizedTokenId(tokenId);

      if (!standardizedTokenId) {
        await interaction.reply(
          `Sorry, **${tokenId}** is not a supported token. Please use one of the available choices.`
        );
        return;
      }

      // Get price from database
      const price = await getLatestTokenPriceFromDatabase(standardizedTokenId);

      if (price) {
        const totalUsdPrice = amount * price;
        const replyMessage = `**${amount} ${tokenId}** tokens are currently worth: ${formatPriceForDisplay(totalUsdPrice)}`;
        await interaction.reply(replyMessage);
      } else {
        await interaction.reply(
          `Sorry, couldn't find any price data for **${tokenId}**. Please try again later.`
        );
      }
    } catch (error) {
      logger.error(
        `Error fetching **${tokenId}** price for total-price`,
        error
      );
      await interaction.reply(
        `Sorry, an unexpected error occurred fetching **${tokenId}** price.`
      );
    }
  } else if (commandName === 'create-price-alert') {
    await handleCreatePriceAlert(interaction);
  } else if (commandName === 'list-alerts') {
    await handleListPriceAlerts(interaction);
  } else if (commandName === 'edit-price-alert') {
    await handleEditPriceAlert(interaction);
  } else if (commandName === 'delete-alert') {
    await handleDeletePriceAlert(interaction);
  } else if (commandName === 'disable-alert') {
    await handleDisablePriceAlert(interaction);
  } else if (commandName === 'enable-alert') {
    await handleEnablePriceAlert(interaction);
  } else if (commandName === 'alert-stats') {
    await handleAlertStats(interaction);
  }
}

/**
 * Initializes and starts all cron jobs for the application.
 * @param client The Discord Client instance
 */
function initializeCronJobs(client: Client): void {
  try {
    logger.info('Initializing cron jobs...');
    startDevPriceUpdateJob(client);
    logger.info('Cron jobs initialized.');
  } catch (error) {
    logger.error('Error initializing cron jobs:', error);
    // Continue without cron jobs rather than crashing
  }
}

async function main(): Promise<void> {
  try {
    const client = await createDiscordServer();

    if (!client.user) {
      logger.error('Client user is not available after login.');
      process.exit(1);
    }

    logger.info('Started bot successfully', { tag: client.user.tag });

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      logger.info('Started refreshing application (/) commands.');

      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandsData,
      });

      logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
      logger.error(error);
    }

    client.on('interactionCreate', async interaction => {
      if (interaction.isChatInputCommand()) {
        await handleInteractionCommands(interaction);
      }
    });

    logger.info(`Ready! Logged in as ${client.user.tag}`);

    initializeCronJobs(client);
  } catch (error) {
    logger.error('Detailed error starting bot:', error);
    console.error('[CONSOLE] Detailed error starting bot:', error);
    process.exit(1);
  }
}

logger.info('Bot is starting...');
main();
