const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const {
  PROMOTE_ROLE,
  ASSISTANT_MANAGER_ROLE,
  MANAGER_ROLE
} = require('../../utils/permissions');

const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

const HIERARCHY = ['assistant', 'manager', 'chairman'];

function getStaffRoleId(position) {
  switch (position) {
    case 'assistant': return ASSISTANT_MANAGER_ROLE;
    case 'manager': return MANAGER_ROLE;
    default: return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a team member to a higher management position')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to promote')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('to')
        .setDescription('Position to promote to')
        .setRequired(true)
        .addChoices(
          { name: 'Assistant Manager', value: 'assistant' },
          { name: 'Manager', value: 'manager' }
        )
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(PROMOTE_ROLE) ? PROMOTE_ROLE : [PROMOTE_ROLE];
    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    // -------------------------

    const targetUser = interaction.options.getUser('user');
    const toPosition = interaction.options.getString('to');

    const staff = loadJSON('staff.json');

    const executorEntry = staff.find(s => s.userId === interaction.user.id);
    if (!executorEntry) {
      return interaction.reply({ content: 'You are not a staff member of any team.', ephemeral: true });
    }

    const executorRank = HIERARCHY.indexOf(executorEntry.position);
    const toRank = HIERARCHY.indexOf(toPosition);

    // Must outrank the position being assigned
    if (executorRank <= toRank) {
      return interaction.reply({ content: 'You cannot assign a position equal to or above your own.', ephemeral: true });
    }

    const guildMember = await interaction.guild.members.fetch(targetUser.id);

    // Must be on the same team
    if (!guildMember.roles.cache.has(executorEntry.teamRoleId)) {
      return interaction.reply({ content: `${targetUser} is not on your team.`, ephemeral: true });
    }

    // Find existing staff entry
    let targetEntry = staff.find(
      s => s.userId === targetUser.id && s.teamRoleId === executorEntry.teamRoleId
    );

    const oldPosition = targetEntry?.position;
    const oldRank = HIERARCHY.indexOf(oldPosition);

    // Prevent promoting to same or lower rank
    if (oldPosition && toRank <= oldRank) {
      return interaction.reply({
        content: `${targetUser} can only be promoted to a HIGHER position.`,
        ephemeral: true
      });
    }

    // Prevent duplicate positions
    const conflicting = staff.find(
      s =>
        s.teamRoleId === executorEntry.teamRoleId &&
        s.position === toPosition &&
        s.userId !== targetUser.id
    );

    if (conflicting) {
      return interaction.reply({
        content: `There is already a **${toPosition}** on this team. Demote them first.`,
        ephemeral: true
      });
    }

    // Create or update staff entry
    if (!targetEntry) {
      targetEntry = {
        userId: targetUser.id,
        teamRoleId: executorEntry.teamRoleId,
        teamName: executorEntry.teamName,
        position: toPosition
      };
      staff.push(targetEntry);
    } else {
      targetEntry.position = toPosition;
    }

    // Apply role changes
    const oldRoleId = getStaffRoleId(oldPosition);
    const newRoleId = getStaffRoleId(toPosition);

    if (oldRoleId) await guildMember.roles.remove(oldRoleId);
    if (newRoleId) await guildMember.roles.add(newRoleId);

    saveJSON('staff.json', staff);

    // --- EMBED LOG ---
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Staff Promotion')
      .setThumbnail(
        executorEntry.emoji && executorEntry.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${executorEntry.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 }) // fallback
      )
      .addFields(
        { name: 'Team', value: `<@&${executorEntry.teamRoleId}>`, inline: false },
        { name: 'Old Position', value: oldPosition ? `**${oldPosition}**` : '*None*', inline: true },
        { name: 'New Position', value: `**${toPosition}**`, inline: true },
        { name: 'Promoted User', value: `${targetUser.tag}`, inline: false },
        { name: 'Promoted By', value: `${interaction.user.tag}`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    await interaction.reply({
      content: `${targetUser} has been promoted to **${toPosition}** in **${executorEntry.teamName}**.`
    });
  }
};
