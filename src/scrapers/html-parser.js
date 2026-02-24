import * as cheerio from 'cheerio';
import { getCollectionName } from '../utils/file-categorizer.js';

export function extractDateDirectories(html) {
  const $ = cheerio.load(html);
  const directories = [];

  $('a').each((_, element) => {
    const href = $(element).attr('href');
    
    if (href && /^\d{4}-\d{2}-\d{2}\/$/.test(href)) {
      directories.push(href.slice(0, -1));
    }
  });

  return directories.sort();
}

export function extractZipFiles(html, baseUrl) {
  const $ = cheerio.load(html);
  const files = [];

  $('tr').each((_, row) => {
    const linkElement = $(row).find('a');
    const href = linkElement.attr('href');
    
    const sizeText = $(row).find('td').eq(3).text().trim();

    if (href && href.endsWith('.zip')) {
      const collection = getCollectionName(href);

      if (collection) {
        files.push({
          fileName: href,
          url: `${baseUrl.replace(/\/$/, '')}/${href}`,
          size: sizeText,
          collection: collection
        });
      }
    }
  });

  return files;
}