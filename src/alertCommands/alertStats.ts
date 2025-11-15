import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import logger from '../utils/logger';
import { STANDARD_TOKEN_IDS } from '../utils/constants';
import { getAlertStats, formatAlertStatsMessage } from '../lib/alertcommands';
import { getAlertCooldownStats } from '../utils/alertUtils';

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

  // Ensure the command is used within a server channel.
  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'This command can only be used in a server channel.',
      flags: 64,
    });
    return;
  }

  try {
    // Attempt to retrieve alert statistics from the database.
    const result = await getAlertStats({
      tokenId,
      guildId,
      channelId,
    });

    // Handle cases where alert statistics could not be retrieved successfully.
    if (!result.success) {
      // Log the error for debugging purposes.
      logger.error(`Failed to retrieve alert stats: ${result.message}`);
      await interaction.reply({
        content: result.message || 'Sorry, there was an error retrieving alert statistics. Please try again later.',
        flags: 64,
      });
      return;
    }

    // Handle the specific case where no alerts are found.
    if (!result.stats || result.stats?.totalAlerts === 0) {
      await interaction.reply({
        content: 'No alerts found for the specified criteria. Create one using `/create-price-alert` or `/create-volume-alert`.',
        flags: 64,
      });
      return;
    }

    // Format the retrieved statistics into a human-readable message.
    const formattedMessage = formatAlertStatsMessage(result.stats, tokenId);

    // Get cooldown statistics
    const cooldownStats = await getAlertCooldownStats(tokenId, guildId, channelId);

    // Construct and send the embed message with alert statistics.
    const embed = new EmbedBuilder()
      .setTitle(`🔔 Price Alert Statistics ${tokenId ? `(${tokenId})` : ''}`)
      .setColor(0x00ae86)
      .setDescription(formattedMessage)
      .addFields(
        {
          name: 'Total Alerts',
          value: `${cooldownStats.totalAlerts}`,
          inline: true,
        },
        {
          name: 'Enabled Alerts',
          value: `${cooldownStats.enabledAlerts}`,
          inline: true,
        },
        {
          name: 'Alerts in Cooldown',
          value: `${cooldownStats.alertsInCooldown}`,
          inline: true,
        },
        {
          name: 'Alerts Available',
          value: `${cooldownStats.alertsAvailable}`,
          inline: true,
        },
        {
          name: 'Cooldown Period',
          value: `${cooldownStats.cooldownPeriodMs / 1000} seconds`,
          inline: true,
        },
        {
          name: 'Cooldown Status',
          value: generateCooldownChart(cooldownStats.alertsInCooldown, cooldownStats.alertsAvailable),
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: 64,
    });

    // Log successful display of alert statistics.
    logger.info(`Successfully displayed alert stats for guild ${guildId}`);
  } catch (error) {
    // Catch any unexpected errors during the process.
    logger.error({ err: error }, 'Unexpected error in handleAlertStats:');
    await interaction.reply({
      content: 'An unexpected error occurred while fetching alert statistics. Please try again later.',
      flags: 64,
    });
  }
}

/**
 * Generates a simple text-based bar chart for alert cooldown status.
 * @param inCooldown Number of alerts in cooldown
 * @param availableAlerts Number of alerts available
 * @returns A string representing the bar chart
 */
function generateCooldownChart(inCooldown: number, availableAlerts: number): string {
  const total = inCooldown + availableAlerts;
  if (total === 0) {
    return 'No alerts to display cooldown status.';
  }

  const inCooldownRatio = inCooldown / total;
  const availableRatio = availableAlerts / total;

  const barLength = 20; // Length of the bar chart
  const inCooldownBars = Math.round(inCooldownRatio * barLength);
  const availableBars = barLength - inCooldownBars;

  const inCooldownChart = '🟥'.repeat(inCooldownBars);
  const availableChart = '🟩'.repeat(availableBars);

  return `\`\`\`
In Cooldown: ${inCooldownChart} ${inCooldown} (${(inCooldownRatio * 100).toFixed(1)}%)
Available:   ${availableChart} ${availableAlerts} (${(availableRatio * 100).toFixed(1)}%)
\`\`\``;
}
