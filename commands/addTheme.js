const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { readPollsData, writePollsData } = require('../lib/pollStore');

function normalizeThemeName(str) {
  return str.trim().replace(/\s+/g, ' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addtheme')
    .setDescription('Adds a theme to the poll')
    .addStringOption(option =>
      option
        .setName('theme')
        .setDescription('Theme name (for example: "Time Travel", "Courtroom Drama")')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Optional description or constraints for the theme')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const globalName = interaction.user.globalName;

    const themeNameRaw = interaction.options.getString('theme');
    const themeName = normalizeThemeName(themeNameRaw);
    const description = interaction.options.getString('description') || '';

    const pollsData = readPollsData();
    const poll = pollsData.polls.find(p => p.channelId === channelId && !p.isFinalized && !p.isClosed);

    if (!poll) {
      await interaction.reply({ content: 'No poll found in this channel.', ephemeral: true });
      return;
    }

    if (poll.isFinalized && poll.isClosed) {
      await interaction.reply({ content: 'The poll in this channel is closed and cannot be modified.', ephemeral: true });
      return;
    }

    if (poll.isFinalized && !poll.isClosed) {
      await interaction.reply({ content: 'The poll in this channel is finalized and no longer accepting new items.', ephemeral: true });
      return;
    }

    // Prevent duplicate themes (case-insensitive compare on name)
    const alreadyExists = poll.items.some(
      item => item.type === 'theme' && item.name.toLowerCase() === themeName.toLowerCase()
    );

    if (alreadyExists) {
      await interaction.reply({ content: 'That theme already exists in the poll. Add a different one!', ephemeral: true });
      return;
    }

    poll.items.push({
      id: `theme_${Date.now()}`,
      type: 'theme',
      name: themeName,
      description,
      votes: {},
      addedBy: userId,
      userName: globalName,
    });

    writePollsData(pollsData);

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Theme added')
      .addFields(
        { name: 'Theme', value: themeName },
        { name: 'Description', value: description ? description.slice(0, 1024) : 'None' }
      );

    await interaction.reply({ content: 'The following theme has been added to the poll:', ephemeral: true, embeds: [embed] });

    await interaction.followUp({ content: `${globalName} has added a theme to the poll.`, ephemeral: false });
  },
};
