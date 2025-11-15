import { PrismaClient, AlertDirection, VolumeAlertTimeframe } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface ImportedAlertBase {
  id: string; // Original ID from export, used for conflict resolution
  coinId: string;
  currency: string;
  lastTriggered?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExportedPriceAlert extends ImportedAlertBase {
  type: 'Price';
  targetPrice: string;
  direction: AlertDirection;
}

interface ExportedVolumeAlert extends ImportedAlertBase {
  type: 'Volume';
  targetVolume: string;
  direction: AlertDirection;
  timeframe: VolumeAlertTimeframe;
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

  for (const importedPriceAlert of importedData.priceAlerts) {
    try {
      // Basic validation
      if (!importedPriceAlert.coinId || !importedPriceAlert.currency || !importedPriceAlert.targetPrice || !importedPriceAlert.direction) {
        console.warn(`Skipping invalid price alert: Missing required fields. ID: ${importedPriceAlert.id}`);
        results.priceAlerts.errors++;
        continue;
      }

      let existingAlert = await prisma.alert.findFirst({
        where: {
          userId,
          channelId,
          tokenId: importedPriceAlert.coinId,
          priceAlert: {
            direction: importedPriceAlert.direction,
            value: parseFloat(importedPriceAlert.targetPrice),
          },
        },
        include: { priceAlert: true },
      });

      if (existingAlert) {
        if (resolveConflicts === 'overwrite') {
          await prisma.alert.update({
            where: { id: existingAlert.id },
            data: {
              enabled: importedPriceAlert.isEnabled,
              lastTriggered: importedPriceAlert.lastTriggered ? new Date(importedPriceAlert.lastTriggered) : null,
              updatedAt: new Date(),
              priceAlert: {
                update: {
                  value: parseFloat(importedPriceAlert.targetPrice),
                  direction: importedPriceAlert.direction,
                },
              },
            },
          });
          results.priceAlerts.updated++;
        } else if (resolveConflicts === 'rename') {
          // Create a new alert with a new ID
          const newAlert = await prisma.alert.create({
            data: {
              userId,
              channelId,
              tokenId: importedPriceAlert.coinId,
              enabled: importedPriceAlert.isEnabled,
              lastTriggered: importedPriceAlert.lastTriggered ? new Date(importedPriceAlert.lastTriggered) : null,
              createdAt: new Date(importedPriceAlert.createdAt),
              updatedAt: new Date(),
              priceAlert: {
                create: {
                  value: parseFloat(importedPriceAlert.targetPrice),
                  direction: importedPriceAlert.direction,
                },
              },
            },
          });
          results.priceAlerts.created++;
        } else {
          results.priceAlerts.skipped++;
        }
      } else {
        // Create new alert and price alert
        await prisma.alert.create({
          data: {
            userId,
            channelId,
            tokenId: importedPriceAlert.coinId,
            enabled: importedPriceAlert.isEnabled,
            lastTriggered: importedPriceAlert.lastTriggered ? new Date(importedPriceAlert.lastTriggered) : null,
            createdAt: new Date(importedPriceAlert.createdAt),
            updatedAt: new Date(),
            priceAlert: {
              create: {
                value: parseFloat(importedPriceAlert.targetPrice),
                direction: importedPriceAlert.direction,
              },
            },
          },
        });
        results.priceAlerts.created++;
      }
    } catch (error) {
      console.error(`Error importing price alert ${importedPriceAlert.id}: ${error.message}`);
      results.priceAlerts.errors++;
    }
  }

  for (const importedVolumeAlert of importedData.volumeAlerts) {
    try {
      // Basic validation
      if (!importedVolumeAlert.coinId || !importedVolumeAlert.currency || !importedVolumeAlert.targetVolume || !importedVolumeAlert.direction || !importedVolumeAlert.timeframe) {
        console.warn(`Skipping invalid volume alert: Missing required fields. ID: ${importedVolumeAlert.id}`);
        results.volumeAlerts.errors++;
        continue;
      }

      let existingAlert = await prisma.alert.findFirst({
        where: {
          userId,
          channelId,
          tokenId: importedVolumeAlert.coinId,
          volumeAlert: {
            direction: importedVolumeAlert.direction,
            value: parseFloat(importedVolumeAlert.targetVolume),
            timeframe: importedVolumeAlert.timeframe,
          },
        },
        include: { volumeAlert: true },
      });

      if (existingAlert) {
        if (resolveConflicts === 'overwrite') {
          await prisma.alert.update({
            where: { id: existingAlert.id },
            data: {
              enabled: importedVolumeAlert.isEnabled,
              lastTriggered: importedVolumeAlert.lastTriggered ? new Date(importedVolumeAlert.lastTriggered) : null,
              updatedAt: new Date(),
              volumeAlert: {
                update: {
                  value: parseFloat(importedVolumeAlert.targetVolume),
                  direction: importedVolumeAlert.direction,
                  timeframe: importedVolumeAlert.timeframe,
                },
              },
            },
          });
          results.volumeAlerts.updated++;
        } else if (resolveConflicts === 'rename') {
          // Create a new alert with a new ID
          const newAlert = await prisma.alert.create({
            data: {
              userId,
              channelId,
              tokenId: importedVolumeAlert.coinId,
              enabled: importedVolumeAlert.isEnabled,
              lastTriggered: importedVolumeAlert.lastTriggered ? new Date(importedVolumeAlert.lastTriggered) : null,
              createdAt: new Date(importedVolumeAlert.createdAt),
              updatedAt: new Date(),
              volumeAlert: {
                create: {
                  value: parseFloat(importedVolumeAlert.targetVolume),
                  direction: importedVolumeAlert.direction,
                  timeframe: importedVolumeAlert.timeframe,
                },
              },
            },
          });
          results.volumeAlerts.created++;
        } else {
          results.volumeAlerts.skipped++;
        }
      } else {
        // Create new alert and volume alert
        await prisma.alert.create({
          data: {
            userId,
            channelId,
            tokenId: importedVolumeAlert.coinId,
            enabled: importedVolumeAlert.isEnabled,
            lastTriggered: importedVolumeAlert.lastTriggered ? new Date(importedVolumeAlert.lastTriggered) : null,
            createdAt: new Date(importedVolumeAlert.createdAt),
            updatedAt: new Date(),
            volumeAlert: {
              create: {
                value: parseFloat(importedVolumeAlert.targetVolume),
                direction: importedVolumeAlert.direction,
                timeframe: importedVolumeAlert.timeframe,
              },
            },
          },
        });
        results.volumeAlerts.created++;
      }
    } catch (error) {
      console.error(`Error importing volume alert ${importedVolumeAlert.id}: ${error.message}`);
      results.volumeAlerts.errors++;
    }
  }

  return results;
}
