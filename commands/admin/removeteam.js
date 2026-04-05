const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { REMOVE_TEAM_ROLE } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

// ⭐ MongoDB Models
const Teams = require('../../models/teams');
const Staffs = require('../../models/staffs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeteam')
    .setDescription('Remove a team'),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(REMOVE_TEAM_ROLE)
      ? REMOVE_TEAM_ROLE
      : [REMOVE_TEAM_ROLE];

    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -------------------------

    // ⭐ Load teams from MongoDB
    const teams = await Teams.find();

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

      // ⭐ Fetch team from DB
      const team = await Teams.findOne({ roleId: teamRoleId });

      if (!team) {
        return i.update({
          content: 'This team no longer exists.',
          components: []
        });
      }

      // ⭐ Remove team from DB
      await Teams.deleteOne({ roleId: teamRoleId });

      // ⭐ Remove all staff entries for this team
      const removedStaff = await Staffs.countDocuments({ teamRoleId });
      await Staffs.deleteMany({ teamRoleId });

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
          team.emoji && team.emoji.startsWith('<')
            ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
            : guild.iconURL({ size: 256 })
        )
        .addFields(
          { name: 'Team', value: `${team.emoji} **${team.name}**`, inline: false },
          { name: 'Staff Removed', value: `**${removedStaff}**`, inline: true },
          { name: 'Removed By', value: `${interaction.user.tag}`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await i.update({
        content: `Team **${team.emoji} ${team.name}** has been removed.`,
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
