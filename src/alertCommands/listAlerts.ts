import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import logger from "../utils/logger";
import { PriceAlertDirection, VolumeAlertDirection } from "../generated/prisma/client";
import { listAlerts, formatAlertsForDisplay } from "../lib/alertcommands";

export const listAlertsCommand = new SlashCommandBuilder()
  .setName("list-alerts")
  .setDescription("Lists all alerts for the current channel.")
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
        "Filter by alert type"
      )
      .setRequired(false)
      .addChoices(
        { name: "Price", value: "price" },
        { name: "Volume", value: "volume" },
        { name: "All", value: "all" }
      ),
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

export async function handleListAlerts(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const { guildId, channelId } = interaction;
  const direction = interaction.options.getString(
    "direction",
  ) as PriceAlertDirection | VolumeAlertDirection | null;
  const alertType = interaction.options.getString("type");
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
    const result = await listAlerts({
      guildId,
      channelId,
      direction: direction || undefined,
      alertType: alertType || undefined,
      tokenAddress: tokenAddress || undefined,
      enabledStatus: enabledStatus || undefined,
    });

    if (!result.success) {
      await interaction.reply({
        content: result.message || "Sorry, there was an error listing the alerts.",
        flags: 64,
      });
      return;
    }

    if (!result.alerts || result.alerts.length === 0) {
      await interaction.reply({
        content: result.message || "No alerts found for this channel with the specified filters.",
        flags: 64,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Alerts in this Channel")
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
