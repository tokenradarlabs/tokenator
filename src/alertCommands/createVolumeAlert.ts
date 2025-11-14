import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { createVolumeAlert } from '../lib/alertcommands';
import { getStandardizedTokenId } from '../utils/constants';
import logger, { createContextualLogger } from '../utils/logger';
import { sendErrorReply, errorMessages } from '../utils/errorMessageUtils';
import { sanitizeString, sanitizeNumber } from '../utils/inputSanitization';

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
  .addStringOption(option =>
    option
      .setName('timeframe')
      .setDescription('The time frame for the volume (e.g., 24h, 7d, 30d)')
      .setRequired(true)
      .addChoices(
        { name: '24 hours', value: '24h' },
        { name: '7 days', value: '7d' },
        { name: '30 days', value: '30d' }
      )
  )
  .toJSON();

export async function handleCreateVolumeAlert(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const token = sanitizeString(interaction.options.getString('token', true));
    const direction = sanitizeString(interaction.options.getString('direction', true)) as 'up' | 'down' | null;
    const volume = sanitizeNumber(interaction.options.getNumber('volume', true));
    const timeframe = sanitizeString(interaction.options.getString('timeframe', true)) as '24h' | '7d' | '30d' | null;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const contextualLogger = createContextualLogger({
      userId: interaction.user.id,
      guildId: guildId || undefined,
      channelId: channelId || undefined,
      commandName: 'create-volume-alert',
    });

    if (token === null || direction === null || volume === null || timeframe === null) {
      await sendErrorReply(interaction, errorMessages.invalidInput());
      return;
    }



    if (!guildId) {
      await sendErrorReply(interaction, errorMessages.commandOnlyInGuild());
      return;
    }

    // Check if it's a text channel
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await sendErrorReply(interaction, errorMessages.commandOnlyInTextChannel());
      return;
    }

    const standardizedTokenId = getStandardizedTokenId(token);
    if (!standardizedTokenId) {
      await sendErrorReply(interaction, errorMessages.invalidToken());
      return;
    }

    const result = await createVolumeAlert({
      tokenId: token,
      direction,
      value: volume,
      timeframe,
      guildId,
      channelId,
      guildName: interaction.guild?.name,
    });

    await interaction.editReply({
      content: result.message,
    });

    if (result.success) {
      contextualLogger.info({        guildId,
        channelId,
        userId: interaction.user.id,
        token,
        direction,
        volume,
      }, `[VolumeAlertCommand] Volume alert created successfully`);
    } else {
      contextualLogger.warn({        guildId,
        channelId,
        userId: interaction.user.id,
        token,
        direction,
        volume,
        reason: result.message,
      }, `[VolumeAlertCommand] Failed to create volume alert`);
    }

  } catch (error) {
    contextualLogger.error({ err: error,        guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
    }, '[VolumeAlertCommand] Error executing volume alert command');

    await sendErrorReply(interaction, errorMessages.unexpectedError());
  }
}
