import prisma from './prisma';
import logger from './logger';

// Cooldown period to prevent rapid re-triggering (60 seconds)
export const ALERT_COOLDOWN_PERIOD_MS = 60 * 1000;

/**
 * Checks if an alert is currently in cooldown period
 * @param alertId The alert ID to check
 * @returns true if the alert is in cooldown, false otherwise
 */
export async function isAlertInCooldown(alertId: string): Promise<boolean> {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      select: { lastTriggered: true },
    });

    if (!alert || !alert.lastTriggered) {
      return false; // No previous trigger, not in cooldown
    }

    const now = new Date();
    const cooldownThreshold = new Date(
      now.getTime() - ALERT_COOLDOWN_PERIOD_MS
    );

    return alert.lastTriggered > cooldownThreshold;
  } catch (error) {
    logger.error('Error checking alert cooldown:', error);
    return false; // Assume not in cooldown on error
  }
}

/**
 * Gets the remaining cooldown time for an alert in milliseconds
 * @param alertId The alert ID to check
 * @returns remaining cooldown time in milliseconds, 0 if not in cooldown
 */
export async function getAlertCooldownRemaining(
  alertId: string
): Promise<number> {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      select: { lastTriggered: true },
    });

    if (!alert || !alert.lastTriggered) {
      return 0; // No previous trigger, no cooldown
    }

    const now = new Date();
    const cooldownEnd = new Date(
      alert.lastTriggered.getTime() + ALERT_COOLDOWN_PERIOD_MS
    );

    if (now >= cooldownEnd) {
      return 0; // Cooldown has expired
    }

    return cooldownEnd.getTime() - now.getTime();
  } catch (error) {
    logger.error('Error calculating alert cooldown remaining:', error);
    return 0; // Assume no cooldown on error
  }
}

/**
 * Resets the cooldown for an alert by clearing the lastTriggered timestamp
 * @param alertId The alert ID to reset
 * @returns true if reset was successful, false otherwise
 */
export async function resetAlertCooldown(alertId: string): Promise<boolean> {
  try {
    await prisma.alert.update({
      where: { id: alertId },
      data: { lastTriggered: null },
    });

    logger.info(`Reset cooldown for alert ${alertId}`);
    return true;
  } catch (error) {
    logger.error(`Error resetting cooldown for alert ${alertId}:`, error);
    return false;
  }
}

/**
 * Gets statistics about alerts and their cooldown status
 * @param tokenId Optional filter by token ID
 * @returns Statistics object
 */
export async function getAlertCooldownStats(tokenId?: string) {
  try {
    const now = new Date();
    const cooldownThreshold = new Date(
      now.getTime() - ALERT_COOLDOWN_PERIOD_MS
    );

    const whereClause = tokenId ? { token: { address: tokenId } } : {};

    const [totalAlerts, enabledAlerts, alertsInCooldown] = await Promise.all([
      prisma.alert.count({ where: whereClause }),
      prisma.alert.count({
        where: {
          ...whereClause,
          enabled: true,
        },
      }),
      prisma.alert.count({
        where: {
          ...whereClause,
          lastTriggered: { gt: cooldownThreshold },
        },
      }),
    ]);

    return {
      totalAlerts,
      enabledAlerts,
      alertsInCooldown,
      alertsAvailable: enabledAlerts - alertsInCooldown,
      cooldownPeriodMs: ALERT_COOLDOWN_PERIOD_MS,
    };
  } catch (error) {
    logger.error('Error getting alert cooldown stats:', error);
    return {
      totalAlerts: 0,
      enabledAlerts: 0,
      alertsInCooldown: 0,
      alertsAvailable: 0,
      cooldownPeriodMs: ALERT_COOLDOWN_PERIOD_MS,
    };
  }
}
