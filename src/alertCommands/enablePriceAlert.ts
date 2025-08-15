import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import logger from '../utils/logger';
import prisma from '../utils/prisma';

export const enablePriceAlertCommand = new SlashCommandBuilder()
  .setName('enable-alert')
  .setDescription('Enables a price alert by its ID or all disabled alerts.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('The ID of the alert to enable.')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('enable-all')
      .setDescription('Enable all disabled alerts in this channel.')
      .setRequired(false)
  )
  .toJSON();

export async function handleEnablePriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString('id');
  const enableAll = interaction.options.getBoolean('enable-all');
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'This command can only be used in a server channel.',
      flags: 64,
    });
    return;
  }

  
  if (!alertId && enableAll === null) {
    await interaction.reply({
      content: 'Please provide either an alert ID or use the enable-all option.',
      flags: 64,
    });
    return;
  }

  // bulk
  if (enableAll === true) {
    await handleEnableAllDisabledAlerts(interaction, guildId, channelId);
    return;
  }

  // specific
  if (alertId) {
    await handleEnableSpecificAlert(interaction, alertId, guildId, channelId);
    return;
  }
}

async function handleEnableAllDisabledAlerts(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  channelId: string
): Promise<void> {
  try {
    logger.info(`Attempting to enable all disabled alerts from guild ${guildId} channel ${channelId}`);

    
    const disabledAlerts = await prisma.alert.findMany({
      where: {
        discordServerId: guildId,
        channelId: channelId,
        enabled: false,
        priceAlert: {
          isNot: null,
        },
      },
    });

    if (disabledAlerts.length === 0) {
      await interaction.reply({
        content: 'No disabled alerts found in this channel.',
        flags: 64,
      });
      return;
    }

    logger.info(`Found ${disabledAlerts.length} disabled alerts to enable`);

    
    let enabledCount = 0;
    for (const alert of disabledAlerts) {
      try {
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            enabled: true,
            lastTriggered: null,
          },
        });
        enabledCount++;
      } catch (updateError) {
        logger.error(`Error enabling alert ${alert.id}:`, updateError);
        
      }
    }

    logger.info(`Successfully enabled ${enabledCount} alerts`);
    await interaction.reply({
      content: `Successfully enabled ${enabledCount} alerts in this channel.`,
      flags: 64,
    });
  } catch (error) {
    logger.error('Error enabling all disabled alerts:', {
      error,
      guildId,
      channelId,
    });

    let errorMessage = 'Sorry, there was an error enabling the alerts.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    await interaction.reply({
      content: errorMessage,
      flags: 64,
    });
  }
}

async function handleEnableSpecificAlert(
  interaction: ChatInputCommandInteraction,
  alertId: string,
  guildId: string,
  channelId: string
): Promise<void> {
  try {
    logger.info(
      `Attempting to enable alert ${alertId} from guild ${guildId} channel ${channelId}`
    );

    // alert ownership check
    const alert = await prisma.alert
      .findUnique({
        where: {
          id: alertId,
          discordServerId: guildId,
          channelId: channelId,
        },
      })
      .catch(err => {
        logger.error('Error finding alert:', err);
        throw err;
      });

    if (!alert) {
      logger.info(`Alert ${alertId} not found or not accessible`);
      await interaction.reply({
        content: 'Alert not found or you do not have permission to enable it.',
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
      
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          enabled: true,
          lastTriggered: null,
        },
      });

      logger.info(`Successfully enabled alert ${alertId} and reset cooldown`);
      await interaction.reply({
        content: `Successfully enabled alert with ID: \`${alertId}\``,
        flags: 64,
      });
    } catch (updateError) {
      logger.error('Error during enable operation:', updateError);
      throw updateError;
    }
  } catch (error) {
    logger.error('Error enabling price alert:', {
      error,
      alertId,
      guildId,
      channelId,
    });
    let errorMessage = 'Sorry, there was an error enabling the price alert.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }
    await interaction.reply({
      content: errorMessage,
      flags: 64,
    });
  }
}
