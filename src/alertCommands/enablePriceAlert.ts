import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";

export const enablePriceAlertCommand = new SlashCommandBuilder()
  .setName("enable-alert")
  .setDescription("Enables a price alert by its ID (sets enabled to true).")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to enable.")
      .setRequired(true)
  )
  .toJSON();

export async function handleEnablePriceAlert(
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
    logger.info(`Attempting to enable alert ${alertId} from guild ${guildId} channel ${channelId}`);

    // Check if the alert exists and belongs to this server/channel
    const alert = await prisma.alert.findUnique({
      where: {
        id: alertId,
        discordServerId: guildId,
        channelId: channelId,
      },
    }).catch(err => {
      logger.error('Error finding alert:', err);
      throw err;
    });

    if (!alert) {
      logger.info(`Alert ${alertId} not found or not accessible`);
      await interaction.reply({
        content: "Alert not found or you do not have permission to enable it.",
        flags: 64,
      });
      return;
    }

    if (alert.enabled) {
      logger.info(`Alert ${alertId} is already enabled.`);
      await interaction.reply({
        content: `Alert with ID: \`${alertId}\` is already enabled.`,
        flags: 64,
      });
      return;
    }

    try {
      // Set enabled to true
      await prisma.alert.update({
        where: { id: alertId },
        data: { enabled: true },
      });

      logger.info(`Successfully enabled alert ${alertId}`);
      await interaction.reply({
        content: `Successfully enabled alert with ID: \`${alertId}\``,
        flags: 64,
      });
    } catch (updateError) {
      logger.error('Error during enable operation:', updateError);
      throw updateError;
    }
  } catch (error) {
    logger.error("Error enabling price alert:", {
      error,
      alertId,
      guildId,
      channelId
    });
    let errorMessage = "Sorry, there was an error enabling the price alert.";
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }
    await interaction.reply({
      content: errorMessage,
      flags: 64,
    });
  }
} 