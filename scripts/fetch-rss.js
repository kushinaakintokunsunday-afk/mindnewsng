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

// Reject URLs that are not real images (e.g. youtube embed pages)
function isImageUrl(url) {
  if (!url) return false;
  if (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(url)) return false;
  return /\.(jpe?g|png|webp|gif|avif|svg|bmp)(\?|#|$)/i.test(url) === false
    ? /^https?:\/\/.+/i.test(url) && !/\.(php|asp|x[a]?ml|json|html)(\?|#|$)/i.test(url)
    : true;
}

function extractImage(xml) {
  // Try media:content, media:thumbnail, enclosure, og:image in description, then any <img> inside the item
  const candidates = [
    /<media:content[^>]*url="([^"]+)"/i,
    /<media:thumbnail[^>]*url="([^"]+)"/i,
    /<enclosure[^>]*url="([^"]+)"/i,
    /<img[^>]*src="([^"]+)"/i,
  ];
  for (const re of candidates) {
    const m = xml.match(re);
    if (m && isImageUrl(m[1])) return m[1];
  }
  // Fallback: search the content:encoded HTML body for the first <img>
  const contentEnc = xml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
  if (contentEnc) {
    const imgMatch = contentEnc[1].match(/<img[^>]*src="([^"]+)"/i);
    if (imgMatch && isImageUrl(imgMatch[1])) return imgMatch[1];
  }
  return null;
}

// Prefer full article body from <content:encoded>. Returns { body, isFull } where
// isFull is true only when real article content (not just the summary) was available.
function extractContent(xml) {
  const contentEnc = xml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
  const desc = xml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
  const raw = contentEnc ? contentEnc[1] : (desc ? desc[1] : '');
  if (!raw) return { body: '', isFull: false };
  const clean = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  const textLen = clean.replace(/<[^>]+>/g, '').trim().length;
  // content:encoded is the real article body; plain description is only a summary
  const isFull = Boolean(contentEnc) && textLen > 120;
  return { body: clean, isFull };
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
    const { body: fullContent, isFull } = extractContent(block);
    const cleanDesc = isFull
      ? stripHtml(fullContent.split(/\s+<\/p>/).slice(0, 3).join('')).slice(0, 300)
      : stripHtml(description).slice(0, 300);
    const combinedText = `${cleanTitle} ${category}`;
    const autoCategory = categorize(combinedText);

    if (cleanTitle && link.trim()) {
      items.push({
        id: slugify(cleanTitle),
        title: cleanTitle,
        description: cleanDesc,
        content: isFull ? fullContent : '',
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
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA },
    });
    clearTimeout(timeout);
    if (!res.ok && (res.status < 300 || res.status >= 400)) throw new Error(`HTTP ${res.status}`);

    let items = parseRSS(await res.text(), feed);
    // Some feeds (e.g. Punch) ship the full body inside the 3xx response; others
    // (BBC, Premium Times) return an empty 3xx and must be followed manually.
    if (items.length === 0 && res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location) {
        const ctrl2 = new AbortController();
        const timeout2 = setTimeout(() => ctrl2.abort(), 15000);
        const res2 = await fetch(new URL(location, feed.url), {
          signal: ctrl2.signal,
          headers: { 'User-Agent': UA },
        });
        clearTimeout(timeout2);
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        items = parseRSS(await res2.text(), feed);
      }
    }
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

// Expand seed articles: build a proper HTML body and pick a themed placeholder image
function expandSeeds(seeds) {
  if (!Array.isArray(seeds)) return [];
  const now = new Date();
  return seeds.map((s, i) => {
    const title = s.title || '';
    const desc = s.description || '';
    let image = s.image || null;
    // Seeds carry no real photo; use a themed branded placeholder
    if (!image) {
      image = `https://placehold.co/800x450/0b0b0b/ffffff?text=${encodeURIComponent('Mindnewsng Guide')}`;
    }
    const paragraphs = desc
      .match(/[^.!?]+[.!?]+/g)
      .filter(p => p.trim().length > 20)
      .map(p => `<p>${escapeHtml(p.trim())}</p>`)
      .join('\n');
    const content = s.content || `
<h2>Overview</h2>
${paragraphs || `<p>${escapeHtml(desc)}</p>`}
<h2>Why it matters</h2>
<p>This guide from Mindnewsng gives Nigerian readers a clear, practical breakdown of an important topic affecting everyday lives — from relocation and scholarship opportunities to finance and lifestyle decisions.</p>
<p>For the most accurate and up-to-date details, always check the official source cited in this article, and speak to a verified and licensed professional before making any long-term commitment.</p>
<p><em>Disclaimer: This article is for general information only and does not constitute legal, financial, or professional advice.</em></p>`;
    return {
      id: s.id || slugify(title),
      title,
      description: desc,
      content,
      url: s.url || '#',
      date: s.date || new Date(new Date(now).setHours(now.getHours() - i)).toISOString(),
      category: s.category || 'Guides',
      subcategory: s.subcategory || '',
      author: s.author || 'MindnewsNG',
      source: s.source || 'MindnewsNG',
      image,
      slug: s.slug || slugify(title),
    };
  });
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
      seedArticles = expandSeeds(JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8')));
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
