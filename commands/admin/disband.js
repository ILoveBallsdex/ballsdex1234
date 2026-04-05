const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { DISBAND_ROLE } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

// ⭐ MongoDB Models
const Teams = require('../../models/teams');
const Staffs = require('../../models/staffs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disband')
    .setDescription('Wipe all players and managers from a team'),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(DISBAND_ROLE)
      ? DISBAND_ROLE
      : [DISBAND_ROLE];

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
        content: 'There are no teams to disband.',
        ephemeral: true
      });
    }

    // --- TEAM DROPDOWN ---
    const menu = new StringSelectMenuBuilder()
      .setCustomId('disband-team-select')
      .setPlaceholder('Select a team to wipe')
      .addOptions(
        teams.map(t => ({
          label: t.name,
          value: t.roleId,
          emoji: t.emoji || undefined
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select the team you want to wipe:',
      components: [row],
      ephemeral: true
    });

    // --- COLLECTOR ---
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'disband-team-select' && i.user.id === interaction.user.id,
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

      await i.update({ content: `Wiping **${team.name}**...`, components: [] });
      await interaction.followUp({ content: 'Processing...', ephemeral: true });

      const guild = interaction.guild;
      const role = guild.roles.cache.get(team.roleId);

      // ⭐ REMOVE TEAM ROLE FROM EVERY MEMBER
      let removedPlayers = 0;
      if (role) {
        for (const [, member] of role.members) {
          try {
            await member.roles.remove(team.roleId);
            removedPlayers++;
          } catch (err) {
            console.error(`Failed to remove team role from ${member.user.tag}:`, err);
          }
        }
      }

      // ⭐ REMOVE ALL STAFF ENTRIES FOR THIS TEAM (MongoDB)
      const removedStaff = await Staffs.countDocuments({ teamRoleId: team.roleId });
      await Staffs.deleteMany({ teamRoleId: team.roleId });

      // --- EMBED LOG ---
      const embed = new EmbedBuilder()
        .setColor('#c0392b')
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ size: 256 })
        })
        .setTitle('Team Wiped')
        .setThumbnail(
          team.emoji && team.emoji.startsWith('<')
            ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
            : guild.iconURL({ size: 256 })
        )
        .addFields(
          { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
          { name: 'Players Removed', value: `**${removedPlayers}**`, inline: true },
          { name: 'Staff Removed', value: `**${removedStaff}**`, inline: true },
          { name: 'Wiped By', value: `${interaction.user.tag}`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await interaction.followUp({
        content: `Team **${team.emoji} ${team.name}** has been wiped. All players and staff removed.`,
        ephemeral: true
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
