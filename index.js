require('dotenv').config();

const fs = require('fs');
const { Client, GatewayIntentBits, Collection, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const { REST, Routes } = require('discord.js');
const { movieTrailers, audibleLinks } = require('./lib/stateManager');

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    console.log(`Loading command: ${command.data.name}`); 
    client.commands.set(command.data.name, command);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommandsForAllGuilds() {
  const commands = client.commands.map(command => command.data.toJSON());

  const guildIds = client.guilds.cache.map(g => g.id);
  console.log(`Registering commands for ${guildIds.length} guild(s)...`);

  for (const guildId of guildIds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body: commands }
      );
      console.log(`Registered commands for guild ${guildId}`);
    } catch (err) {
      console.error(`Failed to register commands for guild ${guildId}`, err);
    }
  }
}

const commands = client.commands.map(command => command.data.toJSON());

client.on('guildCreate', guild => {
    console.log(`Joined new guild: ${guild.name}`);
    rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands })
        .then(() => console.log(`Successfully registered commands for guild ${guild.name}`))
        .catch(console.error);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error('Error in autocomplete:', error);
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'play_trailer') {
            const trailers = movieTrailers.get(interaction.message.interaction.id);

            let replyContent;
            if (trailers && trailers.length > 0) {
                const engTrailer = trailers.find(trailer => trailer.language === 'eng');
                replyContent = engTrailer ? engTrailer.url : trailers[0].url;
            } else {
                replyContent = "No trailer available.";
            }

            await interaction.reply({ content: replyContent, ephemeral: true }).catch(e => console.error("Error replying:", e));
        } else if (interaction.customId.startsWith('audible_link_')) {
            const interactionId = interaction.customId.replace('audible_link_', '');
            const audibleLink = audibleLinks.get(interactionId);

            if (audibleLink) {
                await interaction.reply({ content: `Audible link: ${audibleLink}`, ephemeral: true });
            } else {
                await interaction.reply({ content: "No Audible link available.", ephemeral: true });
            }
        }
    }
});


client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await registerCommandsForAllGuilds();
});

client.login(process.env.DISCORD_TOKEN);