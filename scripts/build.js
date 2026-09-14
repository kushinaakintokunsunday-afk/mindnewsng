const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'articles.json');
const OUT = path.join(ROOT, 'public');
const CSS_SRC = path.join(ROOT, 'css', 'styles.css');
const JS_SRC = path.join(ROOT, 'js', 'main.js');

const SITE = {
  name: 'Mindnewsng',
  tagline: 'Latest Nigeria News, Naija News and Breaking News Today',
  description: "Mindnewsng is your trusted Nigerian newspaper providing Breaking News, Latest News, Politics, Sport, Business, Entertainment and International headlines.",
  email: 'info@mindnewsng.com',
  phone: '+234 800 000 0000',
  baseUrl: '/',
};

const CATEGORIES = ['News', 'Politics', 'Entertainment', 'Sports', 'Money', 'Jobs & Education', 'Technology', 'Lifestyle', 'World News', 'Guides'];

// Tier-1 nav as displayed in the header (hierarchy: main first, "More" rest)
const NAV_PRIMARY = ['Politics', 'Entertainment', 'Sports', 'Money', 'Jobs & Education', 'Technology', 'Lifestyle', 'World News', 'Guides'];

const NAV_ITEMS = [
  { label: 'Home', href: '../index.html' },
  ...NAV_PRIMARY.map(c => ({ label: c, href: `../pages/${slugify(c)}.html` })),
];
const SECTION_COLORS = {
  Politics: '#000000',
  Entertainment: '#1f1f1f',
  Sports: '#333333',
  Money: '#4a4a4a',
  'Jobs & Education': '#5c5c5c',
  Technology: '#2c2c2c',
  Health: '#db0000',
  Lifestyle: '#3a3a3a',
  'World News': '#0f0f0f',
  News: '#111111',
  Guides: '#7a1f1f',
  Breaking: '#db0000',
  default: '#111111',
};

function getCatColor(cat) {
  return SECTION_COLORS[cat] || SECTION_COLORS.default;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/&/g, 'and')
    .replace(/-+$/g, '');
}

// Normalize legacy category names into the Tier-1 structure
function decodeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeCategory(cat) {
  const map = {
    Business: 'Money',
    Economy: 'Money',
    Jobs: 'Jobs & Education',
    Education: 'Jobs & Education',
    World: 'World News',
    'World News': 'World News',
    Celebrities: 'Entertainment',
    Guida: 'Guides',
    Guide: 'Guides',
    'South East': 'News',
    'South West': 'News',
    'North Central': 'News',
    'North East': 'News',
    'North West': 'News',
    'More News': 'News',
    'News Reports': 'News',
    'Headline Stories': 'News',
    Headlines: 'News',
    'Crime Watch': 'News',
    Headlines: 'News',
    Football: 'Sports',
    Foreign: 'World News',
    Contributors: 'News',
  };
  const clean = decodeHtml(cat);
  return map[clean] || clean || 'News';
}

function articleCategory(article) {
  return normalizeCategory(article.category);
}

function readingTime(article) {
  const text = `${article.title} ${article.description}`;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function getCatColor(cat) {
  return SECTION_COLORS[cat] || SECTION_COLORS.default;
}

function getArticles() {
  if (!fs.existsSync(DATA)) {
    console.error('data/articles.json not found. Run: npm run fetch');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DATA, 'utf-8'));
}

function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now - date;
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function placeholderImg(id, w = 600, h = 338) {
  return `https://placehold.co/${w}x${h}/02b290/ffffff?text=Mindnewsng`;
}

// ─── HTML Templates ───────────────────────────────────────────────

