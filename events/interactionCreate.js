module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Ignore anything that isn't a slash command or select menu
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

    // -----------------------------
    // SLASH COMMAND HANDLER
    // -----------------------------
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const reply = { content: 'An error occurred while executing this command.', ephemeral: true };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    }

    // -----------------------------
    // SELECT MENU HANDLER
    // -----------------------------
    if (interaction.isStringSelectMenu()) {

      // ⭐ DIVISION SELECT HANDLER
      if (interaction.customId === 'select_division') {
        const command = client.commands.get('division');
        if (!command || !command.handleSelect) return;

        try {
          await command.handleSelect(interaction, client);
        } catch (error) {
          console.error('Error handling division select:', error);
          const reply = { content: 'An error occurred.', ephemeral: true };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
      }

      // ⭐ TEAMINFO SELECT HANDLER
      if (interaction.customId === 'teaminfo-select') {
        const command = client.commands.get('teaminfo');
        if (!command || !command.handleSelect) return;

        try {
          await command.handleSelect(interaction, client);
        } catch (error) {
          console.error('Error handling teaminfo select:', error);
          const reply = { content: 'An error occurred.', ephemeral: true };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
      }
    }
  }
};
