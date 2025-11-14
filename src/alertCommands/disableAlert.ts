import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import { sendErrorReply, errorMessages } from "../utils/errorMessageUtils";
import { disablePriceAlert } from "../lib/alertcommands";
import { sanitizeString } from "../utils/inputSanitization";

export const disablePriceAlertCommand = new SlashCommandBuilder()
  .setName("disable-alert")
  .setDescription("Disables an alert by its ID or enabled alerts by type.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to disable.")
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName("disable-type")
      .setDescription("Choose which type of alerts to disable.")
      .setRequired(false)
      .addChoices(
        { name: "All alerts", value: "all" },
        { name: "Price alerts only", value: "price" },
        { name: "Volume alerts only", value: "volume" }
      )
  )
  .toJSON();

export async function handleDisablePriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = sanitizeString(interaction.options.getString("id"));
  const disableType = sanitizeString(interaction.options.getString("disable-type"));
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await sendErrorReply(interaction, errorMessages.commandOnlyInGuild());
    return;
  }

  try {
    const result = await disablePriceAlert({
      alertId: alertId || undefined,
      disableType: (disableType as 'all' | 'price' | 'volume') || undefined,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in handleDisablePriceAlert:');
    await sendErrorReply(interaction, errorMessages.unexpectedError());
  }
} 