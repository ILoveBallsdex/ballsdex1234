const { SlashCommandBuilder } = require('discord.js');
const Divisions = require('../../models/divisions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debugdivisions')
    .setDescription('Show raw division documents'),

  async execute(interaction) {
    const all = await Divisions.find().lean();
    console.log("RAW DIVISIONS >>>", JSON.stringify(all, null, 2));

    await interaction.reply({
      content: "Logged raw divisions to console.",
      ephemeral: true
    });
  }
};
