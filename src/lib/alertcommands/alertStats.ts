import logger from '../../utils/logger';
import { getAlertCooldownStats } from '../../utils/alertUtils';

export interface AlertStatsParams {
  tokenId?: string;
  guildId: string;
  channelId: string;
}

export interface AlertStatsData {
  totalAlerts: number;
  enabledAlerts: number;
  alertsInCooldown: number;
  alertsAvailable: number;
  cooldownPeriodMs: number;
}

export interface AlertStatsResult {
  success: boolean;
  message?: string;
  stats?: AlertStatsData;
}

/**
 * Retrieves statistics about alerts, including cooldown status.
 * @param params - Parameters for retrieving alert statistics.
 * @returns A result object containing alert statistics or an error message.
 */
export async function getAlertStats(
  params: AlertStatsParams
): Promise<AlertStatsResult> {
  const { tokenId, guildId, channelId } = params;

  try {
    logger.info(
      `Getting alert stats for guild ${guildId}, token: ${tokenId || 'all'}`
    );

    const stats = await getAlertCooldownStats(tokenId);

    const alertStatsData: AlertStatsData = {
      totalAlerts: stats.totalAlerts,
      enabledAlerts: stats.enabledAlerts,
      alertsInCooldown: stats.alertsInCooldown,
      alertsAvailable: stats.alertsAvailable,
      cooldownPeriodMs: stats.cooldownPeriodMs,
    };

    logger.info(`Successfully retrieved alert stats for guild ${guildId}`);

    return {
      success: true,
      stats: alertStatsData,
    };
  } catch (error) {
    logger.error('Error getting alert stats:', {
      error,
      tokenId,
      guildId,
      channelId,
    });

    return {
      success: false,
      message: 'Sorry, there was an error retrieving alert statistics.',
    };
  }
}

/**
 * Formats the alert statistics into a human-readable message.
 * @param stats - The alert statistics data.
 * @param tokenId - Optional token ID for which the stats are formatted.
 * @returns A formatted string displaying alert statistics.
 */
export function formatAlertStatsMessage(stats: AlertStatsData, tokenId?: string): string {
  let statusMessage = '✅ All systems normal';
  if (stats.alertsInCooldown > 0) {
    statusMessage = `⏳ ${stats.alertsInCooldown} alert(s) cooling down`;
  }
  if (stats.alertsAvailable === 0 && stats.enabledAlerts > 0) {
    statusMessage = '🛑 All enabled alerts are in cooldown';
  }

  return `

**📊 Overview**
**Total Alerts:** ${stats.totalAlerts}
**Enabled Alerts:** ${stats.enabledAlerts}
**Alerts in Cooldown:** ${stats.alertsInCooldown}
**Available Alerts:** ${stats.alertsAvailable}

**⏰ Cooldown Info**
**Cooldown Period:** ${Math.round(stats.cooldownPeriodMs / 1000)}s
**Purpose:** Prevents spam
**Resets:** When re-enabled

**🚦 Status**
${statusMessage}`;
}
