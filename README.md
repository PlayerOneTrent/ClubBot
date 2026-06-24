# ClubBot

A Discord bot for running book and movie clubs. Members nominate books and movies,
the bot enriches each pick with details pulled from public APIs (cover art, synopsis,
runtime, ranked-choice metadata), and the group votes on what to read or watch next
using a **ranked-choice poll**.

Built with [discord.js](https://discord.js.org/) v14 and slash commands.

---

## Features

- **Nominate books and movies** with live autocomplete as you type.
  - Books are looked up via the **Google Books API** (author, year, page count,
    estimated reading time, categories, cover art, and an Audible link button).
  - Movies are looked up via **TheTVDB API** (title, overview, artwork, and a
    trailer button).
- **Theme rounds** — nominate a theme (e.g. "Time Travel", "Courtroom Drama")
  instead of a specific title.
- **Ranked-choice voting** — members rank every option (`b, d, c, a`) rather than
  picking just one. The bot scores ballots with a Borda count (top pick gets the most
  points, scaling down to 1 for last) and resolves ties with a sudden-death round.
- **Full poll lifecycle** — create a poll, collect nominations, finalize and shuffle,
  vote, then reveal and post the winner.
- **Resilient API calls** — request rate-limiting (Bottleneck), a short in-memory
  cache, and exponential backoff on `429` responses.
- **Per-guild command registration** — commands are registered automatically for
  every server the bot is in, including servers it joins later.

---

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- A Discord application + bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A [TheTVDB v4](https://thetvdb.com/api-information) API token
- A [Google Books](https://console.cloud.google.com/) API key

---

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <your-repo-url>
   cd ClubBot
   npm install
   ```

2. **Configure environment variables.** Copy the example file and fill in your own
   credentials:

   ```bash
   cp .env.example .env
   ```

   The following four variables are **required** ([.env.example](.env.example)):

   | Variable             | Description                                                        |
   | -------------------- | ------------------------------------------------------------------ |
   | `DISCORD_TOKEN`      | Your Discord bot token (Developer Portal → your app → Bot).         |
   | `APP_ID`             | Your Discord application (client) ID.                               |
   | `TVDB_TOKEN`         | TheTVDB v4 API token, used for movie lookups.                       |
   | `GOOGLE_BOOKS_TOKEN` | Google Books API key, used for book lookups.                        |

   > `.env` is gitignored and is **never** committed. Keep your real tokens there only.

3. **Invite the bot** to your server with the `applications.commands` and `bot`
   scopes. Slash commands register automatically the first time the bot starts in a
   guild (and whenever it joins a new one).

---

## Running

```bash
node index.js
```

For production / always-on hosting, the repo includes a
[PM2](https://pm2.keymetrics.io/) config that reads the same `.env`:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

---

## Commands

| Command                    | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| `/createpoll`              | Starts a new poll.                                                   |
| `/addbook`                 | Adds a book to the poll (autocomplete search, optional description). |
| `/addmovie`                | Adds a movie to the poll (autocomplete search, optional description).|
| `/addtheme`                | Adds a theme to the poll (e.g. "Time Travel").                       |
| `/removeitem`              | Removes the most recent item you added.                             |
| `/finalizepoll`            | Finalizes the poll, shuffles items, and opens voting.               |
| `/listitems`               | Lists all items in the finalized poll.                              |
| `/postitem`                | Posts detailed info about a specific poll item (by letter).         |
| `/vote`                    | Casts a ranked-choice vote (e.g. `b, d, c, a`).                     |
| `/showvote`                | Shows your current votes in the active poll.                        |
| `/retractvote`             | Retracts your vote in the current poll.                             |
| `/pollcheck`               | Checks the status of the current poll.                              |
| `/endpollandrevealwinner`  | Ends the poll and reveals the winner.                               |
| `/postwinner`              | Posts the winner of the latest poll.                                |
| `/book`                    | Looks up book info on demand (optionally private).                  |
| `/movie`                   | Looks up movie info on demand (optionally private).                 |
| `/help`                    | Displays help for all commands.                                     |

---

## Project structure

```
ClubBot/
├── index.js                  # Entry point: client setup, command loading, interaction routing
├── ecosystem.config.js       # PM2 process config (reads secrets from the environment)
├── commands/                 # One file per slash command
├── services/                 # External API clients
│   ├── bookService.js        # Google Books API client (search, details, caching, backoff)
│   └── movieService.js       # TheTVDB API client (search, suggestions)
├── lib/                      # Persistence + in-memory state
│   ├── pollStore.js          # Reads/writes poll state to polls.json
│   └── stateManager.js       # In-memory maps for trailer / Audible link buttons
└── polls.json                # Runtime poll data (gitignored — generated at runtime)
```

---

## Notes

- `polls.json` is the bot's runtime data store and is **not** committed; it is created
  automatically on first run.
- API responses are cached briefly in memory to absorb autocomplete typing bursts and
  stay within rate limits.

---

## License

ISC
