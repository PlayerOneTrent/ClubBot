// postWinner.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData } = require('../lib/pollStore');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBookDetails } = require('../services/bookService');
const { searchMovie } = require('../services/movieService');
const { audibleLinks, movieTrailers } = require('../lib/stateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postwinner')
        .setDescription('Posts the winner of the latest poll.'),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const pollsData = readPollsData();

        // Get the latest poll that is finalized and closed
        const latestPoll = pollsData.polls
            .filter(p => p.channelId === channelId && p.isFinalized && p.isClosed)
            .pop(); // Get the last poll in the array

        if (!latestPoll) {
            await interaction.reply({ content: 'No finalized and closed poll found in this channel.', ephemeral: true });
            return;
        }

        // Determine the source of votes based on whether it's a sudden death round
        const votesSource = latestPoll.isSuddenDeath ? latestPoll.suddenDeathVotes : latestPoll.votes;

        // Calculate the total points for each item
        const itemPoints = {};
        Object.values(votesSource).forEach(vote => {
            Object.entries(vote).forEach(([itemId, points]) => {
                itemPoints[itemId] = (itemPoints[itemId] || 0) + points;
            });
        });

        const sortedItems = latestPoll.items
            .map(item => ({ ...item, points: itemPoints[item.id] || 0 }))
            .sort((a, b) => b.points - a.points);

        let winnerDetails, row;
        if (sortedItems[0].type === 'book') {
            winnerDetails = await getBookDetails(sortedItems[0].id);
            const audibleSearchLink = `https://www.audible.com/search?keywords=${encodeURIComponent(winnerDetails.title + ' ' + winnerDetails.authors)}`;
            audibleLinks.set(interaction.id, audibleSearchLink);

            const customEmojiId = '1193351065786142750'; 

            if(sortedItems[0].description) {
                winnerDetails.description = sortedItems[0].description;
            }

            row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Find on Audible')
                        .setStyle(ButtonStyle.Link)
                        .setURL(audibleSearchLink)
                        .setEmoji(customEmojiId)
                );
        } else if (sortedItems[0].type === 'movie') {
            winnerDetails = await searchMovie(sortedItems[0].id, true);

            movieTrailers.set(interaction.id, winnerDetails.trailers);
            row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('play_trailer')
                        .setLabel('Send the Trailer')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );
        }

        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setDescription(winnerDetails.description || winnerDetails.overview)
            .setAuthor({
                name: `${winnerDetails.title} (Winner with ${sortedItems[0].points} points)`,
                iconURL: winnerDetails.image,
                url: winnerDetails.bookUrl || `https://thetvdb.com/movies/${winnerDetails.slug}`
            })
            .setThumbnail(winnerDetails.thumbnail || winnerDetails.image)
            .setImage(winnerDetails.image || winnerDetails.thumbnail);

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};

function getOrdinalSuffix(i) {
    const j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) {
        return "st";
    }
    if (j === 2 && k !== 12) {
        return "nd";
    }
    if (j === 3 && k !== 13) {
        return "rd";
    }
    return "th";
}
