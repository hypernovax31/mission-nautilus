/**
 * Regenere toutes les icones PNG a partir de la source unique assets/icon.svg.
 *
 *   npm install sharp
 *   node tools/generate-icons.mjs
 *
 * Sorties :
 *   favicon-16.png / favicon-32.png  -> favicon de repli (sans texte, zoome)
 *   apple-touch-icon.png (180)       -> ecran d'accueil iOS (fond opaque)
 *   icon-192.png / icon-512.png      -> manifest, purpose "any"
 *   icon-maskable-512.png            -> manifest, purpose "maskable" (Android adaptive)
 *
 * Apres regeneration, penser a bumper CACHE_NAME dans sw.js.
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const BG = '#020812'; // = background_color du manifest
const svg = readFileSync(join(ASSETS, 'icon.svg'), 'utf8');

const defs = svg.match(/<defs>[\s\S]*<\/defs>/)[0];
const body = (src) =>
  src.match(/<\/defs>([\s\S]*)<\/svg>/)[1]
     .replace(/<rect width="512" height="512" rx="100" fill="url\(#bg\)"\/>/, '');

const wrap = (inner, rounded = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
${defs}
<rect width="512" height="512"${rounded ? ' rx="100"' : ''} fill="url(#bg)"/>
${inner}
</svg>`;

// Maskable : contenu resserre dans les 78 % centraux (zone sure Android), fond bord a bord
const S = 0.78;
const OFF = (512 * (1 - S)) / 2;
const maskable = wrap(`<g transform="translate(${OFF} ${OFF}) scale(${S})">${body(svg)}</g>`, false);

// Favicon : le texte "NAUTILUS" est illisible sous 48px -> on le retire et on zoome la coque
const favicon = wrap(
  `<g transform="translate(256 300) scale(1.28) translate(-256 -270)">${
    body(svg.replace(/<!-- Texte -->[\s\S]*?<\/text>/, ''))
  }</g>`
);

const render = (src, size) => sharp(Buffer.from(src), { density: 1600 }).resize(size, size);
const png = { compressionLevel: 9 };

await Promise.all([
  render(svg, 192).png(png).toFile(join(ASSETS, 'icon-192.png')),
  render(svg, 512).png(png).toFile(join(ASSETS, 'icon-512.png')),
  render(favicon, 16).png(png).toFile(join(ASSETS, 'favicon-16.png')),
  render(favicon, 32).png(png).toFile(join(ASSETS, 'favicon-32.png')),
  // iOS ignore la transparence et l'affiche en noir -> on aplatit sur le fond
  render(svg, 180).flatten({ background: BG }).png(png).toFile(join(ASSETS, 'apple-touch-icon.png')),
  render(maskable, 512).flatten({ background: BG }).png(png).toFile(join(ASSETS, 'icon-maskable-512.png')),
]);

console.log('Icones regenerees depuis assets/icon.svg');
