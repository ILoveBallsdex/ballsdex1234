const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const {
  APPOINT_ROLE,
  ASSISTANT_MANAGER_ROLE,
  MANAGER_ROLE,
  CHAIRMAN_ROLE
} = require('../../utils/permissions');

const { loadJSON, saveJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

function getStaffRoleId(position) {
  switch (position) {
    case 'assistant':
      return ASSISTANT_MANAGER_ROLE;
    case 'manager':
      return MANAGER_ROLE;
    case 'chairman':
      return CHAIRMAN_ROLE;
    default:
      return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appoint')
    .setDescription('Make a user a chairman, manager, or assistant manager!')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to appoint')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('team')
        .setDescription('Team name')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('position')
        .setDescription('Team position')
        .setRequired(true)
        .addChoices(
          { name: 'Chairman', value: 'chairman' },
          { name: 'Manager', value: 'manager' },
          { name: 'Assistant', value: 'assistant' }
        )
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(APPOINT_ROLE) ? APPOINT_ROLE : [APPOINT_ROLE];
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

    const user = interaction.options.getUser('user');
    const teamName = interaction.options.getString('team');
    const position = interaction.options.getString('position');

    const teams = loadJSON('teams.json');
    const staff = loadJSON('staff.json');

    const team = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
    if (!team) {
      return interaction.reply({
        content: `No team named **${teamName}** found.`,
        ephemeral: true
      });
    }

    // Prevent appointing if this position is already filled
    const existing = staff.find(s => s.teamRoleId === team.roleId && s.position === position);
    if (existing) {
      return interaction.reply({
        content: `This team already has a **${position}**. Use \`/sack\` first.`,
        ephemeral: true
      });
    }

    // Prevent appointing someone who is already staff on ANY team
    const alreadyStaff = staff.find(s => s.userId === user.id);
    if (alreadyStaff) {
      return interaction.reply({
        content: `${user} is already staff for **${alreadyStaff.teamName}** as **${alreadyStaff.position}**.`,
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(user.id);

    // Add team role
    await member.roles.add(team.roleId);

    // Add staff hierarchy role
    const staffRoleId = getStaffRoleId(position);
    if (staffRoleId) {
      await member.roles.add(staffRoleId);
    }

    // Save to staff.json
    staff.push({
      userId: user.id,
      teamRoleId: team.roleId,
      teamName: team.name,
      position
    });

    saveJSON('staff.json', staff);

    // --- EMBED LOG ---
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Staff Appointment')
      .setThumbnail(
        team.emoji && team.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 }) // fallback
      )
      .addFields(
        { name: 'Team', value: `<@&${team.roleId}>`, inline: false },
        { name: 'Position', value: `**${position.charAt(0).toUpperCase() + position.slice(1)}**`, inline: false },
        { name: 'Appointed User', value: `${user.tag}`, inline: false },
        { name: 'Appointed By', value: `${interaction.user.tag}`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    // User confirmation
    await interaction.reply({
      content: `${user} has been appointed as **${position}** of **${team.name}**.`
    });
  }
};
