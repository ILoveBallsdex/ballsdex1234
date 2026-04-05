const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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

    // Load all teams
    const teams = await Teams.find();
    if (!teams.length) {
      return interaction.reply({
        content: "There are no teams yet.",
        ephemeral: true
      });
    }

    // Build dropdown
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
      ephemeral: false // ⭐ FIXED — must be public or updates will fail
    });
  },

  async handleSelect(interaction, client) {
    await interaction.deferUpdate(); // ⭐ FIXED — prevents “interaction failed”

    const teamRoleId = interaction.values[0];

    // Load team
    const team = await Teams.findOne({ roleId: teamRoleId });
    if (!team) {
      return interaction.editReply({
        content: "This team no longer exists.",
        components: []
      });
    }

    // Load staff
    const staff = await Staffs.find({ teamRoleId });

    const chairman = staff.find(s => s.position === "chairman");
    const manager = staff.find(s => s.position === "manager");
    const assistant = staff.find(s => s.position === "assistant");

    const chairmanText = chairman ? `<@${chairman.userId}>` : "Vacant";
    const managerText = manager ? `<@${manager.userId}>` : "Vacant";
    const assistantText = assistant ? `<@${assistant.userId}>` : "Vacant";

    // Fetch all guild members for accurate player list
    const allMembers = await interaction.guild.members.fetch();

    // Players stored in DB (from /sign)
    const players = team.players || [];

    // Build player list
    let playerList = "";

    for (const p of players) {
      const member = allMembers.get(p.userId);
      if (!member) continue;

      // Determine team-related role
      let roleLabel = "Team Player";

      const staffEntry = staff.find(s => s.userId === p.userId);
      if (staffEntry) {
        if (staffEntry.position === "chairman") roleLabel = "Chairman";
        if (staffEntry.position === "manager") roleLabel = "Manager";
        if (staffEntry.position === "assistant") roleLabel = "Assistant Manager";
      }

      const signedBy = p.signedBy ? `<@${p.signedBy}>` : "Unknown";
      const signedAt = p.signedAt
        ? `<t:${Math.floor(p.signedAt / 1000)}:R>`
        : "Unknown";

      playerList += `• <@${p.userId}> — **${roleLabel}**\n   Signed by: ${signedBy} (${signedAt})\n`;
    }

    if (playerList === "") playerList = "*No players signed yet.*";

    // Team emoji → thumbnail
    const thumbnail = team.emoji && team.emoji.startsWith("<")
      ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, "")}.png?size=256&quality=lossless`
      : interaction.guild.iconURL({ size: 256 });

    // Build embed
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