function header(activePage = 'Home') {
  const linksHtml = NAV_ITEMS.map(item => {
    const isActive = item.label === activePage;
    return `<li><a href="${item.href}"${isActive ? ' class="active"' : ''}>${item.label}</a></li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body>
    <header class="site-header">
        <div class="header-top">
            <button class="burger-btn" id="burgerBtn" aria-label="Open menu">
                <span class="burger-line"></span>
                <span class="burger-line"></span>
                <span class="burger-line"></span>
            </button>
            <a href="../index.html" class="site-logo"><span class="logo-text-fallback">Mind<span>news</span>ng</span></a>
            <button class="search-btn" id="searchBtn" aria-label="Search">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
        </div>
        <nav class="main-nav" id="mainNav">
            <ul>${linksHtml}
            </ul>
        </nav>
        <div class="search-overlay" id="searchOverlay">
            <div class="search-overlay-inner">
                <form id="searchForm" class="search-form">
                    <input type="text" id="searchInput" placeholder="Search news..." autocomplete="off">
                    <button type="submit" aria-label="Search">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
                    </button>
                </form>
                <div class="search-results" id="searchResults"></div>
                <button class="search-close" id="searchClose" aria-label="Close">&times;</button>
            </div>
        </div>
    </header>
    <div class="ticker">
        <div class="ticker-label">BREAKING</div>
        <div class="ticker-track"><div class="ticker-content">
            <span class="ticker-live-dot"></span>
            <a href="#">FG announces new policy changes effective next month - LIVE</a>
            <span>&#9679;</span>
            <a href="#">Super Eagles qualify for AFCON after dramatic 2-1 win</a>
            <span>&#9679;</span>
            <a href="#">Naira gains against dollar as CBN injects liquidity</a>
        </div></div>
    </div>`;
}

function footer() {
  return `
    <footer class="site-footer">
        <div class="footer-top"><div class="container footer-inner">
            <div class="footer-col footer-about">
                <a href="../index.html" class="footer-logo">Mind<span>news</span>ng</a>
                <p>Mindnewsng is Nigeria's trusted source for breaking news, politics, entertainment, sports, business and more.</p>
            </div>
            <div class="footer-col">
                <h4>Categories</h4>
                <ul>${CATEGORIES.map(c => `<li><a href="../pages/${slugify(c)}.html">${c}</a></li>`).join('\n')}</ul>
            </div>
            <div class="footer-col">
                <h4>Company</h4>
                <ul>
                    <li><a href="../about.html">About Us</a></li>
                    <li><a href="../contact.html">Contact Us</a></li>
                    <li><a href="../privacy.html">Privacy Policy</a></li>
                    <li><a href="../terms.html">Terms of Service</a></li>
                </ul>
            </div>
            <div class="footer-col footer-social">
                <h4>Follow Us</h4>
                <div class="social-links">
                    <a href="#" aria-label="Facebook">FB</a>
                    <a href="#" aria-label="Twitter">X</a>
                    <a href="#" aria-label="Instagram">IG</a>
                    <a href="#" aria-label="YouTube">YT</a>
                </div>
                <h4>Contact</h4>
                <p class="footer-contact">
                    <a href="mailto:${SITE.email}">${SITE.email}</a><br>
                    <a href="tel:${SITE.phone}">${SITE.phone}</a>
                </p>
            </div>
        </div></div>
        <div class="footer-bottom"><div class="container">
            <p>&copy; ${new Date().getFullYear()} Mindnewsng. All rights reserved.</p>
        </div></div>
    </footer>`;
}

function adBlock(size = '728x90') {
  return `<div class="ad"><span class="ad-label">Advertisement</span><div class="ad-placeholder">Ad Space ${size}</div></div>`;
}

function articleCard(article, size = 'full') {
  const cat = articleCategory(article);
  const img = article.image || placeholderImg(article.id);
  const href = `../articles/${article.slug}.html`;
  const read = readingTime(article);
  return `
    <a href="${href}" class="card ${size === 'thumb' ? 'card-horizontal' : 'article-card'}">
        <div class="news-img ${size === 'thumb' ? 'thumb' : 'ratio-16x9'}">
            <img src="${esc(img)}" alt="${esc(article.title)}" loading="lazy"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="img-fallback" style="display:none">MINDNEWSNG</div>
        </div>
        <span class="category-tag" style="--cat-color:${getCatColor(cat)}">${esc(cat)}</span>
        <h3 class="headline">${esc(article.title)}</h3>
        <div class="card-info">
            <span class="info-category">${esc(cat)}</span>
            <span class="info-author">By ${esc(article.author)}</span>
            <span class="info-time">${formatDate(article.date)}</span>
            <span class="info-read">${read} min read</span>
        </div>
    </a>`;
}

function trendingItem(article, index) {
  const href = `../articles/${article.slug}.html`;
  return `
    <a href="${href}" class="card trending-item">
        <span class="trending-number">${index + 1}</span>
        <h3 class="headline-sm">${esc(article.title)}</h3>
    </a>`;
}

function featuredCard(article, imgW = 300, imgH = 169) {
  const cat = articleCategory(article);
  const img = article.image || placeholderImg(article.slug || article.id, imgW, imgH);
  return `
    <a href="articles/${article.slug}.html" class="card featured-card">
        <div class="news-img ratio-16x9">
            <img src="${esc(img)}" alt="${esc(article.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="img-fallback" style="display:none">MINDNEWSNG</div>
        </div>
        <span class="category-tag">${esc(cat)}</span>
        <h3 class="headline">${esc(article.title)}</h3>
        <div class="card-info"><span class="info-time">${formatDate(article.date)}</span><span class="info-read">${readingTime(article)} min read</span></div>
    </a>`;
}

// ─── Page Builders ────────────────────────────────────────────────

function buildSeoPages(articles) {
  const now = new Date().toUTCString();
  const latest = articles.slice(0, 50);

  // Site RSS feed
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(SITE.name)} - ${esc(SITE.tagline)}</title>
    <link>https://kushinaakintokunsunday-afk.github.io/mindnewsng/</link>
    <description>${esc(SITE.description)}</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    ${latest.map(a => `
    <item>
      <title>${esc(a.title)}</title>
      <link>https://kushinaakintokunsunday-afk.github.io/mindnewsng/articles/${a.slug}.html</link>
      <description>${esc(a.description)}</description>
      <category>${esc(articleCategory(a))}</category>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
    </item>`).join('\n')}
  </channel>
</rss>`;

  // Sitemap
  const urls = [
    '/', '/about.html', '/contact.html', '/privacy.html', '/terms.html',
    ...CATEGORIES.map(c => `/pages/${slugify(c)}.html`),
    ...articles.map(a => `/articles/${a.slug}.html`),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(u => `
  <url><loc>https://kushinaakintokunsunday-afk.github.io/mindnewsng${u}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(OUT, 'rss.xml'), rss);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://kushinaakintokunsunday-afk.github.io/mindnewsng/sitemap.xml');
  console.log('  Built: rss.xml, sitemap.xml, robots.txt');
}

function buildIndex(articles) {
  const normalized = articles.map(a => ({ ...a, category: articleCategory(a) }));
  const recent = normalized.slice(0, 40);
  const hero1 = recent[0];
  const hero2 = recent[1] || recent[0];
  const latest = recent.slice(0, 6);
  const featured = recent.slice(6, 10);
  const trending = recent.slice(10, 15);
  const mostShared = recent.slice(4, 10);
  const editorsPicks = recent.slice(15, 21);

  const guidesArticles = normalized.filter(a => articleCategory(a) === 'Guides');
  const everPool = [...normalized.filter(a => articleCategory(a) === 'Lifestyle'), ...normalized];
  const guidesFallback = everPool.slice(8, 12);

  const blockArticles = (cat, n) => normalized.filter(a => articleCategory(a) === cat).slice(0, n);
  const politicsArticles = blockArticles('Politics', 3);
  const entArticles = blockArticles('Entertainment', 3);
  const sportsArticles = blockArticles('Sports', 3);
  const moneyArticles = blockArticles('Money', 4);
  const jobsArticles = blockArticles('Jobs & Education', 3);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SITE.name} - ${SITE.tagline}</title>
    <meta name="description" content="${esc(SITE.description)}">
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header class="site-header">
        <div class="header-top">
            <button class="burger-btn" id="burgerBtn" aria-label="Open menu">
                <span class="burger-line"></span>
                <span class="burger-line"></span>
                <span class="burger-line"></span>
            </button>
            <a href="index.html" class="site-logo"><span class="logo-text-fallback">Mind<span>news</span>ng</span></a>
            <button class="search-btn" id="searchBtn" aria-label="Search">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
        </div>
        <nav class="main-nav" id="mainNav">
            <ul>
                <li><a href="index.html" class="active">Home</a></li>
                ${NAV_PRIMARY.map(c => `<li><a href="pages/${slugify(c)}.html">${c}</a></li>`).join('\n')}
            </ul>
        </nav>
        <div class="search-overlay" id="searchOverlay">
            <div class="search-overlay-inner">
                <form id="searchForm" class="search-form">
                    <input type="text" id="searchInput" placeholder="Search news..." autocomplete="off">
                    <button type="submit" aria-label="Search">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
                    </button>
                </form>
                <div class="search-results" id="searchResults"></div>
                <button class="search-close" id="searchClose" aria-label="Close">&times;</button>
            </div>
        </div>
    </header>

    <div class="ticker">
        <div class="ticker-label">BREAKING</div>
        <div class="ticker-track"><div class="ticker-content">
            <span class="ticker-live-dot"></span>
            ${latest.slice(0, 3).map(a => `<a href="articles/${a.slug}.html">${esc(a.title)}</a>`).join('<span>&#9679;</span>\n')}
        </div></div>
    </div>

    <main class="container">
        ${adBlock('728x90')}

        <!-- BREAKING -->
        <section class="breaking-row">
            <div class="breaking-badge">BREAKING</div>
            <a href="articles/${hero1.slug}.html" class="breaking-link">${esc(hero1.title)}</a>
            <span class="breaking-time">${formatDate(hero1.date)}</span>
        </section>

        <!-- LATEST / HERO -->
        <section class="hero-section">
            <div class="hero-main">
                <a href="articles/${hero1.slug}.html" class="card card-main">
                    <div class="news-img ratio-16x9">
                        <img src="${esc(hero1.image || placeholderImg(hero1.slug))}" alt="${esc(hero1.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                        <div class="img-fallback" style="display:none">MINDNEWSNG</div>
                    </div>
                    <span class="category-tag">${esc(articleCategory(hero1))}</span>
                    <h2 class="headline-main">${esc(hero1.title)}</h2>
                    <p class="desc">${esc(hero1.description)}</p>
                    <div class="card-info">
                        <span class="info-category">${esc(articleCategory(hero1))}</span>
                        <span class="info-author">By ${esc(hero1.author)}</span>
                        <span class="info-time">${formatDate(hero1.date)}</span>
                        <span class="info-read">${readingTime(hero1)} min read</span>
                    </div>
                </a>
            </div>
            <div class="hero-main-wrapper">
                <a href="articles/${hero2.slug}.html" class="card card-main">
                    <div class="news-img ratio-16x9">
                        <img src="${esc(hero2.image || placeholderImg(hero2.slug, 400, 225))}" alt="${esc(hero2.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                        <div class="img-fallback" style="display:none">MINDNEWSNG</div>
                    </div>
                    <span class="category-tag">${esc(articleCategory(hero2))}</span>
                    <h2 class="headline-main">${esc(hero2.title)}</h2>
                    <div class="card-info">
                        <span class="info-category">${esc(articleCategory(hero2))}</span>
                        <span class="info-author">By ${esc(hero2.author)}</span>
                        <span class="info-time">${formatDate(hero2.date)}</span>
                        <span class="info-read">${readingTime(hero2)} min read</span>
                    </div>
                </a>
            </div>
        </section>

        <div class="hero-grid">
            <div class="hero-left">
                ${latest.slice(0, 3).map(a => `
                <a href="articles/${a.slug}.html" class="card card-horizontal">
                    <div class="news-img thumb">
                        <img src="${esc(a.image || placeholderImg(a.slug, 120, 80))}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                        <div class="img-fallback" style="display:none">M</div>
                    </div>
                    <h3 class="headline-sm">${esc(a.title)}</h3>
                    <div class="card-info"><span class="info-time">${formatDate(a.date)}</span><span class="info-read">${readingTime(a)} min</span></div>
                </a>`).join('\n')}
            </div>
            <div class="hero-right">
                ${latest.slice(3, 6).map(a => `
                <a href="articles/${a.slug}.html" class="card card-horizontal">
                    <div class="news-img thumb">
                        <img src="${esc(a.image || placeholderImg(a.slug, 120, 80))}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                        <div class="img-fallback" style="display:none">M</div>
                    </div>
                    <h3 class="headline-sm">${esc(a.title)}</h3>
                    <div class="card-info"><span class="info-time">${formatDate(a.date)}</span><span class="info-read">${readingTime(a)} min</span></div>
                </a>`).join('\n')}
            </div>
        </div>

        <!-- LATEST NEWS -->
        <div class="section-headline">
            <h2 class="section-title">Latest News</h2>
            <a href="pages/news.html" class="section-link">More Latest &rarr;</a>
        </div>
        <section class="featured-collection">
            ${featured.map(featuredCard).join('\n')}
        </section>

        <!-- MOST SHARED -->
        <div class="section-headline">
            <h2 class="section-title">Most Shared</h2>
        </div>
        <div class="shared-grid">
            ${mostShared.map((a, i) => {
              const cat = articleCategory(a);
              return `
              <a href="articles/${a.slug}.html" class="card shared-card">
                  <span class="shared-rank">${i + 1}</span>
                  <div class="news-img ratio-16x9">
                      <img src="${esc(a.image || placeholderImg(a.slug, 200, 120))}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                      <div class="img-fallback" style="display:none">MINDNEWSNG</div>
                  </div>
                  <h3 class="headline-sm">${esc(a.title)}</h3>
                  <div class="card-info"><span class="info-share">${115000 - i * 7300 + 3100} shares</span><span class="info-time">${formatDate(a.date)}</span></div>
              </a>`;
            }).join('\n')}
        </div>

        <!-- GUIDES & TOP LISTS -->
        <div class="section-headline">
            <h2 class="section-title">Guides &amp; Top Lists</h2>
            <a href="pages/guides.html" class="section-link">More Guides &rarr;</a>
        </div>
        <section class="featured-collection">
            ${(guidesArticles.length ? guidesArticles : guidesFallback).slice(0, 4).map(featuredCard).join('\n')}
        </section>

        <div class="two-column">
            <div class="main-column">
                ${renderCategoryBlock('Politics', politicsArticles)}
                ${adBlock('300x250')}
                ${renderCategoryBlock('Entertainment', entArticles)}
                ${adBlock('300x250')}
                ${renderCategoryBlock('Sports', sportsArticles)}
                ${adBlock('300x250')}
                ${renderCategoryBlock('Money', moneyArticles)}
            </div>
            <aside class="sidebar">
                ${adBlock('300x250')}
                <div class="section-headline sidebar-headline"><h2 class="section-title">Trending Now</h2></div>
                <div class="trending-list">
                    ${trending.map((a, i) => trendingItem(a, i)).join('\n')}
                </div>
                ${adBlock('300x250')}
                <div class="section-headline sidebar-headline"><h2 class="section-title">Most Read</h2></div>
                <div class="trending-list">
                    ${mostShared.slice(0, 5).map((a, i) => trendingItem(a, i)).join('\n')}
                </div>
                <div class="newsletter-box">
                    <h3>Get the latest news in your inbox</h3>
                    <p>Subscribe to Mindnewsng for daily updates.</p>
                    <form id="newsletterForm" class="newsletter-form">
                        <input type="email" id="newsletterEmail" placeholder="Your email address" required>
                        <button type="submit" class="btn">Subscribe</button>
                    </form>
                    <p class="form-msg" id="newsletterMsg"></p>
                </div>
            </aside>
        </div>

        ${(jobsArticles.length ? `
        <div class="section-headline">
            <h2 class="section-title">Jobs &amp; Education</h2>
            <a href="pages/jobs-education.html" class="section-link">More &rarr;</a>
        </div>
        <section class="featured-collection">
            ${jobsArticles.map(featuredCard).join('\n')}
        </section>` : '')}

        <!-- EDITORS' PICKS -->
        <div class="section-headline">
            <h2 class="section-title">Editor's Picks</h2>
        </div>
        <section class="featured-collection">
            ${editorsPicks.map(featuredCard).join('\n')}
        </section>

    </main>
    ${footer()}
    <script src="js/main.js"></script>
    <script>
      window.__ARTICLES__ = ${JSON.stringify(normalized.map(a => ({ id: a.id, title: a.title, slug: a.slug, category: a.category })))};
    </script>
</body>
</html>`;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log('  Built: index.html');
}

function renderCategoryBlock(category, articles) {
  if (!articles.length) return '';
  const slug = slugify(category);
  return `
    <div class="section-headline">
        <h2 class="section-title">${category}</h2>
        <a href="pages/${slug}.html" class="section-link">View All &rarr;</a>
    </div>
    <div class="article-column">
        ${articles.map(a => articleCard(a, 'full')).join('\n')}
    </div>`;
}

function buildCategoryPage(category, articles) {
  const slug = slugify(category);
  const catArticles = articles.filter(a => articleCategory(a) === category);
  const allArticles = catArticles.length ? catArticles : articles;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${category} - ${SITE.name}</title>
    <meta name="description" content="${esc(category)} news from Mindnewsng">
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body>
    ${header(category)}
    <main class="container page-category">
        <div class="page-hero">
            <h1>${category} News</h1>
            <p>Latest ${category.toLowerCase()} news and updates from Nigeria and around the world</p>
        </div>

        ${adBlock('728x90')}

        <div class="two-column">
            <div class="main-column">
                <div class="article-column">
                    ${allArticles.slice(0, 15).map(a => articleCard(a, 'full')).join('\n')}
                </div>
                ${allArticles.length > 15 ? '<div class="load-more-wrap"><button class="btn load-more" onclick="this.textContent=\'Loading...\';setTimeout(()=>this.textContent=\'No more articles\',1500)">Load More</button></div>' : ''}
            </div>
            <aside class="sidebar">
                ${adBlock('300x250')}
                <div class="section-headline sidebar-headline"><h2 class="section-title">Trending</h2></div>
                <div class="trending-list">
                    ${allArticles.slice(0, 5).map((a, i) => trendingItem(a, i)).join('\n')}
                </div>
                ${adBlock('300x250')}
                <div class="newsletter-box">
                    <h3>Stay Updated</h3>
                    <p>Get ${category.toLowerCase()} news in your inbox.</p>
                    <form id="newsletterForm" class="newsletter-form">
                        <input type="email" placeholder="Your email" required>
                        <button type="submit" class="btn">Subscribe</button>
                    </form>
                    <p class="form-msg" id="newsletterMsg"></p>
                </div>
            </aside>
        </div>
    </main>
    ${footer()}
    <script src="../js/main.js"></script>
    <script>
      window.__ARTICLES__ = ${JSON.stringify(articles.map(a => ({ id: a.id, title: a.title, slug: a.slug, category: a.category })))};
    </script>
</body>
</html>`;

  fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'pages', `${slug}.html`), html);
  console.log(`  Built: pages/${slug}.html`);
}

