module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

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

    if (interaction.isStringSelectMenu()) {
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
    }
  }
};
