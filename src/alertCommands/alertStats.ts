import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import logger from '../utils/logger';
import { STANDARD_TOKEN_IDS } from '../utils/constants';
import { getAlertStats, formatAlertStatsMessage } from '../lib/alertcommands';

export const alertStatsCommand = new SlashCommandBuilder()
  .setName('alert-stats')
  .setDescription(
    'View statistics about price alerts and their cooldown status.'
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option =>
    option
      .setName('token')
      .setDescription('Filter stats by token (DEV, BTC, ETH)')
      .setRequired(false)
      .addChoices(
        { name: 'DEV', value: STANDARD_TOKEN_IDS.DEV },
        { name: 'BTC', value: STANDARD_TOKEN_IDS.BTC },
        { name: 'ETH', value: STANDARD_TOKEN_IDS.ETH }
      )
  )
  .toJSON();

export async function handleAlertStats(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const tokenId = interaction.options.getString('token') || undefined;
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'This command can only be used in a server channel.',
      flags: 64,
    });
    return;
  }

  try {
    const result = await getAlertStats({
      tokenId,
      guildId,
      channelId,
    });

    if (!result.success || !result.stats) {
      await interaction.reply({
        content: result.message || 'Sorry, there was an error retrieving alert statistics.',
        flags: 64,
      });
      return;
    }

    // Create an embed with the statistics using the formatted message
    const formattedMessage = formatAlertStatsMessage(result.stats, tokenId);
    
    const embed = new EmbedBuilder()
      .setTitle(`🔔 Price Alert Statistics ${tokenId ? `(${tokenId})` : ''}`)
      .setColor(0x00ae86)
      .setDescription(formattedMessage)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: 64,
    });

    logger.info(`Successfully displayed alert stats for guild ${guildId}`);
  } catch (error) {
    logger.error('Error in handleAlertStats:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
