// bookService.js

const axios = require('axios');
const Bottleneck = require('bottleneck');
const TurndownService = require('turndown');

const turndownService = new TurndownService();

const API_KEY = process.env.GOOGLE_BOOKS_TOKEN; 

// Global limiter for all Google Books calls
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 150, // about 6-7 req/sec max
});

// Simple in-memory TTL cache
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function limitedGet(url) {
  return limiter.schedule(() => axios.get(url));
}

async function getWithBackoff(url, { retries = 3 } = {}) {
  let attempt = 0;

  while (true) {
    try {
      return await limitedGet(url);
    } catch (err) {
      const status = err?.response?.status;

      if (status !== 429 || attempt >= retries) {
        throw err;
      }

      const retryAfter = err?.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : null;

      const backoffMs =
        retryAfterMs ?? (500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250));

      await sleep(backoffMs);
      attempt += 1;
    }
  }
}

function safeAuthors(volumeInfo) {
  return volumeInfo?.authors?.length ? volumeInfo.authors.join(', ') : 'Unknown Authors';
}

function safeYear(volumeInfo) {
  const date = volumeInfo?.publishedDate;
  return date ? `(${String(date).split('-')[0]})` : '(Unknown Year)';
}

async function searchBooks(query) {
  const q = (query ?? '').trim();

  // Autocomplete guardrails
  if (q.length < 3) return [];
  if (!API_KEY) {
    console.warn('GOOGLE_BOOKS_TOKEN is not set. Requests may be rate-limited.');
  }

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://www.googleapis.com/books/v1/volumes` +
    `?q=${encodeURIComponent(q)}` +
    `&maxResults=7` +
    (API_KEY ? `&key=${encodeURIComponent(API_KEY)}` : '');

  try {
    const response = await getWithBackoff(url, { retries: 3 });
    const items = response?.data?.items ?? [];

    const results = items.map((item) => {
      const authors = safeAuthors(item.volumeInfo);
      const year = safeYear(item.volumeInfo);

      let fullTitle = `${item.volumeInfo.title} by ${authors} ${year}`;
      if (fullTitle.length > 97) fullTitle = fullTitle.substring(0, 94) + '...';

      return { title: fullTitle, id: item.id };
    });

    // Cache for 60s to absorb typing bursts
    cacheSet(cacheKey, results, 60_000);
    return results;
  } catch (error) {
    const status = error?.response?.status;
    console.error('Error searching for books:', status ?? error?.message ?? error);
    return [];
  }
}

async function getBookDetails(bookId) {
  const id = (bookId ?? '').trim();
  if (!id) return null;

  const cacheKey = `book:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}` +
    (API_KEY ? `?key=${encodeURIComponent(API_KEY)}` : '');

  try {
    const response = await getWithBackoff(url, { retries: 3 });
    const data = response.data;
    const info = data?.volumeInfo ?? {};

    const markdownDescription = info.description
      ? turndownService.turndown(info.description)
      : 'Description not available.';

    const pageCount = Number(info.pageCount) || 0;
    const readTimeMinutes = pageCount ? pageCount * 1.7 : 0;
    const hours = Math.floor(readTimeMinutes / 60);
    const minutes = Math.round(readTimeMinutes % 60);
    const readTimeFormatted = pageCount ? `${hours}h ${minutes}m` : 'Not available';

    const categories = info.categories?.length ? info.categories.join(', ') : 'Not categorized';
    const publishedYear = safeYear(info);

    const thumbnail =
      info.imageLinks?.thumbnail ||
      'https://www.marytribble.com/wp-content/uploads/2020/12/book-cover-placeholder.png';

    const details = {
      title: info.title || 'Untitled',
      authors: safeAuthors(info),
      description: markdownDescription,
      pageCount: info.pageCount || 'Not available',
      thumbnail,
      image: thumbnail,
      bookUrl: info.canonicalVolumeLink || 'Not available',
      categories,
      averageReadTime: readTimeFormatted,
      bookYear: publishedYear,
    };

    // Cache details longer (books rarely change)
    cacheSet(cacheKey, details, 24 * 60 * 60_000);
    return details;
  } catch (error) {
    const status = error?.response?.status;
    console.error('Error fetching book details:', status ?? error?.message ?? error);
    return null;
  }
}

module.exports = { searchBooks, getBookDetails };