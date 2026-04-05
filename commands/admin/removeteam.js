const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { REMOVE_TEAM_ROLE } = require('../../utils/permissions');
const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeteam')
    .setDescription('Remove a team'),

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

    const teams = loadJSON('teams.json');

    if (!teams.length) {
      return interaction.reply({
        content: 'There are no teams to remove.',
        ephemeral: true
      });
    }

    // --- TEAM DROPDOWN ---
    const menu = new StringSelectMenuBuilder()
      .setCustomId('remove-team-select')
      .setPlaceholder('Select a team to remove')
      .addOptions(
        teams.map(t => ({
          label: t.name,
          value: t.roleId,
          emoji: t.emoji || undefined
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Choose the team you want to remove:',
      components: [row],
      ephemeral: true
    });

    // --- COLLECTOR ---
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'remove-team-select' && i.user.id === interaction.user.id,
      time: 15000
    });

    collector.on('collect', async i => {
      const teamRoleId = i.values[0];
      const teams = loadJSON('teams.json');
      const index = teams.findIndex(t => t.roleId === teamRoleId);

      if (index === -1) {
        return i.update({
          content: 'This team no longer exists.',
          components: []
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
            : guild.iconURL({ size: 256 })
        )
        .addFields(
          { name: 'Team', value: `${removed.emoji} **${removed.name}**`, inline: false },
          { name: 'Staff Removed', value: `**${removedStaff}**`, inline: true },
          { name: 'Removed By', value: `${interaction.user.tag}`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await i.update({
        content: `Team **${removed.emoji} ${removed.name}** has been removed.`,
        components: []
      });
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({
          content: 'No team selected. Command cancelled.',
          components: []
        });
      }
    });
  }
};
