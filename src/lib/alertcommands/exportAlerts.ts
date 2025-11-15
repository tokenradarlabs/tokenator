import { PrismaClient, AlertDirection, VolumeAlertTimeframe } from '@prisma/client';

export async function exportAlerts(
  prisma: PrismaClient,
  userId: string,
  channelId: string
) {
  const priceAlerts = await prisma.priceAlert.findMany({
    where: { alert: { userId, channelId } },
    include: { alert: true },
  });

  const volumeAlerts = await prisma.volumeAlert.findMany({
    where: { alert: { userId, channelId } },
    include: { alert: true },
  });

  const exportedPriceAlerts = priceAlerts.map(alert => ({
    type: 'Price' as const,
    id: alert.alert.id,
    coinId: alert.alert.tokenId,
    currency: 'usd', // Assuming USD as default currency for now
    targetPrice: alert.value.toString(),
    direction: alert.direction,
    triggerPrice: alert.alert.lastTriggered ? alert.value.toString() : undefined, // Simplified triggerPrice
    lastTriggered: alert.alert.lastTriggered?.toISOString(),
    isEnabled: alert.alert.enabled,
    createdAt: alert.alert.createdAt.toISOString(),
    updatedAt: alert.alert.updatedAt.toISOString(),
  }));

  const exportedVolumeAlerts = volumeAlerts.map(alert => ({
    type: 'Volume' as const,
    id: alert.alert.id,
    coinId: alert.alert.tokenId,
    currency: 'usd', // Assuming USD as default currency for now
    targetVolume: alert.value.toString(),
    direction: alert.direction,
    timeframe: alert.timeframe,
    triggerVolume: alert.alert.lastTriggered ? alert.value.toString() : undefined, // Simplified triggerVolume
    lastTriggered: alert.alert.lastTriggered?.toISOString(),
    isEnabled: alert.alert.enabled,
    createdAt: alert.alert.createdAt.toISOString(),
    updatedAt: alert.alert.updatedAt.toISOString(),
  }));

  return JSON.stringify({
    priceAlerts: exportedPriceAlerts,
    volumeAlerts: exportedVolumeAlerts,
  }, null, 2);
}
