const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const { REMOVE_TEAM_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeteam')
    .setDescription('Remove a team by name')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Team name')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(REMOVE_TEAM_ROLE)
      ? REMOVE_TEAM_ROLE
      : [REMOVE_TEAM_ROLE];

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

    const name = interaction.options.getString('name');
    const teams = loadJSON('teams.json');
    const index = teams.findIndex(t => t.name.toLowerCase() === name.toLowerCase());

    if (index === -1) {
      return interaction.reply({
        content: `No team named **${name}** found.`,
        ephemeral: true
      });
    }

    const [removed] = teams.splice(index, 1);
    saveJSON('teams.json', teams);

    // Remove all staff entries for this team
    const staff = loadJSON('staff.json');
    const removedStaff = staff.filter(s => s.teamRoleId === removed.roleId).length;

    const updatedStaff = staff.filter(s => s.teamRoleId !== removed.roleId);
    saveJSON('staff.json', updatedStaff);

    // --- EMBED LOG ---
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Team Removed')
      .setThumbnail(
        removed.emoji && removed.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${removed.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 }) // fallback for unicode emoji
      )
      .addFields(
        { name: 'Team', value: `${removed.emoji} **${removed.name}**`, inline: false },
        { name: 'Staff Removed', value: `**${removedStaff}**`, inline: true },
        { name: 'Removed By', value: `${interaction.user.tag}`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    await interaction.reply({
      content: `Team **${removed.emoji} ${removed.name}** has been removed.`
    });
  }
};
