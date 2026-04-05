const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const { CREATE_DIVISION_ROLE } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

// ⭐ Import MongoDB model
const Divisions = require('../../models/divisions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createdivision')
    .setDescription('Create a new division')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Division name')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('emoji')
        .setDescription('Division emoji')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(CREATE_DIVISION_ROLE)
      ? CREATE_DIVISION_ROLE
      : [CREATE_DIVISION_ROLE];

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

    const name = interaction.options.getString('name');
    const emoji = interaction.options.getString('emoji');

    // ⭐ Check if division already exists
    const existing = await Divisions.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existing) {
      return interaction.reply({
        content: `A division named **${name}** already exists.`,
        ephemeral: true
      });
    }

    // ⭐ Save division to MongoDB
    await Divisions.create({ name, emoji });

    // --- EMBED LOG ---
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Division Created')
      .setThumbnail(
        emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 })
      )
      .addFields(
        { name: 'Division Name', value: `**${name}**`, inline: false },
        { name: 'Emoji', value: `${emoji}`, inline: false },
        { name: 'Created By', value: `${interaction.user.tag}`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [embed] });

    // User confirmation
    await interaction.reply({
      content: `Division **${emoji} ${name}** has been created.`
    });
  }
};
