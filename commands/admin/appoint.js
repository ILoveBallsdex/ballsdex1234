const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const {
  APPOINT_ROLE,
  ASSISTANT_MANAGER_ROLE,
  MANAGER_ROLE,
  CHAIRMAN_ROLE
} = require('../../utils/permissions');

const { logAction } = require('../../utils/logger');

// ⭐ MongoDB models
const Teams = require('../../models/teams');
const Staffs = require('../../models/staffs');

// ⭐ Position → Role ID
function getStaffRoleId(position) {
  switch (position) {
    case 'assistant': return ASSISTANT_MANAGER_ROLE;
    case 'manager': return MANAGER_ROLE;
    case 'chairman': return CHAIRMAN_ROLE;
    default: return null;
  }
}

// ⭐ Pretty names
function pretty(position) {
  switch (position) {
    case 'assistant': return 'Assistant Manager';
    case 'manager': return 'Manager';
    case 'chairman': return 'Chairman';
    default: return 'Unknown';
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
      opt.setName('position')
        .setDescription('Team position')
        .setRequired(true)
        .addChoices(
          { name: 'Chairman', value: 'chairman' },
          { name: 'Manager', value: 'manager' },
          { name: 'Assistant Manager', value: 'assistant' }
        )
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(APPOINT_ROLE) ? APPOINT_ROLE : [APPOINT_ROLE];
    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -------------------------

    const user = interaction.options.getUser('user');
    const position = interaction.options.getString('position');

    // ⭐ Load teams
    const teams = await Teams.find();
    if (!teams.length) {
      return interaction.reply({
        content: 'There are no teams to appoint staff to.',
        ephemeral: true
      });
    }

    // --- TEAM DROPDOWN ---
    const menu = new StringSelectMenuBuilder()
      .setCustomId('appoint-team-select')
      .setPlaceholder('Select a team')
      .addOptions(
        teams.map(t => ({
          label: t.name,
          value: t.roleId,
          emoji: t.emoji || undefined
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select the team you want to appoint this user to:',
      components: [row],
      ephemeral: true
    });

    // --- COLLECTOR ---
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'appoint-team-select' && i.user.id === interaction.user.id,
      time: 15000
    });

    collector.on('collect', async i => {
      const teamRoleId = i.values[0];
      const team = await Teams.findOne({ roleId: teamRoleId });

      if (!team) {
        return i.update({
          content: 'This team no longer exists.',
          components: []
        });
      }

      // ⭐ Check if user is on any team
      const member = await interaction.guild.members.fetch(user.id);
      const userTeam = teams.find(t => member.roles.cache.has(t.roleId));

      // ⭐ Must be on THIS team OR no team
      if (userTeam && userTeam.roleId !== team.roleId) {
        return i.update({
          content: `<@${user.id}> is already on **${userTeam.name}**, so they cannot be appointed to **${team.name}**.`,
          components: []
        });
      }

      // ⭐ Prevent duplicate position
      const existing = await Staffs.findOne({
        teamRoleId: team.roleId,
        position
      });

      if (existing) {
        return i.update({
          content: `This team already has a **${pretty(position)}**. Use /sack first.`,
          components: []
        });
      }

      // ⭐ Prevent appointing someone who is already staff anywhere
      const alreadyStaff = await Staffs.findOne({ userId: user.id });
      if (alreadyStaff) {
        return i.update({
          content: `<@${user.id}> is already staff for **${alreadyStaff.teamName}** as **${pretty(alreadyStaff.position)}**.`,
          components: []
        });
      }

      // ⭐ Add team role
      if (!member.roles.cache.has(team.roleId)) {
        await member.roles.add(team.roleId);
      }

      // ⭐ Add staff hierarchy role
      const staffRoleId = getStaffRoleId(position);
      if (staffRoleId) {
        await member.roles.add(staffRoleId);
      }

      // ⭐ Save to DB
      await Staffs.create({
        userId: user.id,
        teamRoleId: team.roleId,
        teamName: team.name,
        position
      });

      const guild = interaction.guild;

      // --- EMBED LOG ---
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
            : guild.iconURL({ size: 256 })
        )
        .addFields(
          { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
          { name: 'Position', value: `<@&${staffRoleId}> (${pretty(position)})`, inline: false },
          { name: 'Appointed User', value: `<@${user.id}>`, inline: false },
          { name: 'Appointed By', value: `<@${interaction.user.id}>`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await i.update({
        content: `<@${user.id}> has been appointed as **${pretty(position)}** of **${team.name}**.`,
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
