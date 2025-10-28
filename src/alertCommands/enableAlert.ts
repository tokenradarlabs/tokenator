import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import logger from '../utils/logger';
import { enablePriceAlert } from '../lib/alertcommands';

export const enablePriceAlertCommand = new SlashCommandBuilder()
  .setName('enable-alert')
  .setDescription('Enables an alert by its ID or disabled alerts by type.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('The ID of the alert to enable.')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('enable-type')
      .setDescription('Choose which type of alerts to enable.')
      .setRequired(false)
      .addChoices(
        { name: 'All alerts', value: 'all' },
        { name: 'Price alerts only', value: 'price' },
        { name: 'Volume alerts only', value: 'volume' }
      )
  )
  .toJSON();

export async function handleEnablePriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString('id');
  const enableType = interaction.options.getString('enable-type');
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'This command can only be used in a server channel.',
      flags: 64,
    });
    return;
  }

  if (!alertId && !enableType) {
    await interaction.reply({
      content: 'Please provide either an alert ID or an enable type (all, price, or volume).',
      flags: 64,
    });
    return;
  }

  try {
    const result = await enablePriceAlert({
      alertId: alertId || undefined,
      enableType: (enableType as 'all' | 'price' | 'volume') || undefined,
      guildId,
      channelId,
    });

    if (result.message.includes(\'already enabled\') || result.message.includes(\'no changes needed\')) {\n      await interaction.reply({\n        content: `Alert with ID \`${alertId}\` is already enabled. No changes were made.`,\n        flags: 64,\n      });\n    } else {\n      await interaction.reply({\n        content: result.message,\n        flags: 64,\n      });\n    }
  } catch (error) {
    logger.error('Error in handleEnablePriceAlert:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
