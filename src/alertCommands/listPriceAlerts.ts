import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import logger from "../utils/logger";
import { PriceAlertDirection } from "../generated/prisma/client";
import { listPriceAlerts, formatAlertsForDisplay } from "../lib/alertcommands";

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
    const result = await listPriceAlerts({
      guildId,
      channelId,
      direction: direction || undefined,
      tokenAddress: tokenAddress || undefined,
      enabledStatus: enabledStatus || undefined,
    });

    if (!result.success) {
      await interaction.reply({
        content: result.message || "Sorry, there was an error listing the price alerts.",
        flags: 64,
      });
      return;
    }

    if (!result.alerts || result.alerts.length === 0) {
      await interaction.reply({
        content: result.message || "No price alerts found for this channel with the specified filters.",
        flags: 64,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Price Alerts in this Channel")
      .setColor(0x0099ff)
      .setTimestamp();

    const description = formatAlertsForDisplay(result.alerts);
    embed.setDescription(description);

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in handleListPriceAlerts:', error);
    await interaction.reply({
      content: "Sorry, there was an unexpected error. Please try again later.",
      flags: 64,
    });
  }
}
