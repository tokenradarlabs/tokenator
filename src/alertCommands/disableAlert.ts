import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import { disablePriceAlert } from "../lib/alertcommands";

export const disablePriceAlertCommand = new SlashCommandBuilder()
  .setName("disable-alert")
  .setDescription("Disables an alert by its ID or enabled alerts by type.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to disable.")
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName("disable-type")
      .setDescription("Choose which type of alerts to disable.")
      .setRequired(false)
      .addChoices(
        { name: "All alerts", value: "all" },
        { name: "Price alerts only", value: "price" },
        { name: "Volume alerts only", value: "volume" }
      )
  )
  .toJSON();

export async function handleDisablePriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString("id");
  const disableType = interaction.options.getString("disable-type");
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: "This command can only be used in a server channel.",
      flags: 64,
    });
    return;
  }

  try {
    const result = await disablePriceAlert({
      alertId: alertId || undefined,
      disableType: (disableType as 'all' | 'price' | 'volume') || undefined,
      guildId,
      channelId,
    });

    await interaction.reply({
      content: result.message,
      flags: 64,
    });
  } catch (error) {
    logger.error('Error in handleDisablePriceAlert:', error);
    await interaction.reply({
      content: 'Sorry, there was an unexpected error. Please try again later.',
      flags: 64,
    });
  }
} 