// book.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { searchBooks, getBookDetails } = require('../services/bookService');
const { audibleLinks } = require('../lib/stateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('book')
        .setDescription('Responds with book info')
        .addStringOption(option => 
            option.setName('query')
                  .setDescription('The book title to search for')
                  .setRequired(true)
                  .setAutocomplete(true))
        .addBooleanOption(option => 
            option.setName('private')
                  .setDescription('Show response only to you?')
                  .setRequired(false)), // Added boolean option
    async execute(interaction) {
        const query = interaction.options.getString('query');
        const isPrivate = interaction.options.getBoolean('private'); // Fetch the value of the boolean option
        const bookDetails = await getBookDetails(query);

        if (!bookDetails) {
            await interaction.reply({ content: 'Book not found.', ephemeral: isPrivate ?? true });
            return;
        }
        console.log("Image: ", bookDetails.image);
        const embed = new EmbedBuilder()
            .setAuthor(
                {
                    name: bookDetails.title,
                    url: bookDetails.bookUrl,
                    iconURL: 'https://books.google.com/googlebooks/images/material/book_icon_color.png',
                }
            )
            .setDescription(bookDetails.description)
            .addFields(
                { name: 'Author    ✍️', value: bookDetails.authors, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Categories    🏷️', value: bookDetails.categories, inline: true },
                { name: 'Page Count    📄', value: bookDetails.pageCount.toString(), inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Avg. Read Time    ⏳', value: bookDetails.averageReadTime, inline: true},
            )
            .setThumbnail(bookDetails.thumbnail)
            .setImage(bookDetails.image)
            .setColor('#0099FF');
            // Generate the Audible search link
            const audibleSearchLink = `https://www.audible.com/search?keywords=${encodeURIComponent(bookDetails.title + ' ' + bookDetails.authors)}`;

            // Store the interaction ID and Audible link
            audibleLinks.set(interaction.id, audibleSearchLink);

            const customEmojiId = '1193351065786142750'; 

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Find on Audible')
                        .setStyle(ButtonStyle.Link) 
                        .setEmoji(customEmojiId)
                        .setURL(audibleSearchLink) 
                );

                await interaction.reply({ 
                    embeds: [embed], 
                    components: [row],
                    ephemeral: isPrivate ?? false
                });
    },
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const searchQuery = focusedOption.value;
        const suggestions = await searchBooks(searchQuery);

        await interaction.respond(
            suggestions.map(book => ({ name: book.title, value: book.id }))
        );
    }
};
