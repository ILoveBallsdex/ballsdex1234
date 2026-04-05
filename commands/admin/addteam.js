const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');


const { ADD_TEAM_ROLE } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

// ⭐ Import your plural-named models
const Divisions = require('../../models/divisions');
const Teams = require('../../models/teams');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addteam')
    .setDescription('Add a team to a division')
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Team role')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('emoji')
        .setDescription('Team emoji')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(ADD_TEAM_ROLE)
      ? ADD_TEAM_ROLE
      : [ADD_TEAM_ROLE];

    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -------------------------

    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');

    // ⭐ Load divisions from MongoDB
    const divisions = await Divisions.find();

    if (!divisions.length) {
      return interaction.reply({
        content: 'No divisions exist yet.',
        ephemeral: true
      });
    }

    // ⭐ Build dropdown menu
    const menu = new StringSelectMenuBuilder()
      .setCustomId('select-division')
      .setPlaceholder('Select a division')
      .addOptions(
        divisions.map(div => ({
          label: div.name,
          value: div.name
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select the division you want to add this team to:',
      components: [row],
      ephemeral: true
    });

    // ⭐ Collector
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'select-division' && i.user.id === interaction.user.id,
      time: 15000
    });

    collector.on('collect', async i => {
      const divisionName = i.values[0];

      // ⭐ Check if team already exists
      const existingTeam = await Teams.findOne({ roleId: role.id });
      if (existingTeam) {
        return i.update({
          content: `This role is already registered as a team.`,
          components: []
        });
      }

      // ⭐ Save team to MongoDB
      await Teams.create({
        name: role.name,
        roleId: role.id,
        emoji,
        division: divisionName
      });

      // --- EMBED LOG ---
      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ size: 256 })
        })
        .setTitle('Team Added')
        .setThumbnail(
          emoji.startsWith('<')
            ? `https://cdn.discordapp.com/emojis/${emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
            : guild.iconURL({ size: 256 })
        )
        .addFields(
          { name: 'Team', value: `${emoji} <@&${role.id}>`, inline: false },
          { name: 'Division', value: `**${divisionName}**`, inline: false },
          { name: 'Added By', value: `${interaction.user.tag}`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      // User confirmation
      await i.update({
        content: `Team **${emoji} ${role.name}** has been added to division **${divisionName}**.`,
        components: []
      });
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({
          content: 'No division selected. Command cancelled.',
          components: []
        });
      }
    });
  }
};
