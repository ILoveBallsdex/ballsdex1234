const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const { SIGN_ROLE } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

// ⭐ MongoDB Models
const Staffs = require('../../models/staffs');
const Teams = require('../../models/teams');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sign')
    .setDescription('Sign a player to your team')
    .addUserOption(opt =>
      opt.setName('player')
        .setDescription('Player to sign')
        .setRequired(true)
    ),

  async execute(interaction, client) {

    // --- PERMISSION CHECK ---
    const allowedRoles = Array.isArray(SIGN_ROLE) ? SIGN_ROLE : [SIGN_ROLE];
    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // -------------------------

    // ⭐ Load staff entry for executor
    const staffEntry = await Staffs.findOne({ userId: interaction.user.id });

    if (!staffEntry) {
      return interaction.reply({
        content: 'You are not assigned to any team.',
        ephemeral: true
      });
    }

    // ⭐ Load team from DB
    const team = await Teams.findOne({ roleId: staffEntry.teamRoleId });

    if (!team) {
      return interaction.reply({
        content: 'Your team no longer exists.',
        ephemeral: true
      });
    }

    const player = interaction.options.getUser('player');
    const member = await interaction.guild.members.fetch(player.id);

    // ⭐ Check if player is already on ANY team
    const allTeams = await Teams.find();
    const alreadyOnTeam = allTeams.find(t => member.roles.cache.has(t.roleId));

    if (alreadyOnTeam) {
      return interaction.reply({
        content: `<@${player.id}> is already on **${alreadyOnTeam.name}**!`,
        ephemeral: true
      });
    }

    // ⭐ SIGN PLAYER
    await member.roles.add(team.roleId);

    const guild = interaction.guild;

    // --- LOG EMBED (PING USERS) ---
    const logEmbed = new EmbedBuilder()
      .setColor('#00AEEF')
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 256 })
      })
      .setTitle('Player Signed')
      .setThumbnail(
        team.emoji && team.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 })
      )
      .addFields(
        { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
        { name: 'Signed Player', value: `<@${player.id}>`, inline: false },
        { name: 'Signed By', value: `<@${interaction.user.id}>`, inline: false }
      )
      .setTimestamp();

    await logAction(client, { embeds: [logEmbed] });

    await interaction.reply({
      content: `<@${player.id}> has been signed to **${team.name}**.`
    });

    // --- DM TO PLAYER ---
    const dmEmbed = new EmbedBuilder()
      .setColor('#00AEEF')
      .setAuthor({
        name: 'League Notification',
        iconURL: guild.iconURL({ size: 256 }) // league logo top-left
      })
      .setTitle('You Have Been Signed!')
      .setThumbnail(
        team.emoji && team.emoji.startsWith('<')
          ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
          : guild.iconURL({ size: 256 }) // fallback
      )
      .setDescription(
        `You have been signed to ${team.emoji} **${team.name}** in the **${guild.name} League**.`
      )
      .setTimestamp();

    const forceBtn = new ButtonBuilder()
      .setCustomId(`force_sign_${team.roleId}_${Date.now()}`)
      .setLabel('I was Forced to Sign for this Team')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(forceBtn);

    let dmMessage;
    try {
      dmMessage = await player.send({
        embeds: [dmEmbed],
        components: [row]
      });
    } catch {
      // Player has DMs closed — ignore
    }

    // --- BUTTON HANDLER (24 hours) ---
    if (dmMessage) {
      const collector = dmMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 24 * 60 * 60 * 1000
      });

      collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.user.id !== player.id) {
          return btnInteraction.reply({
            content: 'This button is not for you.',
            ephemeral: true
          });
        }

        // ⭐ Remove the team role
        await member.roles.remove(team.roleId);

        await btnInteraction.reply({
          content: `Your signing to **${team.name}** has been revoked.`,
          ephemeral: true
        });

        // ⭐ LOG FORCED SIGNING
        const forcedEmbed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setAuthor({
            name: guild.name,
            iconURL: guild.iconURL({ size: 256 })
          })
          .setTitle('Forced Signing Reported')
          .setThumbnail(
            team.emoji && team.emoji.startsWith('<')
              ? `https://cdn.discordapp.com/emojis/${team.emoji.replace(/\D/g, '')}.png?size=256&quality=lossless`
              : guild.iconURL({ size: 256 })
          )
          .addFields(
            { name: 'Team', value: `${team.emoji} <@&${team.roleId}>`, inline: false },
            { name: 'Player Removed', value: `<@${player.id}>`, inline: false },
            { name: 'Originally Signed By', value: `<@${interaction.user.id}>`, inline: false },
            { name: 'Reason', value: '**Player reported forced signing**', inline: false }
          )
          .setTimestamp();

        await logAction(client, { embeds: [forcedEmbed] });

        // Disable button
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(forceBtn).setDisabled(true)
        );

        await dmMessage.edit({
          components: [disabledRow]
        });

        collector.stop('clicked');
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(forceBtn).setDisabled(true)
        );

        await dmMessage.edit({
          components: [disabledRow]
        });
      });
    }
  }
};
