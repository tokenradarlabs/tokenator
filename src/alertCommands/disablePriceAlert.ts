import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";

export const disablePriceAlertCommand = new SlashCommandBuilder()
  .setName("disable-alert")
  .setDescription("Disables a price alert by its ID (sets enabled to false).")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to disable.")
      .setRequired(true)
  )
  .toJSON();

export async function handleDisablePriceAlert(
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
    logger.info(`Attempting to disable alert ${alertId} from guild ${guildId} channel ${channelId}`);

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
        content: "Alert not found or you do not have permission to disable it.",
        flags: 64,
      });
      return;
    }

    try {
      // Set enabled to false
      await prisma.alert.update({
        where: { id: alertId },
        data: { enabled: false },
      });

      logger.info(`Successfully disabled alert ${alertId}`);
      await interaction.reply({
        content: `Successfully disabled alert with ID: \`${alertId}\``,
        flags: 64,
      });
    } catch (updateError) {
      logger.error('Error during disable operation:', updateError);
      throw updateError;
    }
  } catch (error) {
    logger.error("Error disabling price alert:", {
      error,
      alertId,
      guildId,
      channelId
    });
    let errorMessage = "Sorry, there was an error disabling the price alert.";
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }
    await interaction.reply({
      content: errorMessage,
      flags: 64,
    });
  }
} 