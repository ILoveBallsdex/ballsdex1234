const { SlashCommandBuilder } = require('discord.js');
const { RELEASE_ROLE } = require('../../utils/permissions');
const { loadJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

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

    // --- PERMISSION CHECK (supports single or multiple role IDs) ---
    const allowedRoles = Array.isArray(RELEASE_ROLE)
      ? RELEASE_ROLE
      : [RELEASE_ROLE];

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))
    ) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -----------------------------------------------------------------

    const staff = loadJSON('staff.json');
    const staffEntry = staff.find(s => s.userId === interaction.user.id);

    if (!staffEntry) {
      return interaction.reply({
        content: 'You are not assigned to any team.',
        ephemeral: true
      });
    }

    const teams = loadJSON('teams.json');
    const team = teams.find(t => t.roleId === staffEntry.teamRoleId);

    if (!team) {
      return interaction.reply({
        content: 'Your team no longer exists.',
        ephemeral: true
      });
    }

    const player = interaction.options.getUser('player');
    const member = await interaction.guild.members.fetch(player.id);

    // Check if player is on this team
    if (!member.roles.cache.has(team.roleId)) {
      return interaction.reply({
        content: `${player} is not on **${team.name}**.`,
        ephemeral: true
      });
    }

    // 🔒 BLOCK RELEASING STAFF (assistant / manager / chairman)
    const targetStaffEntry = staff.find(
      s => s.userId === player.id && s.teamRoleId === team.roleId
    );

    if (targetStaffEntry) {
      return interaction.reply({
        content: `Demote ${player} from their **${targetStaffEntry.position}** role in order to release them.`,
        ephemeral: true
      });
    }

    // ✅ SAFE TO RELEASE (not staff)
    await member.roles.remove(team.roleId);

    await logAction(
      client,
      `📤 ${player.tag} was released from **${team.name}** by ${interaction.user.tag}.`
    );

    await interaction.reply({
      content: `${player} has been released from **${team.name}**.`
    });
  }
};
