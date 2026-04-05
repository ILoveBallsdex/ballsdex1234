const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');

const { REMOVE_DIVISION_ROLE } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');
const Divisions = require('../../models/divisions');
const Teams = require('../../models/teams');

// Escape regex special characters so "GFC | EPL" is treated literally
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Normalize Unicode (removes zero‑width chars, weird spacing, etc.)
function normalizeName(str) {
  return str
    .normalize("NFKD")
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero‑width chars
    .replace(/\s+/g, ' ')                 // collapse spaces
    .trim();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedivision')
    .setDescription('Remove a division'),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(REMOVE_DIVISION_ROLE)
      ? REMOVE_DIVISION_ROLE
      : [REMOVE_DIVISION_ROLE];

    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: 64
      });
    }
    // -------------------------

    // Load divisions
    const divisions = await Divisions.find();

    if (!divisions.length) {
      return interaction.reply({
        content: 'There are no divisions to remove.',
        flags: 64
      });
    }

    // Dropdown menu
    const menu = new StringSelectMenuBuilder()
      .setCustomId('remove-division-select')
      .setPlaceholder('Select a division to remove')
      .addOptions(
        divisions.map(div => ({
          label: div.name,
          value: div.name
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Choose the division you want to remove:',
      components: [row],
      flags: 64
    });

    // Collector
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'remove-division-select' && i.user.id === interaction.user.id,
      time: 15000
    });

    collector.on('collect', async i => {
      // Normalize + escape the selected name
      const rawName = i.values[0];
      const normalizedName = normalizeName(rawName);
      const safeName = escapeRegex(normalizedName);

      // Reload division safely
      const division = await Divisions.findOne({
        name: { $regex: new RegExp(`^${safeName}$`, 'i') }
      });

      if (!division) {
        return i.update({
          content: `Division **${rawName}** no longer exists.`,
          components: []
        });
      }

      // Delete division
      await Divisions.deleteOne({
        name: { $regex: new RegExp(`^${safeName}$`, 'i') }
      });

      // Delete teams in that division
      const removedTeams = await Teams.countDocuments({ division: division.name });
      await Teams.deleteMany({ division: division.name });

      // Logging embed
      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ size: 256 })
        })
        .setTitle('Division Removed')
        .setThumbnail(
          division.emoji && division.emoji.startsWith('<')
            ? `https://cdn.discordapp.com/emojis/${division.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
            : guild.iconURL({ size: 256 })
        )
        .addFields(
          { name: 'Division', value: `${division.emoji} **${division.name}**`, inline: false },
          { name: 'Teams Removed', value: `**${removedTeams}**`, inline: true },
          { name: 'Removed By', value: `${interaction.user.tag}`, inline: false }
        )
        .setTimestamp();

      await logAction(client, { embeds: [embed] });

      await i.update({
        content: `Division **${division.emoji} ${division.name}** has been removed.\nRemoved **${removedTeams}** teams from that division.`,
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
