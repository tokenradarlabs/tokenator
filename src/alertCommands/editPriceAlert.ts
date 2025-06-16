import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import logger from "../utils/logger";
import prisma from "../utils/prisma";
import { PriceAlertDirection } from "../generated/prisma/client";

export const editPriceAlertCommand = new SlashCommandBuilder()
  .setName("edit-price-alert")
  .setDescription("Edits an existing price alert.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("The ID of the alert to edit.")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("direction")
      .setDescription("The new price direction to alert on.")
      .setRequired(false)
      .addChoices({ name: "Up", value: "up" }, { name: "Down", value: "down" })
  )
  .addNumberOption((option) =>
    option
      .setName("value")
      .setDescription("The new price value to alert at.")
      .setRequired(false)
  )
  .toJSON();

export async function handleEditPriceAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const alertId = interaction.options.getString("id", true);
  const newDirection = interaction.options.getString("direction") as PriceAlertDirection | null;
  const newValue = interaction.options.getNumber("value");
  const { guildId, channelId } = interaction;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: "This command can only be used in a server channel.",
      flags: 64,
    });
    return;
  }

  if (!newDirection && newValue === null) {
    await interaction.reply({
      content: "You must provide a new direction or a new value to update.",
      flags: 64,
    });
    return;
  }

  try {
    const alert = await prisma.alert.findUnique({
      where: {
        id: alertId,
        discordServerId: guildId,
        channelId: channelId,
      },
      include: {
        priceAlert: true,
      },
    });

    if (!alert || !alert.priceAlert) {
      await interaction.reply({
        content: "Price alert not found or you do not have permission to edit it in this channel.",
        flags: 64,
      });
      return;
    }

    const updateData: { direction?: PriceAlertDirection; value?: number } = {};
    if (newDirection) {
      updateData.direction = newDirection;
    }
    if (newValue !== null) {
      updateData.value = newValue;
    }

    await prisma.priceAlert.update({
      where: {
        id: alert.priceAlert.id,
      },
      data: updateData,
    });

    await interaction.reply({
      content: `✅ Successfully updated alert with ID: \`${alertId}\`.`,
      flags: 64,
    });
  } catch (error) {
    logger.error("Error editing price alert:", error);
    await interaction.reply({
      content: "Sorry, there was an error editing the price alert.",
      flags: 64,
    });
  }
} 