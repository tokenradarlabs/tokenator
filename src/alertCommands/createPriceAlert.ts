import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";
import { getLatestTokenPriceFromDatabase } from "../utils/databasePrice";

// Supported tokens and their normalized IDs
const SUPPORTED_TOKENS = {
  'scout-protocol-token': 'scout-protocol-token',
  'dev': 'scout-protocol-token',
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'ethereum': 'ethereum',
  'eth': 'ethereum'
} as const;

type SupportedTokenId = keyof typeof SUPPORTED_TOKENS;

export const createPriceAlertCommand = new SlashCommandBuilder()
  .setName("create-price-alert")
  .setDescription("Creates a price alert for a supported token.")
  .addStringOption(option =>
    option.setName("token-id")
      .setDescription("The token to create an alert for (supported: dev, eth, btc)")
      .setRequired(true)
      .addChoices(
        { name: 'scout-protocol-token (DEV)', value: 'scout-protocol-token' },
        { name: 'Bitcoin (BTC)', value: 'bitcoin' },
        { name: 'Ethereum (ETH)', value: 'ethereum' }
      ))
  .addStringOption(option =>
    option.setName("direction")
      .setDescription("Price direction to alert on")
      .setRequired(true)
      .addChoices(
        { name: 'Up', value: 'up' },
        { name: 'Down', value: 'down' },
      ))
  .addNumberOption(option =>
    option.setName("value")
      .setDescription("The price value to alert at")
      .setRequired(true))
  .toJSON();

export async function handleCreatePriceAlert(interaction: ChatInputCommandInteraction) {
  const direction = interaction.options.getString("direction", true) as 'up' | 'down';
  const value = interaction.options.getNumber("value", true);
  const tokenId = interaction.options.getString("token-id", true);
  const { guildId, channelId } = interaction;

  if (!guildId) {
    await interaction.reply({ 
      content: "This command can only be used in a server.", 
      flags: 64
    });
    return;
  }

  if (!channelId) {
    await interaction.reply({ 
      content: "This command can only be used in a channel.", 
      flags: 64
    });
    return;
  }

  if (!(tokenId.toLowerCase() in SUPPORTED_TOKENS)) {
    await interaction.reply({
      content: "Unsupported token. Please use one of: DEV, BTC, or ETH.",
      flags: 64
    });
    return;
  }

  try {
    await prisma.$transaction(async (prisma) => {
      // Ensure server exists and is up to date
      const server = await prisma.discordServer.upsert({
        where: { id: guildId },
        update: { name: interaction.guild?.name },
        create: { id: guildId, name: interaction.guild?.name }
      });

      // Ensure token exists with standardized ID
      const standardizedId = SUPPORTED_TOKENS[tokenId.toLowerCase() as SupportedTokenId];
      const token = await prisma.token.upsert({
        where: { address: standardizedId },
        update: {},
        create: { address: standardizedId }
      });

      // Create the Alert with nested PriceAlert creation
      await prisma.alert.create({
        data: {
          channelId: channelId,
          enabled: true,
          discordServerId: server.id,
          tokenId: token.id,
          priceAlert: {
            create: {
              direction: direction,
              value: value
            }
          }
        }
      });
    });

    const directionEmoji = direction === 'up' ? '📈' : '📉';
    const price = await getLatestTokenPriceFromDatabase(tokenId);
    
    if (price !== null) {
      logger.info(`[CreateAlert] Using database price for ${tokenId}: $${price}`);
      await interaction.reply(`✅ Alert created! I will notify you in this channel when the price of **${tokenId}** goes ${direction} to \`$${value}\`. ${directionEmoji}, the current price is \`$${price}\` `);
    } else {
      logger.warn(`[CreateAlert] No database price available for ${tokenId}, alert created without current price display`);
      await interaction.reply({
        content: `⚠️ Alert created successfully! I couldn't fetch the current price from the database right now, but the alert will work once price data is available.`,
        flags: 64
      });
    }
  } catch (error) {
    logger.error("Error creating price alert:", error);
    await interaction.reply({
        content: "Sorry, there was an error creating the price alert. Please try again later.",
        flags: 64
    });
  }
}
