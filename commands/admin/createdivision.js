const { SlashCommandBuilder } = require('discord.js');
const { CREATE_DIVISION_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createdivision')
    .setDescription('Create a new division')
    .addStringOption(opt => opt.setName('name').setDescription('Division name').setRequired(true))
    .addStringOption(opt => opt.setName('emoji').setDescription('Division emoji').setRequired(true)),

  async execute(interaction, client) {

    // --- FIXED PERMISSION CHECK (supports single or multiple role IDs) ---
    const allowedRoles = Array.isArray(CREATE_DIVISION_ROLE)
      ? CREATE_DIVISION_ROLE
      : [CREATE_DIVISION_ROLE];

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
    const emoji = interaction.options.getString('emoji');

    const divisions = loadJSON('divisions.json');

    if (divisions.find(d => d.name.toLowerCase() === name.toLowerCase())) {
      return interaction.reply({ content: `A division named **${name}** already exists.`, ephemeral: true });
    }

    divisions.push({ name, emoji });
    saveJSON('divisions.json', divisions);

    await logAction(client, `📁 Division **${emoji} ${name}** was created by ${interaction.user.tag}.`);
    await interaction.reply({ content: `Division **${emoji} ${name}** has been created.` });
  }
};
