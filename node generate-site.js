const https = require('https');
const fs = require('fs');
const path = require('path');

// RSS feeds convert කරන API
const FEEDS = [
  'https://api.rss2json.com/v1/api.json?rss_url=https://www.lankacnews.com/feeds/posts/default?alt=rss',
  'https://api.rss2json.com/v1/api.json?rss_url=https://www.adaderana.lk/rss.php'
];

const SITE_BASE = 'https://shalindadinith-lang.github.io/-sinhala-news/';
const ARTICLES_DIR = './articles';
const DEFAULT_IMAGE = 'https://i.ibb.co/0VpHq4t/news-default.png';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// හොඳ image URL එකක් හොයන function එක
function getGoodImage(item) {
  if (item.description) {
    const match = item.description.match(/<img[^>]+src="([^">]+)"/i);
    if (match && match[1]) return match[1];
  }
  if (item.thumbnail) {
    // s1600, s800, s600, s400 try කරන්න
    const sizes = ['s1600', 's800', 's600', 's400'];
    for (let size of sizes) {
      const candidate = item.thumbnail.replace(/s\d+(-c)?/, size);
      if (candidate !== item.thumbnail) return candidate;
    }
    return item.thumbnail;
  }
  return DEFAULT_IMAGE;
}

function slugify(text) {
  // simple slug for filename
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 50);
}

async function main() {
  // fetch all feeds
  let items = [];
  for (let feed of FEEDS) {
    try {
      const json = await fetchJSON(feed);
      if (json.items) items = items.concat(json.items);
    } catch(e) { console.error('Feed fail:', feed); }
  }

  // remove duplicates
  const uniqueMap = new Map();
  items.forEach(i => { if (!uniqueMap.has(i.link)) uniqueMap.set(i.link, i); });
  let articles = Array.from(uniqueMap.values());
  articles.sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate));

  // create articles directory
  if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR);

  // read article template
  const template = fs.readFileSync('./article-template.html', 'utf8');

  // prepare data for articles.json and RSS
  let articlesList = [];
  let rssItems = '';

  articles.slice(0, 30).forEach(article => {
    const id = slugify(article.title) + '-' + Date.now().toString(36);
    const title = article.title;
    const desc = (article.description || '').replace(/<[^>]*>/g, '').substring(0, 300);
    const image = getGoodImage(article);
    const pubDate = new Date(article.pubDate).toUTCString();
    const dateFormatted = new Date(article.pubDate).toLocaleDateString('si-LK');
    const source = article.link.includes('lankacnews') ? 'Lanka C News' : 'Ada Derana';
    const articleUrl = SITE_BASE + 'articles/' + id + '.html';

    // Fill template
    let articleHTML = template
      .replace(/{{TITLE}}/g, title)
      .replace(/{{DESCRIPTION}}/g, desc)
      .replace(/{{IMAGE}}/g, image)
      .replace(/{{URL}}/g, articleUrl)
      .replace(/{{DATE}}/g, dateFormatted)
      .replace(/{{SOURCE}}/g, source)
      .replace(/{{CONTENT}}/g, article.description || '');

    // Write article HTML file
    fs.writeFileSync(path.join(ARTICLES_DIR, id + '.html'), articleHTML);

    // Add to articles list for index page
    articlesList.push({
      id: id,
      title: title,
      date: dateFormatted,
      source: source,
      image: image,
      link: articleUrl
    });

    // RSS item
    rssItems += `
    <item>
      <title>${title.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</title>
      <link>${articleUrl}</link>
      <description>${desc.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</description>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${image}" type="image/jpeg" />
    </item>`;
  });

  // Write articles.json (for index page)
  fs.writeFileSync('articles.json', JSON.stringify(articlesList, null, 2));

  // Write RSS feed
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI News Lanka</title>
    <link>${SITE_BASE}</link>
    <description>AI බලයෙන් සිංහල පුවත්</description>
    <language>si</language>
    ${rssItems}
  </channel>
</rss>`;
  fs.writeFileSync('rss.xml', rss);

  console.log('Site generated successfully!');
}

main();