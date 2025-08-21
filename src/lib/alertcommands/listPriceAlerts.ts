import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { PriceAlertDirection } from '../../generated/prisma/client';
import { formatPriceForDisplay } from '../../utils/priceFormatter';

export interface ListPriceAlertsParams {
  guildId: string;
  channelId: string;
  direction?: PriceAlertDirection;
  tokenAddress?: string;
  enabledStatus?: string;
}

export interface AlertData {
  id: string;
  tokenAddress: string;
  direction: PriceAlertDirection;
  value: number;
  enabled: boolean;
  createdAt: Date;
}

export interface ListPriceAlertsResult {
  success: boolean;
  message?: string;
  alerts?: AlertData[];
}

export async function listPriceAlerts(
  params: ListPriceAlertsParams
): Promise<ListPriceAlertsResult> {
  const { guildId, channelId, direction, tokenAddress, enabledStatus } = params;

  try {
    const whereClause: any = {
      discordServerId: guildId,
      channelId: channelId,
      priceAlert: {
        isNot: null,
      },
    };

    if (direction) {
      whereClause.priceAlert = { direction: direction };
    }

    if (tokenAddress) {
      whereClause.token = { address: tokenAddress };
    }

    if (enabledStatus !== null && enabledStatus !== undefined) {
      whereClause.enabled = enabledStatus === 'true';
    }

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        priceAlert: true,
        token: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (alerts.length === 0) {
      return {
        success: true,
        message: 'No price alerts found for this channel with the specified filters.',
        alerts: [],
      };
    }

    const alertData: AlertData[] = alerts
      .filter(alert => alert.priceAlert)
      .map(alert => ({
        id: alert.id,
        tokenAddress: alert.token.address,
        direction: alert.priceAlert!.direction,
        value: alert.priceAlert!.value,
        enabled: alert.enabled,
        createdAt: alert.createdAt,
      }));

    return {
      success: true,
      alerts: alertData,
    };
  } catch (error) {
    logger.error('Error listing price alerts:', error);
    return {
      success: false,
      message: 'Sorry, there was an error listing the price alerts.',
    };
  }
}

export function formatAlertsForDisplay(alerts: AlertData[]): string {
  let description = '';
  alerts.forEach(alert => {
    const directionEmoji = alert.direction === 'up' ? '📈' : '📉';
    const enabledEmoji = alert.enabled ? '✅' : '❌';
    const enabledText = alert.enabled ? 'Enabled' : 'Disabled';

    description += `**ID:** \`${alert.id}\`\n`;
    description += `**Token:** \`${alert.tokenAddress}\`\n`;
    description += `**Type:** Price\n`;
    description += `**Direction:** ${alert.direction} ${directionEmoji}\n`;
    description += `**Value:** ${formatPriceForDisplay(alert.value)}\n`;
    description += `**Status:** ${enabledText} ${enabledEmoji}\n`;
    description += `**Created At:** <t:${Math.floor(alert.createdAt.getTime() / 1000)}:R>\n\n`;
  });

  return description;
}
