const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
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

      const guild = interaction.guild;
      const role = guild.roles.cache.get(team.roleId);

      // ⭐ TRACK REMOVED PLAYERS
      const removedPlayers = [];

      if (role) {
        for (const [, member] of role.members) {
          try {
            await member.roles.remove(team.roleId);
            removedPlayers.push(member);
          } catch (err) {
            console.error(`Failed to remove team role from ${member.user.tag}:`, err);
          }
        }
      }

      // ⭐ TRACK REMOVED STAFF
      const staffEntries = await Staffs.find({ teamRoleId });
      const removedStaff = staffEntries.length;

      await Staffs.deleteMany({ teamRoleId });

      // ⭐ Remove team from DB
      await Teams.deleteOne({ roleId: teamRoleId });

      // ⭐ Build player list
      const playerList = removedPlayers.length
        ? removedPlayers.map(m => `• <@${m.id}> — removed from **${team.name}**`).join('\n')
        : '*No players had the role.*';

      // ⭐ Build staff list
      const staffList = removedStaff
        ? staffEntries.map(s => `• <@${s.userId}> — removed from **${s.position}**`).join('\n')
        : '*No staff positions existed.*';

      // --- EMBED LOG ---
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
          { name: 'Players Removed', value: `${removedPlayers.length}`, inline: true },
          { name: 'Staff Removed', value: `${removedStaff}`, inline: true },
          { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: false },
          { name: 'Players Affected', value: playerList, inline: false },
          { name: 'Staff Affected', value: staffList, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await i.update({
        content:
          `Team **${team.emoji} ${team.name}** has been removed.\n` +
          `Removed **${removedPlayers.length}** players and **${removedStaff}** staff.\n` +
          `Removed by <@${interaction.user.id}>.`,
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
