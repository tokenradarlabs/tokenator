import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";

export const deletePriceAlertCommand = new SlashCommandBuilder()
  .setName("delete-alert")
  .setDescription("Deletes a price alert by its ID.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to delete.")
      .setRequired(true)
  )
  .toJSON();

export async function handleDeletePriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString("id", true);
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: "This command can only be used in a server channel.",
      flags: 64,
    });
    return;
  }

  try {
    logger.info(`Attempting to delete alert ${alertId} from guild ${guildId} channel ${channelId}`);

    // First check if the alert exists and belongs to this server/channel
    const alert = await prisma.alert.findUnique({
      where: {
        id: alertId,
        discordServerId: guildId,
        channelId: channelId,
      },
      include: {
        priceAlert: true
      }
    }).catch(err => {
      logger.error('Error finding alert:', err);
      throw err;
    });

    if (!alert) {
      logger.info(`Alert ${alertId} not found or not accessible`);
      await interaction.reply({
        content: "Alert not found or you do not have permission to delete it.",
        flags: 64,
      });
      return;
    }

    logger.info(`Found alert ${alertId}, has priceAlert: ${!!alert.priceAlert}`);

    try {
      // Delete the PriceAlert first if it exists
      if (alert.priceAlert) {
        logger.info(`Deleting PriceAlert for alert ${alertId}`);
        await prisma.priceAlert.delete({
          where: {
            alertId: alertId
          }
        });
      }

      // Then delete the Alert
      logger.info(`Deleting Alert ${alertId}`);
      await prisma.alert.delete({
        where: {
          id: alertId
        }
      });

      logger.info(`Successfully deleted alert ${alertId}`);
      await interaction.reply({
        content: `Successfully deleted alert with ID: \`${alertId}\``,
        flags: 64,
      });
    } catch (deleteError) {
      logger.error('Error during delete operation:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    logger.error("Error deleting price alert:", {
      error,
      alertId,
      guildId,
      channelId
    });
    
    let errorMessage = "Sorry, there was an error deleting the price alert.";
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }
    
    await interaction.reply({
      content: errorMessage,
      flags: 64,
    });
  }
}