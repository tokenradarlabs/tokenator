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

  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'This command can only be used in a server channel.',
      flags: 64,
    });
    return;
  }

  try {
    const result = await editVolumeAlert({
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
    logger.error('Error in handleEditVolumeAlert:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
