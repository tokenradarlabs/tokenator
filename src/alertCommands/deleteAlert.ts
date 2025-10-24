import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import { deleteAlert } from "../lib/alertcommands";

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
  const alertId = interaction.options.getString("id");
  const deleteDisabled = interaction.options.getBoolean("delete-disabled");
  const type = interaction.options.getString("type") as 'price' | 'volume' | 'all' | null;
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: "This command can only be used in a server channel.",
      flags: 64,
    });
    return;
  }

  if (alertId && !alertId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
    await interaction.reply({
      content: "Invalid alert ID format. Please provide a valid UUID.",
      flags: 64,
    });
    return;
  }

  try {
    if (alertId) {
      const priceAlert = await findPriceAlertById(alertId, guildId);
      const volumeAlert = await findVolumeAlertById(alertId, guildId);

      if (!priceAlert && !volumeAlert) {
        await interaction.reply({
          content: `No alert found with ID: \`${alertId}\`.`,
          flags: 64,
        });
        return;
          }
      }    const result = await deleteAlert({
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
    logger.error(error, 'Error in handleDeleteAlert:');
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
