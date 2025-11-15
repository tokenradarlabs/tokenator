import { PrismaClient, AlertType, PriceAlertDirection, VolumeAlertDirection } from '@prisma/client';
import { validate as uuidValidate } from 'uuid';

interface ExportedPriceAlert {
  type: AlertType.Price;
  id: string;
  coinId: string;
  currency: string;
  targetPrice: string;
  direction: PriceAlertDirection;
  triggerPrice?: string;
  lastTriggered?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExportedVolumeAlert {
  type: AlertType.Volume;
  id: string;
  coinId: string;
  currency: string;
  targetVolume: string;
  direction: VolumeAlertDirection;
  triggerVolume?: string;
  lastTriggered?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ImportedAlerts {
  priceAlerts: ExportedPriceAlert[];
  volumeAlerts: ExportedVolumeAlert[];
}

export async function importAlerts(
  prisma: PrismaClient,
  userId: string,
  channelId: string,
  alertsJson: string,
  resolveConflicts: 'skip' | 'overwrite' | 'rename' = 'skip'
) {
  const importedData: ImportedAlerts = JSON.parse(alertsJson);
  const results = {
    priceAlerts: { created: 0, updated: 0, skipped: 0, errors: 0 },
    volumeAlerts: { created: 0, updated: 0, skipped: 0, errors: 0 },
  };

  for (const alert of importedData.priceAlerts) {
    try {
      // Basic validation
      if (!alert.coinId || !alert.currency || !alert.targetPrice || !alert.direction) {
        console.warn(`Skipping invalid price alert: Missing required fields. ID: ${alert.id}`);
        results.priceAlerts.errors++;
        continue;
      }

      const existingAlert = await prisma.priceAlert.findFirst({
        where: {
          userId,
          channelId,
          coinId: alert.coinId,
          currency: alert.currency,
          targetPrice: parseFloat(alert.targetPrice),
          direction: alert.direction,
        },
      });

      if (existingAlert) {
        if (resolveConflicts === 'overwrite') {
          await prisma.priceAlert.update({
            where: { id: existingAlert.id },
            data: {
              targetPrice: parseFloat(alert.targetPrice),
              direction: alert.direction,
              triggerPrice: alert.triggerPrice ? parseFloat(alert.triggerPrice) : null,
              lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : null,
              isEnabled: alert.isEnabled,
              updatedAt: new Date(),
            },
          });
          results.priceAlerts.updated++;
        } else if (resolveConflicts === 'rename') {
          // For simplicity, 'rename' will create a new alert with a new ID
          // In a real scenario, you might append a suffix to the coinId or add a note.
          await prisma.priceAlert.create({
            data: {
              userId,
              channelId,
              coinId: alert.coinId, // Consider renaming or adding a suffix
              currency: alert.currency,
              targetPrice: parseFloat(alert.targetPrice),
              direction: alert.direction,
              triggerPrice: alert.triggerPrice ? parseFloat(alert.triggerPrice) : null,
              lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : null,
              isEnabled: alert.isEnabled,
            },
          });
          results.priceAlerts.created++;
        } else {
          results.priceAlerts.skipped++;
        }
      } else {
        await prisma.priceAlert.create({
          data: {
            userId,
            channelId,
            coinId: alert.coinId,
            currency: alert.currency,
            targetPrice: parseFloat(alert.targetPrice),
            direction: alert.direction,
            triggerPrice: alert.triggerPrice ? parseFloat(alert.triggerPrice) : null,
            lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : null,
            isEnabled: alert.isEnabled,
          },
        });
        results.priceAlerts.created++;
      }
    } catch (error) {
      console.error(`Error importing price alert ${alert.id}: ${error.message}`);
      results.priceAlerts.errors++;
    }
  }

  for (const alert of importedData.volumeAlerts) {
    try {
      // Basic validation
      if (!alert.coinId || !alert.currency || !alert.targetVolume || !alert.direction) {
        console.warn(`Skipping invalid volume alert: Missing required fields. ID: ${alert.id}`);
        results.volumeAlerts.errors++;
        continue;
      }

      const existingAlert = await prisma.volumeAlert.findFirst({
        where: {
          userId,
          channelId,
          coinId: alert.coinId,
          currency: alert.currency,
          targetVolume: parseFloat(alert.targetVolume),
          direction: alert.direction,
        },
      });

      if (existingAlert) {
        if (resolveConflicts === 'overwrite') {
          await prisma.volumeAlert.update({
            where: { id: existingAlert.id },
            data: {
              targetVolume: parseFloat(alert.targetVolume),
              direction: alert.direction,
              triggerVolume: alert.triggerVolume ? parseFloat(alert.triggerVolume) : null,
              lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : null,
              isEnabled: alert.isEnabled,
              updatedAt: new Date(),
            },
          });
          results.volumeAlerts.updated++;
        } else if (resolveConflicts === 'rename') {
          await prisma.volumeAlert.create({
            data: {
              userId,
              channelId,
              coinId: alert.coinId, // Consider renaming or adding a suffix
              currency: alert.currency,
              targetVolume: parseFloat(alert.targetVolume),
              direction: alert.direction,
              triggerVolume: alert.triggerVolume ? parseFloat(alert.triggerVolume) : null,
              lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : null,
              isEnabled: alert.isEnabled,
            },
          });
          results.volumeAlerts.created++;
        } else {
          results.volumeAlerts.skipped++;
        }
      } else {
        await prisma.volumeAlert.create({
          data: {
            userId,
            channelId,
            coinId: alert.coinId,
            currency: alert.currency,
            targetVolume: parseFloat(alert.targetVolume),
            direction: alert.direction,
            triggerVolume: alert.triggerVolume ? parseFloat(alert.triggerVolume) : null,
            lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : null,
            isEnabled: alert.isEnabled,
          },
        });
        results.volumeAlerts.created++;
      }
    } catch (error) {
      console.error(`Error importing volume alert ${alert.id}: ${error.message}`);
      results.volumeAlerts.errors++;
    }
  }

  return results;
}
