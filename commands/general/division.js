const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  EmbedBuilder
} = require("discord.js");

const Teams = require("../../models/teams");
const Staffs = require("../../models/staffs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("division")
    .setDescription("View teams in a division"),

  async execute(interaction, client) {

    const divisions = ["Division 1", "Division 2", "Division 3"];

    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_division")
      .setPlaceholder("Select a division...")
      .addOptions(
        divisions.map(d => ({
          label: d,
          value: d
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: "Choose a division:",
      components: [row],
      ephemeral: false
    });
  },

  async handleSelect(interaction, client) {
    await interaction.deferUpdate();

    const division = interaction.values[0];

    const teams = await Teams.find({ division });
    if (!teams.length) {
      return interaction.editReply({
        content: `No teams found in ${division}.`,
        components: []
      });
    }

    let description = "";

    for (const team of teams) {
      const staff = await Staffs.find({ teamRoleId: team.roleId });

      const chairman = staff.find(s => s.position === "chairman");
      const manager = staff.find(s => s.position === "manager");
      const assistant = staff.find(s => s.position === "assistant");

      const chairmanText = chairman ? `<@${chairman.userId}>` : "Vacant";
      const managerText = manager ? `<@${manager.userId}>` : "Vacant";
      const assistantText = assistant ? `<@${assistant.userId}>` : "Vacant";

      const playerCount = team.players?.length || 0;

      description += `${team.emoji} **${team.name}**\n` +
        `• Chairman: ${chairmanText}\n` +
        `• Manager: ${managerText}\n` +
        `• Assistant: ${assistantText}\n` +
        `• Players: **${playerCount}**\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle(`${division} — Teams`)
      .setDescription(description)
      .setTimestamp();

    await interaction.editReply({
      content: "",
      embeds: [embed],
      components: []
    });
  }
};