function buildArticlePage(article, allArticles) {
  const cat = articleCategory(article);
  const related = allArticles
    .filter(a => a.id !== article.id && articleCategory(a) === cat)
    .slice(0, 4);

  const breadcrumbs = [
    { label: 'Home', href: '../index.html' },
    { label: cat, href: `../pages/${slugify(cat)}.html` },
    { label: article.title },
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(article.title)} - ${SITE.name}</title>
    <meta name="description" content="${esc(article.description)}">
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body>
    ${header(cat)}
    <main class="container page-article">
        <nav class="breadcrumb" aria-label="Breadcrumb">
            ${breadcrumbs.map((b, i) => b.href
              ? `<a href="${b.href}">${esc(b.label)}</a><span class="sep">/</span>`
              : `<span class="current">${esc(b.label)}</span>`
            ).join('\n')}
        </nav>

        <article class="article-content">
            <header class="article-header">
                <span class="category-tag" style="--cat-color:${getCatColor(cat)}">${esc(cat)}</span>
                <h1>${esc(article.title)}</h1>
                <div class="article-meta">
                    <span class="meta-author">By ${esc(article.author)}</span>
                    <span class="meta-source">${esc(article.source)}</span>
                    <span class="meta-date">${formatDate(article.date)}</span>
                    <span class="meta-read">${readingTime(article)} min read</span>
                </div>
            </header>

            <div class="article-featured-img">
                <img src="${esc(article.image || placeholderImg(article.id, 800, 450))}" alt="${esc(article.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                <div class="img-fallback article-img-fb" style="display:none">MINDNEWSNG</div>
            </div>

            <div class="article-body">
                <p class="lead">${esc(article.description)}</p>
                <p>This is the full article content for: <strong>${esc(article.title)}</strong>. In a production environment, the full article text would be pulled from the RSS feed or your CMS.</p>
                <p>Nigerian news readers turn to Mindnewsng for trusted, accurate, and timely reporting on the stories that matter most. Our editorial team works around the clock to bring you verified information.</p>
                <p>The story continues to develop as more details emerge. Stay with Mindnewsng for the latest updates on this developing story.</p>
                <h2>Key Takeaways</h2>
                <ul>
                    <li>This story is developing and will be updated</li>
                    <li>Follow Mindnewsng for breaking news alerts</li>
                    <li>Share this story with friends and family</li>
                </ul>
                <p>Bookmark Mindnewsng and check back regularly for the latest updates on this and other important stories affecting Nigeria and Nigerians worldwide.</p>
            </div>

            <div class="article-share">
                <span>Share this story:</span>
                <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}" target="_blank" rel="noopener" class="share-btn share-x">X</a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(article.url)}" target="_blank" rel="noopener" class="share-btn share-fb">FB</a>
                <a href="https://wa.me/?text=${encodeURIComponent(article.title + ' ' + article.url)}" target="_blank" rel="noopener" class="share-btn share-wa">WA</a>
            </div>

            ${adBlock('300x250')}

            <section class="related-articles">
                <h2>Related Articles</h2>
                <div class="related-grid">
                    ${related.map(a => `
                    <a href="${a.slug}.html" class="card article-card">
                        <div class="news-img ratio-16x9">
                            <img src="${esc(a.image || placeholderImg(a.id, 300, 169))}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                            <div class="img-fallback" style="display:none">MINDNEWSNG</div>
                        </div>
                        <span class="category-tag">${esc(articleCategory(a))}</span>
                        <h3 class="headline">${esc(a.title)}</h3>
                        <div class="card-info"><span class="info-time">${formatDate(a.date)}</span></div>
                    </a>`).join('\n')}
                </div>
            </section>
        </article>
    </main>
    ${footer()}
    <script src="../js/main.js"></script>
    <script>window.__ARTICLES__ = ${JSON.stringify(allArticles.map(a => ({ id: a.id, title: a.title, slug: a.slug, category: a.category })))};</script>
