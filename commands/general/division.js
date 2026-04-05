const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  EmbedBuilder,
} = require("discord.js");

const { DIVISION_ROLE } = require("../../utils/permissions");
const Divisions = require("../../models/divisions");
const Teams = require("../../models/teams");
const Staffs = require("../../models/staffs");

// Escape regex special characters so "GFC | EPL" is treated literally
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Normalize Unicode (removes zero‑width chars, weird spacing, etc.)
function normalizeName(str) {
  return str
    .normalize("NFKD")
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("division")
    .setDescription("View all divisions and their teams"),

  async execute(interaction, client) {
    const allowedRoles = Array.isArray(DIVISION_ROLE)
      ? DIVISION_ROLE
      : [DIVISION_ROLE];

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.some((roleId) => interaction.member.roles.cache.has(roleId))
    ) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const divisions = await Divisions.find();

    if (divisions.length === 0) {
      return interaction.reply({
        content: "There are no divisions yet.",
        ephemeral: true,
      });
    }

    const options = divisions.map((d) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(d.name)
        .setValue(d.name)
        .setEmoji(d.emoji)
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId("select_division")
      .setPlaceholder("Choose a division...")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
      content: "Select a division to view its teams:",
      components: [row],
      ephemeral: false, // ⭐ PUBLIC NOW
    });
  },

  async handleSelect(interaction, client) {
    const allowedRoles = Array.isArray(DIVISION_ROLE)
      ? DIVISION_ROLE
      : [DIVISION_ROLE];

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.some((roleId) => interaction.member.roles.cache.has(roleId))
    ) {
      return interaction.reply({
        content: "You do not have permission.",
        ephemeral: true,
      });
    }

    const rawName = interaction.values[0];
    const normalizedName = normalizeName(rawName);
    const safeName = escapeRegex(normalizedName);

    const division = await Divisions.findOne({
      name: { $regex: new RegExp(`^${safeName}$`, "i") },
    });

    if (!division) {
      return interaction.reply({
        content: "Division not found.",
        ephemeral: true,
      });
    }

    const teams = await Teams.find({ division: division.name });
    const staff = await Staffs.find();

    if (teams.length === 0) {
      return interaction.update({
        content: `**${division.emoji} ${division.name}** has no teams yet.`,
        components: [],
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${division.emoji} ${division.name}`)
      .setColor(0x5865f2)
      .setDescription(
        `### Division Overview\nBelow is a full list of teams, their management, and player counts.\n\n` +
        `**Vacant positions** mean the team is available to claim.`
      )
      .setTimestamp();

    for (const team of teams) {
      const teamStaff = staff.filter((s) => s.teamRoleId === team.roleId);

      const chairman = teamStaff.find((s) => s.position === "chairman");
      const manager = teamStaff.find((s) => s.position === "manager");
      const assistant = teamStaff.find((s) => s.position === "assistant");

      const chairmanText = chairman ? `<@${chairman.userId}>` : "**Vacant**";
      const managerText = manager ? `<@${manager.userId}>` : "**Vacant**";
      const assistantText = assistant ? `<@${assistant.userId}>` : "**Vacant**";

      const role = await interaction.guild.roles.fetch(team.roleId).catch(() => null);
      const playerCount = role ? role.members.size : 0;

      embed.addFields({
        name: `${team.emoji} **${team.name}**`,
        value:
          `• **Chairman:** ${chairmanText}\n` +
          `• **Manager:** ${managerText}\n` +
          `• **Assistant Manager:** ${assistantText}\n` +
          `• **Players:** ${playerCount}`,
        inline: false,
      });
    }

    await interaction.update({
      content: "",
      embeds: [embed],
      components: [],
    });
  },
};
