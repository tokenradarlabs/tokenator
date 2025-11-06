import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { AlertDirection } from '../generated/prisma/client';
import logger from '../utils/logger';
import { editVolumeAlert } from '../lib/alertcommands';

export const editVolumeAlertCommand = new SlashCommandBuilder()
  .setName('edit-volume-alert')
  .setDescription('Edits an existing volume alert.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('The ID of the volume alert to edit.')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('direction')
      .setDescription('The new volume direction to alert on.')
      .setRequired(false)
      .addChoices({ name: 'Up', value: 'up' }, { name: 'Down', value: 'down' })
  )
  .addNumberOption(option =>
    option
      .setName('value')
      .setDescription('The new volume value to alert at.')
      .setRequired(false)
  )
  .toJSON();

export async function handleEditVolumeAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString('id', true);
  const newDirection = interaction.options.getString('direction') as AlertDirection | null;
  const newValue = interaction.options.getNumber('value');
  const { guildId, channelId } = interaction;

  logger.debug(
    `handleEditVolumeAlert: alertId=${alertId}, newDirection=${newDirection}, newValue=${newValue}, guildId=${guildId}, channelId=${channelId}`
  );

  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'This command can only be used in a server channel.',
      flags: 64,
    });
    return;
  }

  if (newValue !== null && (newValue <= 0 || isNaN(newValue))) {
    await interaction.reply({
      content: 'The volume value must be a positive number.',
      flags: 64,
    });
    return;
  }

  try {
    logger.debug(`Attempting to edit volume alert with ID: ${alertId}`);
    const result = await editVolumeAlert({
      alertId,
      newDirection: newDirection || undefined,
      newValue: newValue || undefined,
      guildId,
      channelId,
    });

    logger.debug(`Volume alert edit result: ${result.message}`);
    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in handleEditVolumeAlert:');
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
