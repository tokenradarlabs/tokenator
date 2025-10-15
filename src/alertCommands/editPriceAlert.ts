import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { AlertDirection } from '../generated/prisma/client';
import logger from '../utils/logger';
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
    await interaction.reply({
      content: 'This command can only be used in a server channel.',
      flags: 64,
    });
    return;
  }

  if (!newDirection && !newValue) {
    await interaction.reply({
      content: 'Please provide either a new direction or a new value to edit the alert.',
      flags: 64,
    });
    return;
  }

  const existingAlert = await findPriceAlertById(alertId, guildId);

  if (!existingAlert) {
    await interaction.reply({
      content: `No price alert found with ID: ${alertId}`,
      flags: 64,
    });
    return;
  }

  const tokenId = existingAlert.tokenId;

  if (newValue !== null) {
    const standardizedTokenId = getStandardizedTokenId(tokenId);

    if (!standardizedTokenId) {
      await interaction.reply({
        content: `Unsupported token for price validation: ${tokenId}`,
        flags: 64,
      });
      return;
    }

    // If newDirection is not provided, use the existing alert's direction for validation
    const directionForValidation = newDirection || existingAlert.direction;

    const validationResult = await validatePriceAlertValue(
      standardizedTokenId,
      newValue,
      directionForValidation
    );

    if (!validationResult.isValid) {
      await interaction.reply({
        content: `Invalid price value: ${validationResult.errorMessage}`,
        flags: 64,
      });
      return;
    }
  }

  try {
    const result = await editPriceAlert({
      alertId,
      newDirection: newDirection || undefined,
      newValue: newValue || undefined,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error('Error in handleEditPriceAlert:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
