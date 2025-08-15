import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";
import { PriceAlertDirection } from "../generated/prisma/client";
import { formatPriceForDisplay } from "../utils/priceFormatter";

export const listPriceAlertsCommand = new SlashCommandBuilder()
  .setName("list-alerts")
  .setDescription("Lists all price alerts for the current channel.")
  .addStringOption((option) =>
    option
      .setName("direction")
      .setDescription("Filter by direction.")
      .setRequired(false)
      .addChoices({ name: "Up", value: "up" }, { name: "Down", value: "down" }),
  )
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription(
        "Filter by alert type (currently only 'price' is supported).",
      )
      .setRequired(false)
      .addChoices({ name: "Price", value: "price" }),
  )
  .addStringOption((option) =>
    option
      .setName("token")
      .setDescription("Filter by token address")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("enabled")
      .setDescription("Filter by enable status")
      .setRequired(false)
      .addChoices({ name: "Enabled", value: "true" }, { name: "Disabled", value: "false" }),
  )
  .toJSON();

export async function handleListPriceAlerts(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const { guildId, channelId } = interaction;
  const direction = interaction.options.getString(
    "direction",
  ) as PriceAlertDirection | null;
  const tokenAddress = interaction.options.getString("token");
  const enabledStatus = interaction.options.getString("enabled");

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

    if (tokenAddress) {
      whereClause.token = { address: tokenAddress };
    }

    if (enabledStatus !== null) {
      whereClause.enabled = enabledStatus === "true";
    }

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        priceAlert: true,
        token: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (alerts.length === 0) {
      await interaction.reply({
        content:
          "No price alerts found for this channel with the specified filters.",
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
        const directionEmoji =
          alert.priceAlert.direction === "up" ? "📈" : "📉";
        const enabledEmoji = alert.enabled ? "✅" : "❌";
        const enabledText = alert.enabled ? "Enabled" : "Disabled";
        
        description += `**ID:** \`${alert.id}\`\n`;
        description += `**Token:** \`${alert.token.address}\`\n`;
        description += `**Type:** Price\n`;
        description += `**Direction:** ${alert.priceAlert.direction} ${directionEmoji}\n`;
        description += `**Value:** ${formatPriceForDisplay(alert.priceAlert.value)}\n`;
        description += `**Status:** ${enabledText} ${enabledEmoji}\n`;
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
