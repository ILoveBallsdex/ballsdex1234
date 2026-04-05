const { SlashCommandBuilder } = require('discord.js');
const {
  DEMOTE_ROLE,
  ASSISTANT_MANAGER_ROLE,
  MANAGER_ROLE,
  CHAIRMAN_ROLE
} = require('../../utils/permissions');

const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

const HIERARCHY = ['assistant', 'manager', 'chairman'];

function getStaffRoleId(position) {
  switch (position) {
    case 'assistant': return ASSISTANT_MANAGER_ROLE;
    case 'manager': return MANAGER_ROLE;
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

    const guildMember = await interaction.guild.members.fetch(targetUser.id);

    // Must be on the same team
    if (!guildMember.roles.cache.has(executorEntry.teamRoleId)) {
      return interaction.reply({ content: `${targetUser} is not on your team.`, ephemeral: true });
    }

    // Must already be staff
    const targetEntry = staff.find(
      s => s.userId === targetUser.id && s.teamRoleId === executorEntry.teamRoleId
    );

    if (!targetEntry) {
      return interaction.reply({ content: `${targetUser} is not staff on your team.`, ephemeral: true });
    }

    const targetRank = HIERARCHY.indexOf(targetEntry.position);

    // Executor must outrank the target
    if (executorRank <= targetRank) {
      return interaction.reply({ content: 'You cannot demote someone equal to or above your rank.', ephemeral: true });
    }

    // ❗ NEW: Prevent selecting a role higher than the target’s current one
    if (toPosition !== 'none' && toRank >= targetRank) {
      return interaction.reply({
        content: `You can only demote ${targetUser} to a LOWER position.`,
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

    if (toPosition !== 'none' && conflicting) {
      return interaction.reply({
        content: `There is already a **${toPosition}** on this team. Remove them first.`,
        ephemeral: true
      });
    }

    // 🔥 REMOVE OLD STAFF ROLE
    const oldRoleId = getStaffRoleId(targetEntry.position);
    if (oldRoleId) await guildMember.roles.remove(oldRoleId);

    if (toPosition === 'none') {
      // 🔥 REMOVE STAFF ENTRY COMPLETELY
      const index = staff.indexOf(targetEntry);
      staff.splice(index, 1);
      saveJSON('staff.json', staff);

      await logAction(client, `⬇️ ${targetUser.tag} was demoted to **Team Member** in **${executorEntry.teamName}** by ${interaction.user.tag}.`);
      return interaction.reply({ content: `${targetUser} is now a **Team Member** of **${executorEntry.teamName}**.` });
    }

    // 🔥 APPLY NEW STAFF ROLE
    const newRoleId = getStaffRoleId(toPosition);
    if (newRoleId) await guildMember.roles.add(newRoleId);

    // 🔥 UPDATE DATABASE
    targetEntry.position = toPosition;
    saveJSON('staff.json', staff);

    await logAction(client, `⬇️ ${targetUser.tag} was demoted to **${toPosition}** in **${executorEntry.teamName}** by ${interaction.user.tag}.`);
    await interaction.reply({ content: `${targetUser} has been demoted to **${toPosition}** in **${executorEntry.teamName}**.` });
  }
};
