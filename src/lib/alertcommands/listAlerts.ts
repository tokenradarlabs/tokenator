import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { PriceAlertDirection, VolumeAlertDirection } from '../../generated/prisma/client';
import { formatPriceForDisplay } from '../../utils/priceFormatter';
import { formatNumber } from '../../utils/coinGecko';

export interface ListAlertsParams {
  guildId: string;
  channelId: string;
  direction?: PriceAlertDirection | VolumeAlertDirection;
  alertType?: string;
  tokenAddress?: string;
  enabledStatus?: string;
}

export interface AlertData {
  id: string;
  tokenAddress: string;
  direction: PriceAlertDirection | VolumeAlertDirection;
  value: number;
  enabled: boolean;
  createdAt: Date;
  type: 'price' | 'volume';
}

export interface ListAlertsResult {
  success: boolean;
  message?: string;
  alerts?: AlertData[];
}

export async function listAlerts(
  params: ListAlertsParams
): Promise<ListAlertsResult> {
  const { guildId, channelId, direction, alertType, tokenAddress, enabledStatus } = params;

  try {
    const baseWhereClause: any = {
      discordServerId: guildId,
      channelId: channelId,
    };

    if (tokenAddress) {
      baseWhereClause.token = { address: tokenAddress };
    }

    if (enabledStatus !== null && enabledStatus !== undefined) {
      baseWhereClause.enabled = enabledStatus === 'true';
    }

    let alerts: any[] = [];

    // Determine which alert types to fetch
    const shouldFetchPrice = !alertType || alertType === 'price' || alertType === 'all';
    const shouldFetchVolume = !alertType || alertType === 'volume' || alertType === 'all';

    // Fetch price alerts
    if (shouldFetchPrice) {
      const priceWhereClause = {
        ...baseWhereClause,
        priceAlert: {
          isNot: null,
          ...(direction ? { direction } : {}),
        },
      };

      const priceAlerts = await prisma.alert.findMany({
        where: priceWhereClause,
        include: {
          priceAlert: true,
          token: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      alerts.push(...priceAlerts);
    }

    // Fetch volume alerts
    if (shouldFetchVolume) {
      const volumeWhereClause = {
        ...baseWhereClause,
        volumeAlert: {
          isNot: null,
          ...(direction ? { direction } : {}),
        },
      };

      const volumeAlerts = await prisma.alert.findMany({
        where: volumeWhereClause,
        include: {
          volumeAlert: true,
          token: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      alerts.push(...volumeAlerts);
    }

    if (alerts.length === 0) {
      return {
        success: true,
        message: 'No alerts found for this channel with the specified filters.',
        alerts: [],
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
      .filter(alert => alert !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      success: true,
      alerts: alertData,
    };
  } catch (error) {
    logger.error('Error listing alerts:', error);
    return {
      success: false,
      message: 'Sorry, there was an error listing the alerts.',
    };
  }
}

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
