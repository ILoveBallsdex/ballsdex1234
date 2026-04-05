const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const {
  SACK_ROLE,
  ASSISTANT_MANAGER_ROLE,
  MANAGER_ROLE,
  CHAIRMAN_ROLE
} = require('../../utils/permissions');

const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

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
    .setName('sack')
    .setDescription('Removes a user’s management position + releases them from their team')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to sack')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(SACK_ROLE) ? SACK_ROLE : [SACK_ROLE];
    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -------------------------

    const user = interaction.options.getUser('user');

    const teams = loadJSON('teams.json');
    const staff = loadJSON('staff.json');

    if (!teams.length) {
      return interaction.reply({
        content: 'There are no teams to sack staff from.',
        ephemeral: true
      });
    }

    // --- TEAM DROPDOWN ---
    const menu = new StringSelectMenuBuilder()
      .setCustomId('sack-team-select')
      .setPlaceholder('Select the team this user is staff for')
      .addOptions(
        teams.map(t => ({
          label: t.name,
          value: t.roleId,
          emoji: t.emoji || undefined
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select the team you want to sack this user from:',
      components: [row],
      ephemeral: true
    });

    // --- COLLECTOR ---
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'sack-team-select' && i.user.id === interaction.user.id,
      time: 15000
    });

    collector.on('collect', async i => {
      const teamRoleId = i.values[0];
      const team = teams.find(t => t.roleId === teamRoleId);

      if (!team) {
        return i.update({
          content: 'This team no longer exists.',
          components: []
        });
      }

      // Find staff entry
      const staffIndex = staff.findIndex(
        s => s.userId === user.id && s.teamRoleId === team.roleId
      );

      if (staffIndex === -1) {
        return i.update({
          content: `${user} is not a staff member of **${team.name}**.`,
          components: []
        });
      }

      const removed = staff[staffIndex];

      // Remove from staff.json
      staff.splice(staffIndex, 1);
      saveJSON('staff.json', staff);

      // Fetch guild member
      const member = await interaction.guild.members.fetch(user.id);

      // Remove team role
      if (member.roles.cache.has(team.roleId)) {
        await member.roles.remove(team.roleId);
      }

      // Remove staff hierarchy role
      const staffRoleId = getStaffRoleId(removed.position);
      if (staffRoleId && member.roles.cache.has(staffRoleId)) {
        await member.roles.remove(staffRoleId);
      }

      // --- EMBED LOG ---
      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ size: 256 })
        })
        .setTitle('Staff Member Sacked')
        .setThumbnail(
          team.emoji && team.emoji.startsWith('<')
            ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
            : guild.iconURL({ size: 256 })
        )
        .addFields(
          { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
          { name: 'Position Removed', value: `**${removed.position}**`, inline: true },
          { name: 'User Sacked', value: `${user.tag}`, inline: false },
          { name: 'Sacked By', value: `${interaction.user.tag}`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await i.update({
        content: `${user} has been sacked from **${team.name}** (was **${removed.position}**).`,
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
