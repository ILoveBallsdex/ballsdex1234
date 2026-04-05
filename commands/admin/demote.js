const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const {
  DEMOTE_ROLE,
  ASSISTANT_MANAGER_ROLE,
  MANAGER_ROLE,
  CHAIRMAN_ROLE
} = require('../../utils/permissions');

const { logAction } = require('../../utils/logger');
const Staffs = require('../../models/staffs');
const Teams = require('../../models/teams'); // ⭐ Needed to fetch team emoji

const HIERARCHY = ['assistant', 'manager', 'chairman'];

// ⭐ Position → Role ID mapping
function getStaffRoleId(position) {
  switch (position) {
    case 'assistant': return '1374495166651437169';
    case 'manager': return '1374495160632610918';
    case 'chairman': return CHAIRMAN_ROLE;
    default: return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote a person to a lower position')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to demote')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('to')
        .setDescription('Position to demote to')
        .setRequired(true)
        .addChoices(
          { name: 'Manager', value: 'manager' },
          { name: 'Assistant Manager', value: 'assistant' },
          { name: 'Normal Team Member', value: 'none' }
        )
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(DEMOTE_ROLE) ? DEMOTE_ROLE : [DEMOTE_ROLE];
    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const toPosition = interaction.options.getString('to');

    // ⭐ Load executor staff entry
    const executorEntry = await Staffs.findOne({ userId: interaction.user.id });
    if (!executorEntry) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    // ⭐ Load team to get emoji
    const team = await Teams.findOne({ roleId: executorEntry.teamRoleId });

    const executorRank = HIERARCHY.indexOf(executorEntry.position);
    const toRank = HIERARCHY.indexOf(toPosition);

    const guildMember = await interaction.guild.members.fetch(targetUser.id);

    // ⭐ Must be on the same team
    if (!guildMember.roles.cache.has(executorEntry.teamRoleId)) {
      return interaction.reply({ content: `<@${targetUser.id}> is not on your team.`, ephemeral: true });
    }

    // ⭐ Must already be staff
    const targetEntry = await Staffs.findOne({
      userId: targetUser.id,
      teamRoleId: executorEntry.teamRoleId
    });

    if (!targetEntry) {
      return interaction.reply({ content: `<@${targetUser.id}> is not in a management position on your team.`, ephemeral: true });
    }

    const targetRank = HIERARCHY.indexOf(targetEntry.position);

    // ⭐ Executor must outrank the target
    if (executorRank <= targetRank) {
      return interaction.reply({ content: 'You cannot demote someone equal to or above your rank.', ephemeral: true });
    }

    // ⭐ Prevent selecting a role higher than the target’s current one
    if (toPosition !== 'none' && toRank >= targetRank) {
      return interaction.reply({
        content: `You can only demote <@${targetUser.id}> to a LOWER position.`,
        ephemeral: true
      });
    }

    // ⭐ Prevent duplicate positions
    if (toPosition !== 'none') {
      const conflicting = await Staffs.findOne({
        teamRoleId: executorEntry.teamRoleId,
        position: toPosition,
        userId: { $ne: targetUser.id }
      });

      if (conflicting) {
        return interaction.reply({
          content: `There is already a **${toPosition}** on this team. Remove them first.`,
          ephemeral: true
        });
      }
    }

    // 🔥 REMOVE OLD STAFF ROLE
    const oldRoleId = getStaffRoleId(targetEntry.position);
    if (oldRoleId) await guildMember.roles.remove(oldRoleId);

    const oldPosition = targetEntry.position;
    const teamName = executorEntry.teamName;
    const teamRoleId = executorEntry.teamRoleId;

    const guild = interaction.guild;

    // ⭐ TEAM LOGO TOP-RIGHT (corrected)
    const teamThumbnail = team?.emoji && team.emoji.startsWith('<')
      ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
      : guild.iconURL({ size: 256 });

    // ⭐ If demoting to normal member
    if (toPosition === 'none') {
      await Staffs.deleteOne({ _id: targetEntry._id });

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setAuthor({
          name: guild.name, // league logo top-left
          iconURL: guild.iconURL({ size: 256 })
        })
        .setTitle('Team Demotion')
        .setThumbnail(teamThumbnail) // ⭐ team logo top-right
        .addFields(
          { name: 'Team', value: `${team.emoji} <@&${teamRoleId}>`, inline: false },
          { name: 'Old Position', value: oldRoleId ? `<@&${oldRoleId}>` : '*None*', inline: true },
          { name: 'New Position', value: `Team Player`, inline: true },
          { name: 'Demoted User', value: `<@${targetUser.id}>`, inline: false },
          { name: 'Demoted By', value: `<@${interaction.user.id}>`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      return interaction.reply({
        content: `<@${targetUser.id}> is now a **Team Player** of **${teamName}**.`
      });
    }

    // 🔥 APPLY NEW STAFF ROLE
    const newRoleId = getStaffRoleId(toPosition);
    if (newRoleId) await guildMember.roles.add(newRoleId);

    // 🔥 UPDATE DATABASE
    targetEntry.position = toPosition;
    await targetEntry.save();

    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setAuthor({
        name: guild.name, // league logo top-left
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Team Demotion')
      .setThumbnail(teamThumbnail) // ⭐ team logo top-right
      .addFields(
        { name: 'Team', value: `${team.emoji} <@&${teamRoleId}>`, inline: false },
        { name: 'Old Position', value: `<@&${oldRoleId}>`, inline: true },
        { name: 'New Position', value: `<@&${newRoleId}>`, inline: true },
        { name: 'Demoted User', value: `<@${targetUser.id}>`, inline: false },
        { name: 'Demoted By', value: `<@${interaction.user.id}>`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    await interaction.reply({
      content: `<@${targetUser.id}> has been demoted to <@&${newRoleId}> in **${teamName}**.`
    });
  }
};
