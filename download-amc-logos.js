#!/usr/bin/env node
/**
 * Run once: node download-amc-logos.js
 * Downloads AMC logos from Bajaj Finserv CDN into public/amc-logos/
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, 'public', 'amc-logos');
const BASE = 'https://apis-marketplace.bajajfinserv.in/mf/static/kbprofiles/amc';

const LOGOS = [
  ['hdfc',          'hdfc.png'],
  ['sbi',           'SBIMF.png'],
  ['icici',         'ICICI.png'],
  ['quant',         'Quant_logo.png'],
  ['axis',          'Axis.png'],
  ['kotak',         'kotak_mutual_fund.png'],
  ['nippon',        'nippon_mutual_fund.png'],
  ['mirae',         'mirale.png'],
  ['dsp',           'DSP.png'],
  ['tata',          'tata.png'],
  ['franklin',      'franklin_mutual_fund.jpg'],
  ['motilal',       'motilal.png'],
  ['robeco',        'robeco.png'],
  ['aditya_birla',  'Aditya_Birla.png'],
  ['parag',         'ppfas.png'],
  ['jm',            'JM_financial.png'],
  ['uti',           'uti.png'],
];

fs.mkdirSync(DIR, { recursive: true });

function download(name, file) {
  return new Promise((resolve) => {
    const ext = file.split('.').pop();
    const dest = path.join(DIR, `${name}.${ext}`);

    function get(url) {
      const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          console.error(`✗ ${name}: HTTP ${res.statusCode}`);
          resolve(); return;
        }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => { console.log(`✓ ${name}`); resolve(); });
        out.on('error', (e) => { console.error(`✗ ${name}: ${e.message}`); resolve(); });
      });
      req.on('error', (e) => { console.error(`✗ ${name}: ${e.message}`); resolve(); });
      req.setTimeout(10000, () => { req.destroy(); console.error(`✗ ${name}: timeout`); resolve(); });
    }

    get(`${BASE}/${file}`);
  });
}

console.log(`Downloading ${LOGOS.length} AMC logos to ${DIR}\n`);
for (const [name, file] of LOGOS) {
  await download(name, file);
}
console.log('\nDone. Logos saved to public/amc-logos/');
