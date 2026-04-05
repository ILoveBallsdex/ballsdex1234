const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const {
  SACK_ROLE,
  ASSISTANT_MANAGER_ROLE,
  MANAGER_ROLE,
  CHAIRMAN_ROLE
} = require('../../utils/permissions');

const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

function getStaffRoleId(position) {
  switch (position) {
    case 'assistant': return ASSISTANT_MANAGER_ROLE;
    case 'manager': return MANAGER_ROLE;
    case 'chairman': return CHAIRMAN_ROLE;
    default: return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sack')
    .setDescription('Removes a users management position + releases them off their team')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to sack')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('team')
        .setDescription('Team name')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(SACK_ROLE) ? SACK_ROLE : [SACK_ROLE];
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

    const user = interaction.options.getUser('user');
    const teamName = interaction.options.getString('team');

    const teams = loadJSON('teams.json');
    const staff = loadJSON('staff.json');

    const team = teams.find(
      t => t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) {
      return interaction.reply({
        content: `No team named **${teamName}** found.`,
        ephemeral: true
      });
    }

    // Find staff entry
    const staffIndex = staff.findIndex(
      s => s.userId === user.id && s.teamRoleId === team.roleId
    );

    if (staffIndex === -1) {
      return interaction.reply({
        content: `${user} is not a staff member of **${team.name}**.`,
        ephemeral: true
      });
    }

    const removed = staff[staffIndex];

    // Remove from staff.json
    staff.splice(staffIndex, 1);
    saveJSON('staff.json', staff);

    // Fetch guild member
    const member = await interaction.guild.members.fetch(user.id);

    // Remove team role
    if (member.roles.cache.has(team.roleId)) {
      await member.roles.remove(team.roleId);
    }

    // Remove staff hierarchy role
    const staffRoleId = getStaffRoleId(removed.position);
    if (staffRoleId && member.roles.cache.has(staffRoleId)) {
      await member.roles.remove(staffRoleId);
    }

    // --- EMBED LOG ---
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Staff Member Sacked')
      .setThumbnail(
        team.emoji && team.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 }) // fallback for unicode emoji
      )
      .addFields(
        { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
        { name: 'Position Removed', value: `**${removed.position}**`, inline: true },
        { name: 'User Sacked', value: `${user.tag}`, inline: false },
        { name: 'Sacked By', value: `${interaction.user.tag}`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    await interaction.reply({
      content: `${user} has been sacked from **${team.name}** (was **${removed.position}**).`
    });
  }
};
