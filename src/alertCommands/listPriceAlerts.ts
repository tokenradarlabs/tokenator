import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";
import { PriceAlertDirection } from "../generated/prisma/client";

export const listPriceAlertsCommand = new SlashCommandBuilder()
  .setName("list-alerts")
  .setDescription("Lists all price alerts for the current channel.")
  .addStringOption((option) =>
    option
      .setName("direction")
      .setDescription("Filter by direction.")
      .setRequired(false)
      .addChoices({ name: "Up", value: "up" }, { name: "Down", value: "down" })
  )
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Filter by alert type (currently only 'price' is supported).")
      .setRequired(false)
      .addChoices({ name: "Price", value: "price" })
  )
  .toJSON();

export async function handleListPriceAlerts(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { guildId, channelId } = interaction;
  const direction = interaction.options.getString("direction") as PriceAlertDirection | null;
  const type = interaction.options.getString("type");

  if (!guildId || !channelId) {
    await interaction.reply({
      content: "This command can only be used in a server channel.",
      flags: 64,
    });
    return;
  }

  try {
    const whereClause: any = {
      discordServerId: guildId,
      channelId: channelId,
      priceAlert: {
        isNot: null,
      },
    };

    if (direction) {
      whereClause.priceAlert = { direction: direction };
    }

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        priceAlert: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (alerts.length === 0) {
      await interaction.reply({
        content: "No price alerts found for this channel with the specified filters.",
        flags: 64,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Price Alerts in this Channel")
      .setColor(0x0099ff)
      .setTimestamp();

    let description = "";
    alerts.forEach((alert) => {
        if (alert.priceAlert) {
            const directionEmoji = alert.priceAlert.direction === 'up' ? '📈' : '📉';
            description += `**ID:** \`${alert.id}\`\n`;
            description += `**Type:** Price\n`;
            description += `**Direction:** ${alert.priceAlert.direction} ${directionEmoji}\n`;
            description += `**Value:** $${alert.priceAlert.value}\n`;
            description += `**Created At:** <t:${Math.floor(alert.createdAt.getTime() / 1000)}:R>\n\n`;
        }
    });

    embed.setDescription(description);

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    logger.error("Error listing price alerts:", error);
    await interaction.reply({
      content: "Sorry, there was an error listing the price alerts.",
      flags: 64,
    });
  }
} 