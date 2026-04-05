const { SlashCommandBuilder } = require('discord.js');
const Divisions = require('../../models/divisions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debugdivisions')
    .setDescription('Show raw division documents'),

  async execute(interaction) {
    const all = await Divisions.find().lean();

    console.log("RAW DIVISIONS >>>");
    all.forEach((doc, i) => {
      console.log(`--- DOCUMENT ${i} ---`);
      for (const key of Object.keys(doc)) {
        console.log(`KEY: [${key}]  VALUE: [${doc[key]}]`);
      }
    });

    await interaction.reply({
      content: "Logged raw divisions to console.",
      ephemeral: true
    });
  }
};
