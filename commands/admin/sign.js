const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const { SIGN_ROLE } = require('../../utils/permissions');
const { loadJSON } = require('../../utils/database');
const { logAction } = require('../../utils/logger');

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

    // --- PERMISSION CHECK (supports multiple roles) ---
    const allowedRoles = Array.isArray(SIGN_ROLE) ? SIGN_ROLE : [SIGN_ROLE];
    if (
      allowedRoles.length > 0 &&
      !allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))
    ) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    // --------------------------------------------------

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

    // 🔥 CHECK IF PLAYER IS ALREADY ON ANY TEAM
    const alreadyOnTeam = teams.find(t => member.roles.cache.has(t.roleId));

    if (alreadyOnTeam) {
      return interaction.reply({
        content: `${player} is already on **${alreadyOnTeam.name}**!`,
        ephemeral: true
      });
    }

    // 🔥 SIGN PLAYER
    await member.roles.add(team.roleId);

    await logAction(
      client,
      `✍️ ${player.tag} was signed to **${team.name}** by ${interaction.user.tag}.`
    );

    await interaction.reply({
      content: `${player} has been signed to **${team.name}**.`
    });

    // 🔥 SEND DM TO PLAYER
    const embed = new EmbedBuilder()
      .setTitle(`You have been signed!`)
      .setDescription(`You have been signed to ${team.emoji} **${team.name}**.`)
      .setColor('#00AEEF')
      .setTimestamp();

    const forceBtn = new ButtonBuilder()
      .setCustomId(`force_sign_${team.roleId}_${Date.now()}`)
      .setLabel('Was this a force signing?')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(forceBtn);

    let dmMessage;
    try {
      dmMessage = await player.send({
        embeds: [embed],
        components: [row]
      });
    } catch {
      // Player has DMs closed — ignore
    }

    // 🔥 BUTTON HANDLER (24-hour expiration)
    if (dmMessage) {
      const collector = dmMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 24 * 60 * 60 * 1000 // 24 hours
      });

      collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.user.id !== player.id) {
          return btnInteraction.reply({
            content: 'This button is not for you.',
            ephemeral: true
          });
        }

        // Remove the team role
        await member.roles.remove(team.roleId);

        await btnInteraction.reply({
          content: `Your signing to **${team.name}** has been revoked.`,
          ephemeral: true
        });

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
        // Disable button after timeout
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
