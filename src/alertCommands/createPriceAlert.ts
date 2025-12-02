import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createContextualLogger } from '../utils/logger';
import { sendErrorReply, errorMessages } from '../utils/errorMessageUtils';
import { createPriceAlert } from '../lib/alertcommands';
import { validatePriceAlertValue, sanitizeTokenSymbol } from '../utils/priceValidation';
import { sanitizeString, sanitizeNumber } from '../utils/inputSanitization';

export const createPriceAlertCommand = new SlashCommandBuilder()
  .setName('create-price-alert')
  .setDescription('Creates a price alert for a supported token.')
  .addStringOption(option =>
    option
      .setName('token-id')
      .setDescription(
        'The token to create an alert for (e.g., "dev", "eth", "btc")'
      )
      .setRequired(true)
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
  const direction = sanitizeString(interaction.options.getString('direction', true)) as
    | 'up'
    | 'down' | null;
  const value = sanitizeNumber(interaction.options.getNumber('value', true));
  const tokenId = interaction.options.getString('token-id', true); // Raw input, will be sanitized internally by validatePriceAlertValue
  
  const { guildId, channelId } = interaction;
  const contextualLogger = createContextualLogger({
    userId: interaction.user.id,
    guildId: guildId || undefined,
    channelId: channelId || undefined,
    commandName: 'create-price-alert',
  });

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
  const validatedPriceValue = validationResult.parsedPriceValue;
  const validatedTokenId = validationResult.sanitizedTokenId; // Use the sanitized token ID from validationResult

  if (validatedPriceValue === undefined || validatedTokenId === undefined) {
    await sendErrorReply(interaction, errorMessages.internalPriceValidation());
    return;
  }
  if (!guildId) {
    await sendErrorReply(interaction, errorMessages.commandOnlyInGuild());
    return;
  }

  if (!channelId) {
    await sendErrorReply(interaction, errorMessages.commandOnlyInTextChannel());
    return;
  }

  try {
    const result = await createPriceAlert({
      tokenId: validatedTokenId, // Use the sanitized and validated token ID
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
    contextualLogger.error({ err: error }, 'Error in handleCreatePriceAlert');
    await sendErrorReply(interaction, errorMessages.unexpectedError());
  }
}