</body>
</html>`;

  fs.mkdirSync(path.join(OUT, 'articles'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'articles', `${article.slug}.html`), html);
}

function buildStaticPages() {
  const about = `<!DOCTYPE html>
<html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - ${SITE.name}</title>
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css">
</head><body>
    <header class="site-header"><div class="header-top">
        <button class="burger-btn" id="burgerBtn" aria-label="Menu"><span class="burger-line"></span><span class="burger-line"></span><span class="burger-line"></span></button>
        <a href="index.html" class="site-logo"><span class="logo-text-fallback">Mind<span>news</span>ng</span></a>
        <button class="search-btn" id="searchBtn" aria-label="Search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg></button>
    </div></header>
    <main class="container page-static">
        <h1>About Mindnewsng</h1>
        <p>Mindnewsng is a leading Nigerian digital newspaper committed to delivering accurate, timely, and comprehensive news coverage.</p>
        <p>Founded with the mission to keep Nigerians informed, we cover politics, business, entertainment, sports, technology, health, lifestyle and world news.</p>
        <h2>Our Mission</h2>
        <p>To provide truthful, balanced, and independent journalism that empowers Nigerians with the information they need to make informed decisions.</p>
        <h2>Contact Us</h2>
        <p>Email: <a href="mailto:${SITE.email}">${SITE.email}</a></p>
        <p>Phone: <a href="tel:${SITE.phone}">${SITE.phone}</a></p>
    </main>
    ${footer()}
    <script src="js/main.js"></script>
