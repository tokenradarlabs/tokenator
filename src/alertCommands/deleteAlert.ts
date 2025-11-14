import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { createContextualLogger } from "../utils/logger";
import { sendErrorReply, errorMessages } from "../utils/errorMessageUtils";
import { deleteAlert, findPriceAlertById, findVolumeAlertById } from "../lib/alertcommands";
import { sanitizeString, sanitizeBoolean } from "../utils/inputSanitization";

export const deleteAlertCommand = new SlashCommandBuilder()
  .setName("delete-alert")
  .setDescription("Deletes a price or volume alert by its ID, or all disabled alerts by type.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to delete.")
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("delete-disabled")
      .setDescription("Delete all disabled alerts in this channel.")
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Type of alert to delete (price, volume, or all). Required for bulk delete.")
      .setRequired(false)
      .addChoices(
        { name: "Price", value: "price" },
        { name: "Volume", value: "volume" },
        { name: "All", value: "all" }
      )
  )
  .toJSON();

export async function handleDeleteAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = sanitizeString(interaction.options.getString("id"));
  const deleteDisabled = sanitizeBoolean(interaction.options.getBoolean("delete-disabled"));
  const type = sanitizeString(interaction.options.getString("type")) as 'price' | 'volume' | 'all' | null;
  const { guildId, channelId } = interaction;
  const contextualLogger = createContextualLogger({
    userId: interaction.user.id,
    guildId: guildId || undefined,
    channelId: channelId || undefined,
    commandName: 'delete-alert',
  });

  if (!guildId || !channelId) {
    await sendErrorReply(interaction, errorMessages.commandOnlyInGuild());
    return;
  }

  if (alertId && !alertId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
    await sendErrorReply(interaction, errorMessages.invalidAlertIdFormat());
    return;
  }

  try {
    if (alertId) {
      const priceAlert = await findPriceAlertById(alertId, guildId);
      const volumeAlert = await findVolumeAlertById(alertId, guildId);

      if (!priceAlert && !volumeAlert) {
        await sendErrorReply(interaction, errorMessages.alertNotFound(alertId));
        return;
      }
    }
    const result = await deleteAlert({
      alertId: alertId || undefined,
      deleteDisabled: deleteDisabled || undefined,
      type: type || undefined,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    contextualLogger.error({ err: error }, 'Error in handleDeleteAlert:');
    await sendErrorReply(interaction, errorMessages.unexpectedError());
  }
}
