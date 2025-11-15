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
    const discordServerId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!discordServerId) {
      await interaction.reply({ content: 'This command can only be used in a Discord server.', ephemeral: true });
      return;
    }

    const alertsJson = await exportAlerts(prisma, discordServerId, channelId);

    // Discord has a message length limit, so we might need to send as a file or in chunks
    // For now, we'll send as a direct message if it's not too long, otherwise instruct the user.
    if (alertsJson.length < 1900) { // Discord message limit is 2000 characters
      await interaction.reply({ content: '```json\n' + alertsJson + '\n```', ephemeral: true });
    } else {
      // In a real application, you'd upload this as a file or use a pastebin service
      await interaction.reply({ content: 'Your alerts are too large to display directly. Please contact an admin to retrieve them.', ephemeral: true });
    }
    logger.info(`Alerts exported for user ${interaction.user.id} in channel ${channelId}`);
  } catch (error) {
    logger.error(`Failed to export alerts for user ${interaction.user.id}: ${error.message}`);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `Error exporting alerts: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Error exporting alerts: ${error.message}`, ephemeral: true });
    }
  }
}