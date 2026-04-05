const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { ADD_TEAM_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addteam')
    .setDescription('Add a team to a division')
    .addRoleOption(opt => opt.setName('role').setDescription('Team role').setRequired(true))
    .addStringOption(opt => opt.setName('emoji').setDescription('Team emoji').setRequired(true)),

  async execute(interaction, client) {

    // --- FIXED PERMISSION CHECK ---
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
    // ------------------------------

    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');

    const divisions = loadJSON('divisions.json');

    if (!divisions.length) {
      return interaction.reply({
        content: 'No divisions exist yet.',
        ephemeral: true
      });
    }

    // Build dropdown options
    const menu = new StringSelectMenuBuilder()
      .setCustomId('select-division')
      .setPlaceholder('Select a division')
      .addOptions(
        divisions.map(div => ({
          label: div.name,
          value: div.name
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select the division you want to add this team to:',
      components: [row],
      ephemeral: true
    });

    // Collector for dropdown selection
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'select-division' && i.user.id === interaction.user.id,
      time: 15000
    });

    collector.on('collect', async i => {
      const divisionName = i.values[0];
      const division = divisions.find(d => d.name === divisionName);

      const teams = loadJSON('teams.json');

      if (teams.find(t => t.roleId === role.id)) {
        return i.update({
          content: `This role is already registered as a team.`,
          components: []
        });
      }

      teams.push({
        name: role.name,
        roleId: role.id,
        emoji,
        division: division.name
      });

      saveJSON('teams.json', teams);

      await logAction(
        client,
        `🏟️ Team **${emoji} ${role.name}** was added to division **${division.name}** by ${interaction.user.tag}.`
      );

      await i.update({
        content: `Team **${emoji} ${role.name}** has been added to division **${division.name}**.`,
        components: []
      });
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({
          content: 'No division selected. Command cancelled.',
          components: []
        });
      }
    });
  }
};
