import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { AlertDirection } from '../../generated/prisma/client';
import { formatPriceForDisplay } from '../../utils/priceFormatter';
import { formatNumber } from '../../utils/coinGecko';

export interface ListAlertsParams {
  guildId: string;
  channelId: string;
  direction?: AlertDirection;
  alertType?: string;
  tokenAddress?: string;
  enabledStatus?: string;
  page?: number;
  limit?: number;
}

export interface AlertData {
  id: string;
  tokenAddress: string;
  direction: AlertDirection;
  value: number;
  enabled: boolean;
  createdAt: Date;
  type: 'price' | 'volume';
}

export interface ListAlertsResult {
  success: boolean;
  message?: string;
  alerts?: AlertData[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Lists alerts based on provided filters.
 * @param params - Parameters for listing alerts.
 * @returns A result object containing a list of alerts or an error message.
 */
export async function listAlerts(
  params: ListAlertsParams
): Promise<ListAlertsResult> {
  const { guildId, channelId, direction, alertType, tokenAddress, enabledStatus, page: pageParam, limit: limitParam } = params;

  const page = typeof pageParam === 'number' ? Math.max(1, pageParam) : 1;
  const effectiveLimit = typeof limitParam === 'number' ? Math.min(Math.max(1, limitParam), 50) : 10;
  const skip = (page - 1) * effectiveLimit;

  try {
    let whereClause: any = {
      discordServerId: guildId,
      channelId: channelId,
    };

    if (tokenAddress) {
      whereClause.token = { address: tokenAddress };
    }

    if (enabledStatus !== null && enabledStatus !== undefined) {
      whereClause.enabled = enabledStatus === 'true';
    }

    if (alertType === 'price') {
      whereClause.priceAlert = direction ? { direction } : { isNot: null };
    } else if (alertType === 'volume') {
      whereClause.volumeAlert = direction ? { direction } : { isNot: null };
    } else { // all or undefined
      whereClause.OR = direction
        ? [{ priceAlert: { direction } }, { volumeAlert: { direction } }]
        : [{ priceAlert: { isNot: null } }, { volumeAlert: { isNot: null } }];
    }

    const [alerts, totalAlerts] = await Promise.all([
      prisma.alert.findMany({
        where: whereClause,
        include: { priceAlert: true, volumeAlert: true, token: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: effectiveLimit,
      }),
      prisma.alert.count({ where: whereClause }),
    ]);

    if (alerts.length === 0) {
      return {
        success: true,
        message: 'No alerts found for this channel with the specified filters.',
        alerts: [],
        page,
        limit: effectiveLimit,
        total: totalAlerts,
      };
    }

    const alertData: AlertData[] = alerts
      .map(alert => {
        if (alert.priceAlert) {
          return {
            id: alert.id,
            tokenAddress: alert.token.address,
            direction: alert.priceAlert.direction,
            value: alert.priceAlert.value,
            enabled: alert.enabled,
            createdAt: alert.createdAt,
            type: 'price' as const,
          };
        } else if (alert.volumeAlert) {
          return {
            id: alert.id,
            tokenAddress: alert.token.address,
            direction: alert.volumeAlert.direction,
            value: alert.volumeAlert.value,
            enabled: alert.enabled,
            createdAt: alert.createdAt,
            type: 'volume' as const,
          };
        }
        return null;
      })
      .filter(alert => alert !== null);

    return {
      success: true,
      alerts: alertData,
      page,
      limit: effectiveLimit,
      total: totalAlerts,
    };
  } catch (error) {
    logger.error('Error listing alerts:', error);
    return {
      success: false,
      message: 'Sorry, there was an error listing the alerts.',
      page,
      limit: effectiveLimit,
      total: 0,
    };
  }
}

/**
 * Formats a list of alerts into a human-readable string for display.
 * @param alerts - An array of alert data.
 * @returns A formatted string displaying the alerts.
 */
export function formatAlertsForDisplay(alerts: AlertData[]): string {
  let description = '';
  alerts.forEach(alert => {
    const directionEmoji = alert.direction === 'up' ? '📈' : '📉';
    const enabledEmoji = alert.enabled ? '✅' : '❌';
    const enabledText = alert.enabled ? 'Enabled' : 'Disabled';
    const typeEmoji = alert.type === 'price' ? '💰' : '📊';
    const typeText = alert.type === 'price' ? 'Price' : 'Volume';

    description += `**ID:** \`${alert.id}\`\n`;
    description += `**Token:** \`${alert.tokenAddress.toUpperCase()}\`\n`;
    description += `**Type:** ${typeText} ${typeEmoji}\n`;
    description += `**Direction:** ${alert.direction.toUpperCase()} ${directionEmoji}\n`;
    
    if (alert.type === 'price') {
      description += `**Value:** ${formatPriceForDisplay(alert.value)}\n`;
    } else {
      description += `**Value:** ${formatNumber(alert.value)}\n`;
    }
    
    description += `**Status:** ${enabledText} ${enabledEmoji}\n`;
    description += `**Created At:** <t:${Math.floor(alert.createdAt.getTime() / 1000)}:R>\n\n`;
  });

  return description;
}
