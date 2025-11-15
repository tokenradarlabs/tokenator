import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { importAlerts } from '../../lib/alertcommands/importAlerts';
import { logger } from '../../utils/logger';

export const importAlertsCommand = new SlashCommandBuilder()
  .setName('import-alerts')
  .setDescription('Import alerts from a JSON string')
  .addStringOption(option =>
    option
      .setName('alerts-json')
      .setDescription('The JSON string of alerts to import')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('resolve-conflicts')
      .setDescription('How to handle conflicts: skip, overwrite, or rename (default: skip)')
      .setRequired(false)
      .addChoices(
        { name: 'skip', value: 'skip' },
        { name: 'overwrite', value: 'overwrite' },
        { name: 'rename', value: 'rename' }
      )
  );

export async function handleImportAlerts(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient
) {
  try {
    const userId = interaction.user.id;
    const channelId = interaction.channelId;
    const alertsJson = interaction.options.getString('alerts-json', true);
    const resolveConflicts = (interaction.options.getString('resolve-conflicts') || 'skip') as 'skip' | 'overwrite' | 'rename';

    const results = await importAlerts(prisma, userId, channelId, alertsJson, resolveConflicts);

    logger.info(`Alert import results for user ${userId} in channel ${channelId}: ${JSON.stringify(results)}`);
    await interaction.reply({
      content: `Alert import complete:
  Price Alerts: Created: ${results.priceAlerts.created}, Updated: ${results.priceAlerts.updated}, Skipped: ${results.priceAlerts.skipped}, Errors: ${results.priceAlerts.errors}
  Volume Alerts: Created: ${results.volumeAlerts.created}, Updated: ${results.volumeAlerts.updated}, Skipped: ${results.volumeAlerts.skipped}, Errors: ${results.volumeAlerts.errors}`,
      ephemeral: true,
    });

  } catch (error) {
    logger.error(`Failed to import alerts: ${error.message}`);
    await interaction.reply({ content: `Error importing alerts: ${error.message}`, ephemeral: true });
  }
}