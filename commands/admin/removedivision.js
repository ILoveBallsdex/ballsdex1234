const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');

const { REMOVE_DIVISION_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedivision')
    .setDescription('Remove a division'),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
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
    // -------------------------

    const divisions = loadJSON('divisions.json');

    if (!divisions.length) {
      return interaction.reply({
        content: 'There are no divisions to remove.',
        ephemeral: true
      });
    }

    // Build dropdown menu
    const menu = new StringSelectMenuBuilder()
      .setCustomId('remove-division-select')
      .setPlaceholder('Select a division to remove')
      .addOptions(
        divisions.map(div => ({
          label: div.name,
          value: div.name
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Choose the division you want to remove:',
      components: [row],
      ephemeral: true
    });

    // Collector
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'remove-division-select' && i.user.id === interaction.user.id,
      time: 15000
    });

    collector.on('collect', async i => {
      const selectedName = i.values[0];

      // Reload divisions
      const divisions = loadJSON('divisions.json');
      const index = divisions.findIndex(d => d.name === selectedName);

      if (index === -1) {
        return i.update({
          content: `Division **${selectedName}** no longer exists.`,
          components: []
        });
      }

      const [removed] = divisions.splice(index, 1);
      saveJSON('divisions.json', divisions);

      // Remove all teams inside that division
      let teams = loadJSON('teams.json');
      const beforeCount = teams.length;

      teams = teams.filter(t => t.division !== removed.name);
      saveJSON('teams.json', teams);

      const removedTeams = beforeCount - teams.length;

      // --- EMBED LOG ---
      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ size: 256 })
        })
        .setTitle('Division Removed')
        .setThumbnail(
          removed.emoji && removed.emoji.startsWith('<')
            ? `https://cdn.discordapp.com/emojis/${removed.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
            : guild.iconURL({ size: 256 }) // fallback for unicode emoji
        )
        .addFields(
          { name: 'Division', value: `${removed.emoji} **${removed.name}**`, inline: false },
          { name: 'Teams Removed', value: `**${removedTeams}**`, inline: true },
          { name: 'Removed By', value: `${interaction.user.tag}`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await i.update({
        content: `Division **${removed.emoji} ${removed.name}** has been removed.\nRemoved **${removedTeams}** teams from that division.`,
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
