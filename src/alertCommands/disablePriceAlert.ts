import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";

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

  
  if (!alertId && disableAll === null) {
    await interaction.reply({
      content: "Please provide either an alert ID or use the disable-all option.",
      flags: 64,
    });
    return;
  }

  // bulk
  if (disableAll === true) {
    await handleDisableAllEnabledAlerts(interaction, guildId, channelId);
    return;
  }

  // specific
  if (alertId) {
    await handleDisableSpecificAlert(interaction, alertId, guildId, channelId);
    return;
  }
}

async function handleDisableAllEnabledAlerts(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  channelId: string
): Promise<void> {
  try {
    logger.info(`Attempting to disable all enabled alerts from guild ${guildId} channel ${channelId}`);

    
    const enabledAlerts = await prisma.alert.findMany({
      where: {
        discordServerId: guildId,
        channelId: channelId,
        enabled: true,
        priceAlert: {
          isNot: null,
        },
      },
    });

    if (enabledAlerts.length === 0) {
      await interaction.reply({
        content: "No enabled alerts found in this channel.",
        flags: 64,
      });
      return;
    }

    logger.info(`Found ${enabledAlerts.length} enabled alerts to disable`);

    
    let disabledCount = 0;
    for (const alert of enabledAlerts) {
      try {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { enabled: false },
        });
        disabledCount++;
      } catch (updateError) {
        logger.error(`Error disabling alert ${alert.id}:`, updateError);
        
      }
    }

    logger.info(`Successfully disabled ${disabledCount} alerts`);
    await interaction.reply({
      content: `Successfully disabled ${disabledCount} alerts in this channel.`,
      flags: 64,
    });
  } catch (error) {
    logger.error("Error disabling all enabled alerts:", {
      error,
      guildId,
      channelId,
    });

    let errorMessage = "Sorry, there was an error disabling the alerts.";
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    await interaction.reply({
      content: errorMessage,
      flags: 64,
    });
  }
}

async function handleDisableSpecificAlert(
  interaction: ChatInputCommandInteraction,
  alertId: string,
  guildId: string,
  channelId: string
): Promise<void> {
  try {
    logger.info(`Attempting to disable alert ${alertId} from guild ${guildId} channel ${channelId}`);

    // alert ownership check
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

    if (!alert.enabled) {
      logger.info(`Alert ${alertId} is already disabled.`);
      await interaction.reply({
        content: `Alert with ID: \`${alertId}\` is already disabled.`,
        flags: 64,
      });
      return;
    }

    try {
      
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