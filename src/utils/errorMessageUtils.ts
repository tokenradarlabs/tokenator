import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';

const ERROR_FLAG = MessageFlags.Ephemeral; // Equivalent to 64

export const errorMessages = {
  commandOnlyInGuild: () => ({
    content: '❌ This command can only be used in a server, not in DMs.',
    flags: ERROR_FLAG,
  }),
  commandOnlyInTextChannel: () => ({
    content: '❌ This command can only be used in text channels.',
    flags: ERROR_FLAG,
  }),
  invalidToken: () => ({
    content: '❌ Invalid token. Please use scout-protocol-token, bitcoin, or ethereum.',
    flags: ERROR_FLAG,
  }),
  unexpectedError: () => ({
    content: '❌ An unexpected error occurred. Please try again later.',
    flags: ERROR_FLAG,
  }),
  invalidAlertIdFormat: () => ({
    content: '❌ Invalid alert ID format. Please provide a valid UUID.',
    flags: ERROR_FLAG,
  }),
  alertNotFound: (alertId: string) => ({
    content: `❌ No alert found with ID: ${alertId}.`,
    flags: ERROR_FLAG,
  }),
  priceAlertNotFound: (alertId: string) => ({
    content: `❌ No price alert found with ID: ${alertId}.`,
    flags: ERROR_FLAG,
  }),
  editAlertNoChanges: () => ({
    content: '❌ Please provide either a new direction or a new value to edit the alert.',
    flags: ERROR_FLAG,
  }),
  volumeValueNotPositive: () => ({
    content: '❌ The volume value must be a positive number.',
    flags: ERROR_FLAG,
  }),
  enableAlertNoIdOrType: () => ({
    content: '❌ Please provide either an alert ID or an enable type (all, price, or volume).',
    flags: ERROR_FLAG,
  }),
  alertAlreadyEnabled: (identifier: string) => ({
    content: `ℹ️ Alert ${identifier} is already enabled. No changes were made.`,
    flags: ERROR_FLAG,
  }),
  internalPriceValidation: () => ({
    content: '❌ Internal error validating price value.',
    flags: ERROR_FLAG,
  }),
  invalidInput: () => ({
    content: '❌ Invalid input provided. Please check your command and try again.',
    flags: ERROR_FLAG,
  }),
};

export async function sendErrorReply(
  interaction: ChatInputCommandInteraction,
  errorMessage: { content: string; flags: MessageFlags }
) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(errorMessage);
  } else {
    await interaction.reply({ ...errorMessage, ephemeral: true });
  }
}
