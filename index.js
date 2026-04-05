require('dotenv').config();
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { keepAlive } = require('./keep_alive');
const connectMongo = require('./utils/mongo');

keepAlive();


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();
const commandsData = [];

// ⭐ LOAD COMMANDS FIRST (loads models BEFORE connecting)
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));

// ⭐ LOAD EVENTS
const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ⭐ CONNECT TO MONGO AFTER MODELS ARE LOADED
connectMongo();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('Registering slash commands globally...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandsData }
    );
    console.log('Slash commands registered successfully.');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
});

console.log("TOKEN VALUE:", process.env.TOKEN);
client.login(process.env.TOKEN);
