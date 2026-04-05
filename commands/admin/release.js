const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

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

    // --- PERMISSION CHECK ---
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
    // -------------------------

    const staff = loadJSON('staff.json');
    const staffEntry = staff.find(s => s.userId === interaction.user.id);

    if (!staffEntry) {
      return interaction.reply({
        content: 'You are not on any team.',
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

    // BLOCK releasing staff
    const targetStaffEntry = staff.find(
      s => s.userId === player.id && s.teamRoleId === team.roleId
    );

    if (targetStaffEntry) {
      return interaction.reply({
        content: `Demote ${player} from their **${targetStaffEntry.position}** role in order to release them.`,
        ephemeral: true
      });
    }

    // SAFE TO RELEASE
    await member.roles.remove(team.roleId);

    // --- EMBED LOG ---
    const guild = interaction.guild;

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
          : guild.iconURL({ size: 256 }) // fallback for unicode emoji
      )
      .addFields(
        { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
        { name: 'Released Player', value: `${player.tag}`, inline: false },
        { name: 'Released By', value: `${interaction.user.tag}`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    await interaction.reply({
      content: `${player} has been released from **${team.name}**.`
    });
  }
};
