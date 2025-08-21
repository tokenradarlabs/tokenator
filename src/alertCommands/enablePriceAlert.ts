import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import logger from '../utils/logger';
import { enablePriceAlert } from '../lib/alertcommands';

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

  try {
    const result = await enablePriceAlert({
      alertId: alertId || undefined,
      enableAll: enableAll || undefined,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error('Error in handleEnablePriceAlert:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
