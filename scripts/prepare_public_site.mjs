import {cpSync, readFileSync, writeFileSync} from 'node:fs';

cpSync('site', 'public-site', {recursive: true});
const path = 'public-site/data/catalog.json';
const catalog = JSON.parse(readFileSync(path, 'utf8'));
const regions = new Set([...catalog.offices,
  ...JSON.parse(readFileSync('site/data/extra-addresses.json', 'utf8'))].map(office => office.cutoffRegion));
const offices = catalog.offices.map(({id, country, name, keywords, cutoffRegion, cutoffRegional, seasons}) => ({
  id, country, name, keywords, cutoffRegion, cutoffRegional,
  seasons: Object.fromEntries(Object.entries(seasons).map(([year, {address, addressNote, restriction, shipping, activity}]) =>
    [year, {address, addressNote, restriction, shipping, activity}]))
}));
const taiwan = Object.fromEntries(Object.entries(catalog.taiwan).map(([year, {rows}]) =>
  [year, {rows: rows.filter(([region]) => regions.has(region)).map(([region, date]) => [region, date])}]));
writeFileSync(path, JSON.stringify({offices, taiwan}));

