const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const { RELEASE_ROLE } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

// ⭐ MongoDB Models
const Staffs = require('../../models/staffs');
const Teams = require('../../models/teams');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Release a player from your team')
    .addUserOption(opt =>
      opt.setName('player')
        .setDescription('Player to release')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(RELEASE_ROLE)
      ? RELEASE_ROLE
      : [RELEASE_ROLE];

    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -------------------------

    // ⭐ Load staff entry for executor
    const staffEntry = await Staffs.findOne({ userId: interaction.user.id });

    if (!staffEntry) {
      return interaction.reply({
        content: 'You are not on any team.',
        ephemeral: true
      });
    }

    // ⭐ Load team from DB
    const team = await Teams.findOne({ roleId: staffEntry.teamRoleId });

    if (!team) {
      return interaction.reply({
        content: 'Your team no longer exists.',
        ephemeral: true
      });
    }

    const player = interaction.options.getUser('player');
    const member = await interaction.guild.members.fetch(player.id);

    // ⭐ Check if player is on this team
    if (!member.roles.cache.has(team.roleId)) {
      return interaction.reply({
        content: `<@${player.id}> is not on **${team.name}**.`,
        ephemeral: true
      });
    }

    // ⭐ BLOCK releasing staff
    const targetStaffEntry = await Staffs.findOne({
      userId: player.id,
      teamRoleId: team.roleId
    });

    if (targetStaffEntry) {
      return interaction.reply({
        content: `Demote <@${player.id}> from their **${targetStaffEntry.position}** role before releasing them.`,
        ephemeral: true
      });
    }

    // ⭐ SAFE TO RELEASE
    await member.roles.remove(team.roleId);

    const guild = interaction.guild;

    // --- EMBED LOG ---
    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Player Released')
      .setThumbnail(
        team.emoji && team.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 })
      )
      .addFields(
        { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
        { name: 'Released Player', value: `<@${player.id}>`, inline: false },
        { name: 'Released By', value: `<@${interaction.user.id}>`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    // User confirmation
    await interaction.reply({
      content: `<@${player.id}> has been released from **${team.name}**.`
    });
  }
};
