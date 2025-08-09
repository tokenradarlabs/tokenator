import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import logger from '../utils/logger';
import { getAlertCooldownStats } from '../utils/alertUtils';
import { STANDARD_TOKEN_IDS } from '../utils/constants';

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
    logger.info(
      `Getting alert stats for guild ${guildId}, token: ${tokenId || 'all'}`
    );

    const stats = await getAlertCooldownStats(tokenId);

    // Create an embed with the statistics
    const embed = new EmbedBuilder()
      .setTitle(`🔔 Price Alert Statistics ${tokenId ? `(${tokenId})` : ''}`)
      .setColor(0x00ae86)
      .setTimestamp();

    // Add fields to the embed
    embed.addFields(
      {
        name: '📊 Overview',
        value: [
          `**Total Alerts:** ${stats.totalAlerts}`,
          `**Enabled Alerts:** ${stats.enabledAlerts}`,
          `**Alerts in Cooldown:** ${stats.alertsInCooldown}`,
          `**Available Alerts:** ${stats.alertsAvailable}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '⏰ Cooldown Info',
        value: [
          `**Cooldown Period:** ${Math.round(stats.cooldownPeriodMs / 1000)}s`,
          `**Purpose:** Prevents spam`,
          `**Resets:** When re-enabled`,
        ].join('\n'),
        inline: true,
      }
    );

    // Add status message
    let statusMessage = '✅ All systems normal';
    if (stats.alertsInCooldown > 0) {
      statusMessage = `⏳ ${stats.alertsInCooldown} alert(s) cooling down`;
    }
    if (stats.alertsAvailable === 0 && stats.enabledAlerts > 0) {
      statusMessage = '🛑 All enabled alerts are in cooldown';
    }

    embed.addFields({
      name: '🚦 Status',
      value: statusMessage,
      inline: false,
    });

    await interaction.reply({
      embeds: [embed],
      flags: 64,
    });

    logger.info(`Successfully displayed alert stats for guild ${guildId}`);
  } catch (error) {
    logger.error('Error getting alert stats:', {
      error,
      tokenId,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: 'Sorry, there was an error retrieving alert statistics.',
      flags: 64,
    });
  }
}
