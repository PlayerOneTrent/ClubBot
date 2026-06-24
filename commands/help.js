const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js'); // Use EmbedBuilder from discord.js v14

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays help information for all commands'),

    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Help: List of Commands')
            .addFields(
                { name: '**/createPoll**', value: 'Create\'s a poll with a specific name (that\'s optional). If no name is provided, it will default to the month and year plus unique poll Id.' },
                { name: '**/book**', value: 'Find a book you want to submit! There\'s an optional option called hidden when, set to true, only message you the book response.' },
                { name: '**/addBook**', value: 'You can search the API to find your book and add it to the poll. You can also append a custom description if you don\'t want to use Google APIs (often very long) description. After you\'ve successfully done this, it will show you an example of what the item will look like when we post it during the showcase part of polling.' },
                { name: '**/movie**', value: 'Find a movie you want to submit! There\'s an optional option called hidden when, set to true, only messages you the movie response.' },
                { name: '**/addMovie**', value: 'Same as adding a book, but adding a movie! Search the API to find your movie and add it to the poll. You can also append a custom description if you don\'t want to use the default API description. After you\'ve successfully done this, it will show you an example of what the item will look like when we post it during the showcase part of polling.' },
                { name: '**/removeItem**', value: 'This will remove your personal most recent addition to the poll. You cannot remove any poll items except your own. This can only be done if the poll is not finalized.' },
                { name: '**/finalizePoll**', value: 'Finalizes the poll and all the entries. It shuffles all poll items as well, so we can\'t tell who entered what based on people adding them last.' },
                { name: '**/listItems**', value: 'This provides a normal, straight forward listing of the shuffled poll items, with each poll item\'s corresponding alphabetical signifier. This will be important for voting.' },
                { name: '**/pollCheck**', value: 'Check to see who has submitted items or who has already voted.' },
                { name: '**/postItem**', value: 'We\'ll use this to post each poll item and read off the information provided to us. It will use the user\'s custom description if one was submitted, otherwise it will pull the description for Google Books API.' },
                { name: '**/postVote**', value: 'See how you voted to see if you want to retract and vote again.' },
                { name: '**/vote**', value: 'You do this using the /listPollItems to see which order you want to rank choice vote in. For example, "/vote a, d, b, c" OR, alternatively, "/vote a d b c". This will do the proper ranked choice point scoring, all you have to do is list the items from the ones you want to read the most, to the ones you want to read the least. If you vote again, the previous vote will be retracted and your new vote will be posted.' },
                { name: '**/endPollAndRevealWinner**', value: 'Closes the poll and reveals the winner, along with all other entries and their point totals.' },
                { name: '**/postWinner**', value: 'In case we forget or want to quickly see what it is again, you can use this command.' }
            );

        await interaction.reply({ embeds: [helpEmbed] });
    },
};