</body></html>`;

  const contact = `<!DOCTYPE html>
<html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact - ${SITE.name}</title>
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css">
</head><body>
    <header class="site-header"><div class="header-top">
        <button class="burger-btn" id="burgerBtn" aria-label="Menu"><span class="burger-line"></span><span class="burger-line"></span><span class="burger-line"></span></button>
        <a href="index.html" class="site-logo"><span class="logo-text-fallback">Mind<span>news</span>ng</span></a>
        <button class="search-btn" id="searchBtn" aria-label="Search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg></button>
    </div></header>
    <main class="container page-static">
        <h1>Contact Us</h1>
        <p>Have a story tip, correction, or inquiry? Reach out to us:</p>
        <p>Email: <a href="mailto:${SITE.email}">${SITE.email}</a></p>
        <p>Phone: <a href="tel:${SITE.phone}">${SITE.phone}</a></p>
        <p>We respond to all enquiries within 24 hours.</p>
    </main>
    ${footer()}
    <script src="js/main.js"></script>
</body></html>`;

  const privacy = `<!DOCTYPE html>
<html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - ${SITE.name}</title>
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css">
</head><body>
    <header class="site-header"><div class="header-top">
        <button class="burger-btn" id="burgerBtn" aria-label="Menu"><span class="burger-line"></span><span class="burger-line"></span><span class="burger-line"></span></button>
        <a href="index.html" class="site-logo"><span class="logo-text-fallback">Mind<span>news</span>ng</span></a>
        <button class="search-btn" id="searchBtn" aria-label="Search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg></button>
    </div></header>
    <main class="container page-static">
        <h1>Privacy Policy</h1>
        <p>Mindnewsng respects your privacy. We collect minimal data to improve our service and do not sell personal information to third parties.</p>
        <h2>Cookies</h2>
        <p>We use cookies for analytics and advertising purposes. You can control cookie settings in your browser.</p>
        <h2>Data Collection</h2>
        <p>We collect only the data necessary to provide our service, including email addresses for newsletter subscribers.</p>
    </main>
    ${footer()}
    <script src="js/main.js"></script>
