import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";
import { fetchTokenPrice } from "../utils/coinGecko";



export const createPriceAlertCommand = new SlashCommandBuilder()
  .setName("create-price-alert")
  .setDescription("Creates a price alert for the DEV token.")
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

  try {
    await prisma.$transaction(async (prisma) => {
      // Ensure server exists and is up to date
      const server = await prisma.discordServer.upsert({
        where: { id: guildId },
        update: { name: interaction.guild?.name },
        create: { id: guildId, name: interaction.guild?.name }
      });

      // Create the Alert with nested PriceAlert creation
      await prisma.alert.create({
        data: {
          channelId: channelId,
          enabled: true,
          discordServerId: server.id,
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
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData) {
      const price = tokenData.usd;
      await interaction.reply(`✅ Alert created! I will notify you in this channel when the price goes ${direction} to $${value}. ${directionEmoji}, the current DEV price is \`$${price}\` `);
    } else {
      await interaction.reply({
        content: "Sorry, couldn't fetch the token price right now. Please try again later.",
        flags: 64
      });
    }
  } catch (error) {
    logger.error("Error creating price alert:", error);
    await interaction.reply({
        content: "Sorry, couldn't fetch the token price right now. Please try again later.",
        flags: 64
    });
  }
}
