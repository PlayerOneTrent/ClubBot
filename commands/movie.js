// movie.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { searchMovie, searchMovieSuggestions } = require('../services/movieService');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { movieTrailers } = require('../lib/stateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('movie')
        .setDescription('Responds with movie info')
        .addStringOption(option => 
            option.setName('query')
                  .setDescription('The movie title to search for')
                  .setRequired(true)
            .setAutocomplete(true))
            .addBooleanOption(option => 
            option.setName('private')
                    .setDescription('Show response only to you?')
                    .setRequired(false)), // Added boolean option
                  
        async execute(interaction) {
            const query = interaction.options.getString('query');
            const isPrivate = interaction.options.getBoolean('private');
            console.log("User input:", query);
                // Determine if the query is a tvdb_id (e.g., a number) or a string
            const isId = /^\d+$/.test(query);
            
            const movieInfo = await searchMovie(query, isId);

            let movieDirector = 'No director listed.';
            let cast = 'No cast listed';
            let movieBackground = '';
            let genres = '';
            let runtime = '';
            let tvdbUrl = 'https://thetvdb.com/movies/';

            if (movieInfo != null) {
                movieDirector = movieInfo.director ? movieInfo.director : 'No director listed.';
                tvdbUrl += movieInfo.slug ? movieInfo.slug : ''

                if (movieInfo.runtime) {
                    const hours = Math.floor(movieInfo.runtime / 60);
                    const minutes = movieInfo.runtime % 60;
                    runtime = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
                }
 
                movieTrailers.set(interaction.id, movieInfo.trailers);
            }

            if (movieInfo != null && movieInfo.genres && movieInfo.genres.length > 0) {
                // Assuming each genre object has a property 'name' that holds the genre's name
                genres = movieInfo.genres.map((genre, index) => 
                    genre.name + (index < movieInfo.genres.length - 1 ? '\n' : '')
                ).join('');
            } else {
                genres = 'No genres listed.';
            }
            
            // Set movie director and cast
            if (movieInfo != null && movieInfo.characters && movieInfo.characters.length > 0) {
                // Find and return the director or default if not found.
                const director = movieInfo.characters.find(character => character.peopleType === 'Director');
                movieDirector = director ? `${director.personName}` : 'No director listed.';

                // Return up to the first five actors listed in the array for the movie, and set them with linebreaks.
                const actors = movieInfo.characters.filter(character => character.peopleType === 'Actor').slice(0, 5);
                if (actors.length > 0) {
                    cast = actors.map((actor, index) => actor.personName + ' - ' + actor.name + (index < actors.length - 1 ? '\n' : '')).join('');
                }
            }
            // Check if movieInfo and its artwork array are not null and have elements
            if (movieInfo != null && movieInfo.artworks && movieInfo.artworks.length > 0) {
                // Find the first artwork of type 15 (background)
                const backgroundArtwork = movieInfo.artworks.find(artwork => artwork.type == 15);
                
                // If found, use its URL, otherwise default to movieInfo.image
                movieBackground = backgroundArtwork ? backgroundArtwork.thumbnail : movieInfo.image;
            } else {
                // If no artwork array is available, use movieInfo.image
                movieBackground = movieInfo.image;
            }
        
            // Embed
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setAuthor({
                    name: movieInfo.title + ' (' + movieInfo.year + ')',
                    iconURL: 'https://thetvdb.com/images/icon.png',
                    url: tvdbUrl,
                })  
                .setDescription(movieInfo.overview) 
                .setImage(movieBackground)
                .setThumbnail(movieInfo.image)
                .setTimestamp()
                .addFields(
                    {name: 'Runtime:    ⏰', value: runtime, inline: true},
                    { name: '\u200B', value: '\u200B', inline: true },
                    {name: 'Genres:    🎭', value: genres, inline: true},
                    {name: 'Director:    🎬', value: movieDirector, inline: true},
                    { name: '\u200B', value: '\u200B', inline: true },
                    {name: 'Cast:    👥', value: cast, inline: true},)
                .setFooter({ text: 'Movie information provided by TheTVDB' });
        
            // Button
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('play_trailer')
                        .setLabel('Send the Trailer')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
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
    
        try {
            const suggestions = await searchMovieSuggestions(searchQuery);
            
            // Respond with suggestions
            await interaction.respond(
                suggestions.map(movie => ({ name: movie.title, value: movie.value }))
            );
        } catch (error) {
            console.error('Error in autocomplete:', error);
        }
    }    
};