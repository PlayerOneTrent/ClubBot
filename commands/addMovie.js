// addMovieItem.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');
const { searchMovie, searchMovieSuggestions } = require('../services/movieService');
const { movieTrailers } = require('../lib/stateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addmovie')
        .setDescription('Adds a movie to the poll')
        .addStringOption(option => 
            option.setName('movieid')
            .setDescription('Start typing the movie title and select from autocomplete')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('customdescription')
            .setDescription('Custom description of the movie (optional)')
            .setRequired(false)),
    async execute(interaction) {
        const movieId = interaction.options.getString('movieid');
        const customDescription = interaction.options.getString('customdescription');
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const globalName = interaction.user.globalName
        console.log("User: ", interaction.user)
        console.log("MovieId: ", movieId)

        let movieDirector = 'No director listed.';
            let cast = 'No cast listed';
            let movieBackground = '';
            let genres = '';
            let runtime = 'No runtime listed.';
            let tvdbUrl = 'https://thetvdb.com/movies/';

        const movieDetails = await searchMovie(movieId, true);
        if (!movieDetails) {
            await interaction.reply({ content: 'Movie not found.', ephemeral: true });
            return;
        }

        if (movieDetails != null) {
          movieDirector = movieDetails.director ? movieDetails.director : 'No director listed.';
          tvdbUrl += movieDetails.slug ? movieDetails.slug : ''

          if (movieDetails.runtime) {
              const hours = Math.floor(movieDetails.runtime / 60);
              const minutes = movieDetails.runtime % 60;
              runtime = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
          }

          movieTrailers.set(interaction.id, movieDetails.trailers);
        }

        if (movieDetails != null && movieDetails.genres && movieDetails.genres.length > 0) {
            // Assuming each genre object has a property 'name' that holds the genre's name
            genres = movieDetails.genres.map((genre, index) => 
                genre.name + (index < movieDetails.genres.length - 1 ? '\n' : '')
            ).join('');
        } else {
            genres = 'No genres listed.';
        }

         // Include the year in the movie title
         const movieTitleWithYear = `${movieDetails.title} (${movieDetails.year ? movieDetails.year : 'Unknown'})`;
        
        // Set movie director and cast
        if (movieDetails != null && movieDetails.characters && movieDetails.characters.length > 0) {
            // Find and return the director or default if not found.
            const director = movieDetails.characters.find(character => character.peopleType === 'Director');
            movieDirector = director ? `${director.personName}` : 'No director listed.';

            // Return up to the first five actors listed in the array for the movie, and set them with linebreaks.
            const actors = movieDetails.characters.filter(character => character.peopleType === 'Actor').slice(0, 5);
            if (actors.length > 0) {
                cast = actors.map((actor, index) => actor.personName + ' - ' + actor.name + (index < actors.length - 1 ? '\n' : '')).join('');
            }
        }
        // Check if movieDetails and its artwork array are not null and have elements
        if (movieDetails != null && movieDetails.artworks && movieDetails.artworks.length > 0) {
            // Find the first artwork of type 15 (background)
            const backgroundArtwork = movieDetails.artworks.find(artwork => artwork.type == 15);
            
            // If found, use its URL, otherwise default to movieDetails.image
            movieBackground = backgroundArtwork ? backgroundArtwork.thumbnail : movieDetails.image;
        } else {
            // If no artwork array is available, use movieDetails.image
            movieBackground = movieDetails.image;
        }

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

        // Check if the movie already exists in the poll
        const movieAlreadyExists = poll.items.some(item => item.id === movieId && item.type === 'movie');
        if (movieAlreadyExists) {
            await interaction.reply({ content: `That movie already exists in the poll. Submit another one!`, ephemeral: true });
            return;
        }


        // Add movie to the poll
        poll.items.push({
            id: movieId,
            type: 'movie',
            name: movieTitleWithYear,
            description: customDescription || movieDetails.overview,
            votes: {},
            addedBy: userId,
            userName: globalName
        });

        writePollsData(pollsData);

        movieTrailers.set(interaction.id, movieDetails.trailers);

        const movieEmbed = new EmbedBuilder()
            .setColor('#0099FF')
            .setAuthor({ name: movieTitleWithYear, url: `https://thetvdb.com/movies/${movieDetails.slug}`, iconURL: 'https://thetvdb.com/images/icon.png' })
            .setDescription(customDescription || movieDetails.overview)
            .setImage(movieBackground)
            .setThumbnail(movieDetails.image)
            .addFields(
              {name: 'Runtime:    ⏰', value: runtime, inline: true},
              { name: '\u200B', value: '\u200B', inline: true },
              {name: 'Genres:    🎭', value: genres, inline: true},
              {name: 'Director:    🎬', value: movieDirector, inline: true},
              { name: '\u200B', value: '\u200B', inline: true },
              {name: 'Cast:    👥', value: cast, inline: true},
              )
            .setFooter({ text: 'Movie information provided by TheTVDB' });
        
        const movieRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('play_trailer')
                    .setLabel('Send the Trailer')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('▶️')
            );
        
        await interaction.reply({ content: `The following has been added to the poll:`, ephemeral: true, embeds: [movieEmbed], components: [movieRow] });

        const announcementMessage = `${globalName} has added to the poll.`;
        await interaction.followUp({ content: announcementMessage, ephemeral: false });
    },
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const searchQuery = focusedOption.value;
        const suggestions = await searchMovieSuggestions(searchQuery);

        await interaction.respond(
            suggestions.map(movie => ({ name: movie.title, value: movie.value }))
        );
    }
};
