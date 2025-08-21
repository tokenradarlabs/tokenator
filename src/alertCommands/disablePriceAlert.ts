import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import { disablePriceAlert } from "../lib/alertcommands";

export const disablePriceAlertCommand = new SlashCommandBuilder()
  .setName("disable-alert")
  .setDescription("Disables a price alert by its ID or all enabled alerts.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to disable.")
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("disable-all")
      .setDescription("Disable all enabled alerts in this channel.")
      .setRequired(false)
  )
  .toJSON();

export async function handleDisablePriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString("id");
  const disableAll = interaction.options.getBoolean("disable-all");
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: "This command can only be used in a server channel.",
      flags: 64,
    });
    return;
  }

  try {
    const result = await disablePriceAlert({
      alertId: alertId || undefined,
      disableAll: disableAll || undefined,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error('Error in handleDisablePriceAlert:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
} 