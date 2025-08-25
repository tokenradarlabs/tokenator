import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { createVolumeAlert } from '../lib/alertcommands';
import { getStandardizedTokenId } from '../utils/constants';
import logger from '../utils/logger';

export const createVolumeAlertCommand = new SlashCommandBuilder()
  .setName('create-volume-alert')
  .setDescription('Create a volume alert for a token')
  .addStringOption(option =>
    option
      .setName('token')
      .setDescription('The token to track (DEV, BTC, ETH)')
      .setRequired(true)
      .addChoices(
        { name: 'scout-protocol-token (DEV)', value: 'scout-protocol-token' },
        { name: 'Bitcoin (BTC)', value: 'bitcoin' },
        { name: 'Ethereum (ETH)', value: 'ethereum' }
      )
  )
  .addStringOption(option =>
    option
      .setName('direction')
      .setDescription('Alert when volume goes up or down')
      .setRequired(true)
      .addChoices(
        { name: 'Up (Alert when volume rises above threshold)', value: 'up' },
        { name: 'Down (Alert when volume drops below threshold)', value: 'down' }
      )
  )
  .addNumberOption(option =>
    option
      .setName('volume')
      .setDescription('The volume threshold (in USD, e.g., 1000000 for $1M)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000000000000) // 1 trillion max
  )
  .toJSON();

export async function handleCreateVolumeAlert(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const token = interaction.options.getString('token', true);
    const direction = interaction.options.getString('direction', true) as 'up' | 'down';
    const volume = interaction.options.getNumber('volume', true);
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!guildId) {
      await interaction.editReply({
        content: '❌ This command can only be used in servers, not in DMs.',
      });
      return;
    }

    // Check if it's a text channel
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: '❌ This command can only be used in text channels.',
      });
      return;
    }

    const standardizedTokenId = getStandardizedTokenId(token);
    if (!standardizedTokenId) {
      await interaction.editReply({
        content: '❌ Invalid token. Please use scout-protocol-token, bitcoin, or ethereum.',
      });
      return;
    }

    const result = await createVolumeAlert({
      tokenId: token,
      direction,
      value: volume,
      guildId,
      channelId,
      guildName: interaction.guild?.name,
    });

    await interaction.editReply({
      content: result.message,
    });

    if (result.success) {
      logger.info(`[VolumeAlertCommand] Volume alert created successfully`, {
        guildId,
        channelId,
        userId: interaction.user.id,
        token,
        direction,
        volume,
      });
    } else {
      logger.warn(`[VolumeAlertCommand] Failed to create volume alert`, {
        guildId,
        channelId,
        userId: interaction.user.id,
        token,
        direction,
        volume,
        reason: result.message,
      });
    }

  } catch (error) {
    logger.error('[VolumeAlertCommand] Error executing volume alert command', error as Error, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
    });

    const errorMessage = '❌ An unexpected error occurred while creating the volume alert. Please try again later.';
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
