import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { AlertDirection } from '../generated/prisma/client';
import logger from '../utils/logger';
import { sendErrorReply, errorMessages } from '../utils/errorMessageUtils';
import { editPriceAlert, findPriceAlertById } from '../lib/alertcommands';
import { validatePriceAlertValue } from '../utils/priceValidation';
import { getStandardizedTokenId } from '../utils/constants';
import { formatPrice } from '../utils/priceFormatter';

export const editPriceAlertCommand = new SlashCommandBuilder()
  .setName('edit-price-alert')
  .setDescription('Edits an existing price alert.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('The ID of the alert to edit.')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('direction')
      .setDescription('The new price direction to alert on.')
      .setRequired(false)
      .addChoices({ name: 'Up', value: 'up' }, { name: 'Down', value: 'down' })
  )
  .addNumberOption(option =>
    option
      .setName('value')
      .setDescription('The new price value to alert at.')
      .setRequired(false)
  )
  .toJSON();

export async function handleEditPriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString('id', true);
  const newDirection = interaction.options.getString(
    'direction'
  ) as AlertDirection | null;
  const newValue = interaction.options.getNumber('value');
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await sendErrorReply(interaction, errorMessages.commandOnlyInGuild());
    return;
  }

  if (!newDirection && !newValue) {
    await sendErrorReply(interaction, errorMessages.editAlertNoChanges());
    return;
  }

  const existingAlert = await findPriceAlertById(alertId, guildId);

  if (!existingAlert) {
    await sendErrorReply(interaction, errorMessages.priceAlertNotFound(alertId));
    return;
  }

  const tokenId = existingAlert.tokenId;

  try {
    const result = await editPriceAlert({
      alertId,
      newDirection: newDirection || undefined,
      newValue: newValue || undefined,
      guildId,
      channelId,
      tokenId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in handleEditPriceAlert:');
    await sendErrorReply(interaction, errorMessages.unexpectedError());
  }
}
