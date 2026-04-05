const { SlashCommandBuilder } = require('discord.js');
const { REMOVE_TEAM_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeteam')
    .setDescription('Remove a team by name')
    .addStringOption(opt => opt.setName('name').setDescription('Team name').setRequired(true)),

  async execute(interaction, client) {

    // --- FIXED PERMISSION CHECK (supports single or multiple role IDs) ---
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
    // ---------------------------------------------------------------------

    const name = interaction.options.getString('name');
    const teams = loadJSON('teams.json');
    const index = teams.findIndex(t => t.name.toLowerCase() === name.toLowerCase());

    if (index === -1) {
      return interaction.reply({ content: `No team named **${name}** found.`, ephemeral: true });
    }

    const [removed] = teams.splice(index, 1);
    saveJSON('teams.json', teams);

    const staff = loadJSON('staff.json');
    const updatedStaff = staff.filter(s => s.teamRoleId !== removed.roleId);
    saveJSON('staff.json', updatedStaff);

    await logAction(client, `🗑️ Team **${removed.emoji} ${removed.name}** was removed by ${interaction.user.tag}.`);
    await interaction.reply({ content: `Team **${removed.emoji} ${removed.name}** has been removed.` });
  }
};