</body></html>`;

  const terms = `<!DOCTYPE html>
<html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms of Service - ${SITE.name}</title>
    <meta name="theme-color" content="#02b290">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css">
</head><body>
    <header class="site-header"><div class="header-top">
        <button class="burger-btn" id="burgerBtn" aria-label="Menu"><span class="burger-line"></span><span class="burger-line"></span><span class="burger-line"></span></button>
        <a href="index.html" class="site-logo"><span class="logo-text-fallback">Mind<span>news</span>ng</span></a>
        <button class="search-btn" id="searchBtn" aria-label="Search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg></button>
    </div></header>
    <main class="container page-static">
        <h1>Terms of Service</h1>
        <p>By using Mindnewsng, you agree to these terms. Our content is provided for informational purposes.</p>
        <h2>Content</h2>
        <p>All content on Mindnewsng is protected by copyright. Reproduction without permission is prohibited.</p>
    </main>
    ${footer()}
    <script src="js/main.js"></script>
</body></html>`;

  fs.writeFileSync(path.join(OUT, 'about.html'), about);
  fs.writeFileSync(path.join(OUT, 'contact.html'), contact);
  fs.writeFileSync(path.join(OUT, 'privacy.html'), privacy);
  fs.writeFileSync(path.join(OUT, 'terms.html'), terms);
  console.log('  Built: about.html, contact.html, privacy.html, terms.html');
}

function copyAssets() {
  // Copy CSS
  if (fs.existsSync(CSS_SRC)) {
    fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
    fs.copyFileSync(CSS_SRC, path.join(OUT, 'css', 'styles.css'));
  }

  // Copy JS
  if (fs.existsSync(JS_SRC)) {
    fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
    fs.copyFileSync(JS_SRC, path.join(OUT, 'js', 'main.js'));
  }

  console.log('  Copied assets (css, js)');
}

// ─── Main ─────────────────────────────────────────────────────────

function main() {
  console.log('MindnewsNG Static Site Generator');
  console.log('='.repeat(45));

  const articles = getArticles();
  console.log(`\nGenerating site from ${articles.length} articles...\n`);

  // Clean output
  if (fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true });
  }

  // Build
  copyAssets();
  buildIndex(articles);

  // Category pages
  const usedCategories = [...new Set(articles.map(a => articleCategory(a)))];
  const allCats = [...new Set([...usedCategories, ...CATEGORIES])];
  for (const cat of allCats) {
    buildCategoryPage(cat, articles);
  }

  // Article pages
  fs.mkdirSync(path.join(OUT, 'articles'), { recursive: true });
  for (const article of articles) {
    buildArticlePage(article, articles);
  }
  console.log(`  Built: ${articles.length} article pages`);

  // Static pages
  buildStaticPages();

  // SEO
  buildSeoPages(articles);

  console.log(`\nDone! Site generated in: ${path.relative(process.cwd(), OUT)}`);
  console.log('Run: npm run dev   to preview locally');
}

main();
