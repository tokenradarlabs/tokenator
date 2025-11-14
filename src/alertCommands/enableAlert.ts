import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { createContextualLogger } from '../utils/logger';
import { sendErrorReply, errorMessages } from '../utils/errorMessageUtils';
import { enablePriceAlert } from '../lib/alertcommands';
import { sanitizeString } from '../utils/inputSanitization';

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
  const alertId = sanitizeString(interaction.options.getString('id'));
  const enableType = sanitizeString(interaction.options.getString('enable-type'));
  const { guildId, channelId } = interaction;
  const contextualLogger = createContextualLogger({
    userId: interaction.user.id,
    guildId: guildId || undefined,
    channelId: channelId || undefined,
    commandName: 'enable-alert',
  });

  if (!guildId || !channelId) {
    await sendErrorReply(interaction, errorMessages.commandOnlyInGuild());
    return;
  }

  if (!alertId && !enableType) {
    await sendErrorReply(interaction, errorMessages.enableAlertNoIdOrType());
    return;
  }

  try {
    const result = await enablePriceAlert({
      alertId: alertId || undefined,
      enableType: (enableType as 'all' | 'price' | 'volume') || undefined,
      guildId,
      channelId,
    });

    if (result.message.includes('already enabled') || result.message.includes('no changes needed')) {
      const identifier = alertId ? `with ID \`${alertId}\`` : `of type \`${enableType}\``;
      await sendErrorReply(interaction, errorMessages.alertAlreadyEnabled(identifier));
    } else {
      await interaction.reply({
        content: result.message,
        flags: 64,
      });
    }
  } catch (error) {
    contextualLogger.error({ err: error }, 'Error in handleEnablePriceAlert:');
    await sendErrorReply(interaction, errorMessages.unexpectedError());
  }
}
