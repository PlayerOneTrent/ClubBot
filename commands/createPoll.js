const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createpoll')
        .setDescription('Starts a new poll')
        .addStringOption(option => 
            option.setName('name')
            .setDescription('Name of the poll')
            .setRequired(false)),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const pollsData = readPollsData();

        // Generate a unique poll ID
        const pollId = `poll${pollsData.polls.length + 1}`;

        // If a custom name is not provided, generate a default name and append the poll ID
        let pollName = interaction.options.getString('name');
        if (!pollName) {
            pollName = `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()} Poll (${pollId})`;
        }

        // Check if an active (not finalized) poll already exists in this channel
        if (pollsData.polls.some(poll => poll.channelId === channelId && !poll.isFinalized)) {
            await interaction.reply({ content: 'An active poll already exists in this channel!', ephemeral: true });
            return;
        }

        // Create a new poll with the unique name
        const newPoll = {
            id: pollId,
            channelId: channelId,
            name: pollName,
            items: [],
            suddenDeathItems: [],
            isFinalized: false,
            isClosed: false,
            isSuddenDeath: false,
        };

        // Add the new poll to the polls data and save
        pollsData.polls.push(newPoll);
        writePollsData(pollsData);

        // Reply to the user
        await interaction.reply({ content: `Poll created: ${pollName}` });
    },
};
