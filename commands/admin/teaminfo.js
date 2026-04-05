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
    .setName("teaminfo")
    .setDescription("View detailed information about any team"),

  async execute(interaction, client) {

    const teams = await Teams.find();
    if (!teams.length) {
      return interaction.reply({
        content: "There are no teams yet.",
        ephemeral: true
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("teaminfo-select")
      .setPlaceholder("Select a team...")
      .addOptions(
        teams.map(t => ({
          label: t.name,
          value: t.roleId,
          emoji: t.emoji || undefined
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: "Choose a team to view its information:",
      components: [row],
      ephemeral: false
    });
  },

  async handleSelect(interaction, client) {
    await interaction.deferUpdate();

    const teamRoleId = interaction.values[0];

    const team = await Teams.findOne({ roleId: teamRoleId });
    if (!team) {
      return interaction.editReply({
        content: "This team no longer exists.",
        components: []
      });
    }

    // Load staff for this team
    const staff = await Staffs.find({ teamRoleId });

    const chairman = staff.find(s => s.position === "chairman");
    const manager = staff.find(s => s.position === "manager");
    const assistant = staff.find(s => s.position === "assistant");

    const chairmanText = chairman ? `<@${chairman.userId}>` : "Vacant";
    const managerText = manager ? `<@${manager.userId}>` : "Vacant";
    const assistantText = assistant ? `<@${assistant.userId}>` : "Vacant";

    // ⭐ Fetch ONLY members with the team role
    const role = interaction.guild.roles.cache.get(teamRoleId);
    const membersWithRole = role ? role.members : new Map();

    // ⭐ Build player list INCLUDING staff with labels
    let playerList = "";

    for (const [id, member] of membersWithRole) {
      let label = "(Player)";

      if (chairman && chairman.userId === id) label = "(Chairman)";
      else if (manager && manager.userId === id) label = "(Manager)";
      else if (assistant && assistant.userId === id) label = "(Assistant Manager)";

      playerList += `• <@${id}> ${label}\n`;
    }

    if (playerList === "") playerList = "*No players signed yet.*";

    // Thumbnail logic
    const thumbnail = team.emoji && team.emoji.startsWith("<")
      ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, "")}.png?size=256&quality=lossless`
      : interaction.guild.iconURL({ size: 256 });

    const embed = new EmbedBuilder()
      .setColor("#3498db")
      .setAuthor({
        name: interaction.guild.name,
        iconURL: interaction.guild.iconURL({ size: 256 })
      })
      .setTitle(`${team.emoji} ${team.name} — Team Information`)
      .setThumbnail(thumbnail)
      .addFields(
        { name: "Chairman", value: chairmanText, inline: true },
        { name: "Manager", value: managerText, inline: true },
        { name: "Assistant Manager", value: assistantText, inline: true },
        { name: "Players", value: playerList, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({
      content: "",
      embeds: [embed],
      components: []
    });
  }
};
