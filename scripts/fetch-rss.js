const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT = path.join(DATA_DIR, 'articles.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');

const RSS_FEEDS = [
  // Nigerian sources
  { source: 'BBC Africa',     category: 'World News',  url: 'http://feeds.bbci.co.uk/news/world/africa/rss.xml' },
  { source: 'Channels TV',    category: 'News',        url: 'https://www.channelstv.com/feed/' },
  { source: 'Premium Times',  category: 'News',        url: 'https://www.premiumtimesng.com/feed/' },
  { source: 'Vanguard',       category: 'News',        url: 'https://www.vanguardngr.com/feed/' },
  { source: 'The Guardian',   category: 'News',        url: 'https://guardian.ng/feed/' },
  { source: 'Punch',          category: 'News',        url: 'https://punchng.com/feed/' },
  // International sources relevant to Nigerians
  { source: 'France24 Africa', category: 'World News',  url: 'https://www.france24.com/en/africa/rss' },
  { source: 'Al Jazeera',     category: 'World News',  url: 'https://www.aljazeera.com/xml/rss/all.xml' },
];

const CATEGORY_KEYWORDS = {
  Politics:       /govern|presid|minist|senat|house.*represent|gubernat|election|party|apc|pdp|labour.*party|nass|inec|assembl/i,
  Entertainment:  /movie|nollywood|music|film|actor|actress|singer|entertai|concert|blogger|afrobeats|grammy|amvca|bbnaija/i,
  Sports:         /football|soccer|nff|super.*eagles|npfl|league|transfer|goal|coach|match|champion|olympi|athlet|basketball/i,
  Money:          /econom|cbn|banking|stock|trade|invest|gdp|inflat|naira|dollar|dangot|ftse|ngx|nse|oil.*price|exchange.*rate|forex|cost.*of|price|salary|loan|wage|budget/i,
  'Jobs & Education': /scholarship|job|vacanc|universit|school.*fee|admission|visa|train|certif|examin|recruit|employ|degree|course|student|employment|japa|relocat|immigra|emigrat|work.*abroad|freelanc|remote.*work/i,
  Health:         /health|hospit|doctor|vaccin|disease|malaria|covid|treatment|pharm|minist.*health|who\b/i,
  Lifestyle:      /fashion|food|travel|relationship|wedding|marriage|style|beauty|home/i,
  Technology:     /artifici.*intellig|blockchain|cryptocurr|bitcoin|fintech|start.?up|software|cyber|data.*breach|gadget|smartphone|iphone|tech/i,
  'World News':   /africa|us |america|uk |britain|canada|europe|china|russia|united.*states|united.*kingdom|international|global|xenophob|deporta|protest.*nigeri|attack.*nigeri|foreign/i,
};

function categorize(text) {
  for (const [cat, re] of Object.entries(CATEGORY_KEYWORDS)) {
    if (re.test(text)) return cat;
  }
  return 'News';
}

function extractImage(xml) {
  // Try media:content, media:thumbnail, enclosure, og:image in description, or defaults
  const mediaMatch = xml.match(/<media:content[^>]*url="([^"]+)"/i)
    || xml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
    || xml.match(/<enclosure[^>]*url="([^"]+)"/i)
    || xml.match(/<img[^>]*src="([^"]+)"/i);
  return mediaMatch ? mediaMatch[1] : null;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseDate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseRSS(xml, feedMeta) {
  const items = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || '';
    const link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1] || (block.match(/<link[^>]*\/>/i) || [])[0] || '';
    const description = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1] || '';
    const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
    const author = (block.match(/<dc:creator[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i) || [])[1] || feedMeta.source;
    const category = (block.match(/<category[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/i) || [])[1] || '';
    const image = extractImage(block) || extractImage(description);

    const cleanTitle = stripHtml(title);
    const cleanDesc = stripHtml(description).slice(0, 300);
    const combinedText = `${cleanTitle} ${category}`;
    const autoCategory = categorize(combinedText);

    if (cleanTitle && link.trim()) {
      items.push({
        id: slugify(cleanTitle),
        title: cleanTitle,
        description: cleanDesc,
        url: link.trim(),
        date: parseDate(pubDate),
        category: autoCategory,
        subcategory: stripHtml(category),
        author: stripHtml(author),
        source: feedMeta.source,
        image: image || null,
        slug: slugify(cleanTitle),
      });
    }
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MindnewsNG-Bot/1.0 (+https://mindnewsng.com)' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSS(xml, feed);
    console.log(`  [OK] ${feed.source}: ${items.length} articles`);
    return items;
  } catch (err) {
    console.warn(`  [WARN] ${feed.source}: ${err.message}`);
    return [];
  }
}

function deduplicate(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByDate(articles) {
  return articles.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function main() {
  console.log('MindnewsNG RSS Fetcher');
  console.log('='.repeat(40));

  let allArticles = [];

  console.log('\nFetching feeds...');
  const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
  for (const items of results) {
    allArticles.push(...items);
  }

  // Load seed articles as fallback/supplement
  let seedArticles = [];
  if (fs.existsSync(SEED_FILE)) {
    try {
      seedArticles = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
      console.log(`\nLoaded ${seedArticles.length} seed articles`);
    } catch (e) {
      console.warn(`\nFailed to read seed.json: ${e.message}`);
    }
  }

  // Merge: RSS on top, seed fills gaps
  const merged = [...allArticles, ...seedArticles];
  const deduped = deduplicate(merged);
  const sorted = sortByDate(deduped);

  // Keep max 200 articles
  const final = sorted.slice(0, 200);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(final, null, 2));
  console.log(`\nWrote ${final.length} articles to ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
