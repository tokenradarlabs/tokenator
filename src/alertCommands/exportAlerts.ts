import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { exportAlerts } from '../../lib/alertcommands/exportAlerts';
import { logger } from '../../utils/logger';

export const exportAlertsCommand = new SlashCommandBuilder()
  .setName('export-alerts')
  .setDescription('Export all your alerts as a JSON file');

export async function handleExportAlerts(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient
) {
  try {
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    const alertsJson = await exportAlerts(prisma, userId, channelId);

    // Discord has a message length limit, so we might need to send as a file or in chunks
    // For now, we'll send as a direct message if it's not too long, otherwise instruct the user.
    if (alertsJson.length < 1900) { // Discord message limit is 2000 characters
      await interaction.reply({ content: `
```json
${alertsJson}
```
`, ephemeral: true });
    } else {
      // In a real application, you'd upload this as a file or use a pastebin service
      await interaction.reply({ content: 'Your alerts are too large to display directly. Please contact an admin to retrieve them.', ephemeral: true });
    }
    logger.info(`Alerts exported for user ${userId} in channel ${channelId}`);
  } catch (error) {
    logger.error(`Failed to export alerts: ${error.message}`);
    await interaction.reply({ content: `Error exporting alerts: ${error.message}`, ephemeral: true });
  }
}