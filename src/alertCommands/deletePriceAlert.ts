import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";

export const deletePriceAlertCommand = new SlashCommandBuilder()
  .setName("delete-alert")
  .setDescription("Deletes a price alert by its ID or all disabled alerts.")
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
  .toJSON();

export async function handleDeletePriceAlert(
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

  
  if (!alertId && deleteDisabled === null) {
    await interaction.reply({
      content: "Please provide either an alert ID or use the delete-disabled option.",
      flags: 64,
    });
    return;
  }

  // bulk
  if (deleteDisabled === true) {
    await handleDeleteDisabledAlerts(interaction, guildId, channelId);
    return;
  }

  // specific
  if (alertId) {
    await handleDeleteSpecificAlert(interaction, alertId, guildId, channelId);
    return;
  }
}

async function handleDeleteDisabledAlerts(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  channelId: string
): Promise<void> {
  try {
    logger.info(`Attempting to delete all disabled alerts from guild ${guildId} channel ${channelId}`);

    
    const disabledAlerts = await prisma.alert.findMany({
      where: {
        discordServerId: guildId,
        channelId: channelId,
        enabled: false,
        priceAlert: {
          isNot: null,
        },
      },
      include: {
        priceAlert: true,
      },
    });

    if (disabledAlerts.length === 0) {
      await interaction.reply({
        content: "No disabled alerts found in this channel.",
        flags: 64,
      });
      return;
    }

    logger.info(`Found ${disabledAlerts.length} disabled alerts to delete`);

    
    let deletedCount = 0;
    for (const alert of disabledAlerts) {
      try {
        
        if (alert.priceAlert) {
          await prisma.priceAlert.delete({
            where: {
              alertId: alert.id,
            },
          });
        }

        
        await prisma.alert.delete({
          where: {
            id: alert.id,
          },
        });

        deletedCount++;
      } catch (deleteError) {
        logger.error(`Error deleting disabled alert ${alert.id}:`, deleteError);
        
      }
    }

    logger.info(`Successfully deleted ${deletedCount} disabled alerts`);
    await interaction.reply({
      content: `Successfully deleted ${deletedCount} disabled alerts from this channel.`,
      flags: 64,
    });
  } catch (error) {
    logger.error("Error deleting disabled alerts:", {
      error,
      guildId,
      channelId,
    });

    let errorMessage = "Sorry, there was an error deleting the disabled alerts.";
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    await interaction.reply({
      content: errorMessage,
      flags: 64,
    });
  }
}

async function handleDeleteSpecificAlert(
  interaction: ChatInputCommandInteraction,
  alertId: string,
  guildId: string,
  channelId: string
): Promise<void> {
  try {
    logger.info(`Attempting to delete alert ${alertId} from guild ${guildId} channel ${channelId}`);

    // alert ownership check
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
      
      if (alert.priceAlert) {
        logger.info(`Deleting PriceAlert for alert ${alertId}`);
        await prisma.priceAlert.delete({
          where: {
            alertId: alertId
          }
        });
      }

      
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