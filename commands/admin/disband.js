const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const { DISBAND_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disband')
    .setDescription('Wipe all players and managers from a team')
    .addStringOption(opt =>
      opt.setName('team')
        .setDescription('Team name')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(DISBAND_ROLE)
      ? DISBAND_ROLE
      : [DISBAND_ROLE];

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))
    ) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -------------------------

    const teamName = interaction.options.getString('team');
    const teams = loadJSON('teams.json');
    const team = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());

    if (!team) {
      return interaction.reply({
        content: `No team named **${teamName}** found.`,
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    const role = guild.roles.cache.get(team.roleId);

    // ⭐ REMOVE TEAM ROLE FROM EVERY MEMBER
    let removedPlayers = 0;
    if (role) {
      for (const [, member] of role.members) {
        try {
          await member.roles.remove(team.roleId);
          removedPlayers++;
        } catch (err) {
          console.error(`Failed to remove team role from ${member.user.tag}:`, err);
        }
      }
    }

    // ⭐ REMOVE ALL STAFF ENTRIES FOR THIS TEAM
    const staff = loadJSON('staff.json');
    const removedStaff = staff.filter(s => s.teamRoleId === team.roleId).length;

    const updatedStaff = staff.filter(s => s.teamRoleId !== team.roleId);
    saveJSON('staff.json', updatedStaff);

    // ⭐ DO NOT DELETE THE TEAM — KEEP IT IN teams.json

    // --- EMBED LOG ---
    const embed = new EmbedBuilder()
      .setColor('#c0392b')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Team Wiped')
      .setThumbnail(
        team.emoji && team.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 }) // fallback for unicode emoji
      )
      .addFields(
        { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
        { name: 'Players Removed', value: `**${removedPlayers}**`, inline: true },
        { name: 'Staff Removed', value: `**${removedStaff}**`, inline: true },
        { name: 'Wiped By', value: `${interaction.user.tag}`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    await interaction.editReply({
      content: `Team **${team.emoji} ${team.name}** has been wiped. All players and staff have been removed, but the team still exists.`
    });
  }
};
