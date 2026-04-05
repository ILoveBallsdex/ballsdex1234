const { SlashCommandBuilder } = require('discord.js');
const { REMOVE_DIVISION_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedivision')
    .setDescription('Remove a division by name')
    .addStringOption(opt => opt.setName('name').setDescription('Division name').setRequired(true)),

  async execute(interaction, client) {

    // --- FIXED PERMISSION CHECK (supports single or multiple role IDs) ---
    const allowedRoles = Array.isArray(REMOVE_DIVISION_ROLE)
      ? REMOVE_DIVISION_ROLE
      : [REMOVE_DIVISION_ROLE];

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
    const divisions = loadJSON('divisions.json');
    const index = divisions.findIndex(d => d.name.toLowerCase() === name.toLowerCase());

    if (index === -1) {
      return interaction.reply({ content: `No division named **${name}** found.`, ephemeral: true });
    }

    const [removed] = divisions.splice(index, 1);
    saveJSON('divisions.json', divisions);

    await logAction(client, `🗑️ Division **${removed.emoji} ${removed.name}** was removed by ${interaction.user.tag}.`);
    await interaction.reply({ content: `Division **${removed.emoji} ${removed.name}** has been removed.` });
  }
};
