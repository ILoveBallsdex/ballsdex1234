const { SlashCommandBuilder } = require('discord.js');
const { ADD_TEAM_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addteam')
    .setDescription('Add a team to a division')
    .addRoleOption(opt => opt.setName('role').setDescription('Team role').setRequired(true))
    .addStringOption(opt => opt.setName('emoji').setDescription('Team emoji').setRequired(true))
    .addStringOption(opt => opt.setName('division').setDescription('Division name').setRequired(true)),

  async execute(interaction, client) {

    // --- FIXED PERMISSION CHECK (supports single or multiple role IDs) ---
    const allowedRoles = Array.isArray(ADD_TEAM_ROLE)
      ? ADD_TEAM_ROLE
      : [ADD_TEAM_ROLE];

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

    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');
    const divisionName = interaction.options.getString('division');

    const divisions = loadJSON('divisions.json');
    const division = divisions.find(d => d.name.toLowerCase() === divisionName.toLowerCase());

    if (!division) {
      return interaction.reply({ content: `No division named **${divisionName}** found.`, ephemeral: true });
    }

    const teams = loadJSON('teams.json');

    if (teams.find(t => t.roleId === role.id)) {
      return interaction.reply({ content: `This role is already registered as a team.`, ephemeral: true });
    }

    teams.push({ name: role.name, roleId: role.id, emoji, division: division.name });
    saveJSON('teams.json', teams);

    await logAction(client, `🏟️ Team **${emoji} ${role.name}** was added to division **${division.name}** by ${interaction.user.tag}.`);
    await interaction.reply({ content: `Team **${emoji} ${role.name}** has been added to division **${division.name}**.` });
  }
};
