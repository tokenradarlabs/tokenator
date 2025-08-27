import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import { deleteVolumeAlert } from "../lib/alertcommands";

export const deleteVolumeAlertCommand = new SlashCommandBuilder()
  .setName("delete-volume-alert")
  .setDescription("Deletes a volume alert by its ID or all disabled volume alerts.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the volume alert to delete.")
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("delete-disabled")
      .setDescription("Delete all disabled volume alerts in this channel.")
      .setRequired(false)
  )
  .toJSON();

export async function handleDeleteVolumeAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString("id");
  const deleteDisabled = interaction.options.getBoolean("delete-disabled");
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: "This command can only be used in a server channel.",
      flags: 64,
    });
    return;
  }

  try {
    const result = await deleteVolumeAlert({
      alertId: alertId || undefined,
      deleteDisabled: deleteDisabled || undefined,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error('Error in handleDeleteVolumeAlert:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
