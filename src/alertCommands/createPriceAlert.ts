import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import logger from '../utils/logger';
import { createPriceAlert } from '../lib/alertcommands';
import { validatePriceAlertValue } from '../utils/priceValidation';

export const createPriceAlertCommand = new SlashCommandBuilder()
  .setName('create-price-alert')
  .setDescription('Creates a price alert for a supported token.')
  .addStringOption(option =>
    option
      .setName('token-id')
      .setDescription(
        'The token to create an alert for (supported: dev, eth, btc)'
      )
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
      .setDescription('Price direction to alert on')
      .setRequired(true)
      .addChoices({ name: 'Up', value: 'up' }, { name: 'Down', value: 'down' })
  )
  .addNumberOption(option =>
    option
      .setName('value')
      .setDescription('The price value to alert at')
      .setRequired(true)
  )
  .toJSON();

export async function handleCreatePriceAlert(
  interaction: ChatInputCommandInteraction
) {
  const direction = interaction.options.getString('direction', true) as
    | 'up'
    | 'down';
  const value = interaction.options.getNumber('value', true);
  const tokenId = interaction.options.getString('token-id', true);
  const { guildId, channelId } = interaction;

  const validationResult = await validatePriceAlertValue(
    tokenId,
    value,
    direction
  );

  if (!validationResult.isValid) {
    await interaction.reply({
      content: validationResult.errorMessage,
      flags: 64,
    });
    return;
  }

  // Use the parsed and validated price value
  const validatedPriceValue = validationResult.parsedPriceValue!;

  if (!guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      flags: 64,
    });
    return;
  }

  if (!channelId) {
    await interaction.reply({
      content: 'This command can only be used in a channel.',
      flags: 64,
    });
    return;
  }

  try {
    const result = await createPriceAlert({
      tokenId,
      direction,
      value: validatedPriceValue,
      guildId,
      channelId,
      guildName: interaction.guild?.name,
    });

    if (result.success) {
      await interaction.reply(result.message);
    } else {
      await interaction.reply({
        content: result.message,
        flags: 64,
      });
    }
  } catch (error) {
    logger.error(error, 'Error in handleCreatePriceAlert');
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
}
