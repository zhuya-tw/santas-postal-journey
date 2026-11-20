import {addPostage} from './postage.mjs?v=1';

const byId = id => document.getElementById(id);
const normalize = value => value.normalize('NFKC').toLowerCase().trim();
const taipeiDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Taipei',
  year: 'numeric', month: '2-digit', day: '2-digit'});
const DAY_MS = 86_400_000;

export function cutoffStatus(date, now = new Date()) {
  const today = taipeiDate.format(now);
  const remaining = (Date.parse(date) - Date.parse(today)) / DAY_MS;
  if (date.slice(0, 4) < today.slice(0, 4)) return '歷年資料';
  if (remaining === 0) return '今天截郵';
  return remaining > 0 ? '還有 ' + remaining + ' 天' : '已過 ' + Math.abs(remaining) + ' 天';
}

export function airmailCutoff(office, taiwan, year) {
  const date = taiwan?.rows.find(([region]) => region === office.cutoffRegion)?.[1];
  return date ? year + '-' + date : null;
}

export function matches(office, season, query, reply) {
  const visible = [office.country, office.name, ...office.keywords, ...(season?.address ?? [])];
  return (!reply || season?.replyType === reply) &&
    normalize(query).split(/\s+/).every(term => normalize(visible.join(' ')).includes(term));
}

async function copyAddress(address, button, status) {
  try {
    await navigator.clipboard.writeText(address.textContent);
    status.textContent = '已複製地址';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(address);
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = '已選取地址，請使用裝置的複製功能。';
  }
  button.setAttribute('aria-describedby', status.id);
}

function element(tag, value, cls) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (cls) node.className = cls;
  return node;
}

function link(label, url) {
  const node = element('a', label);
  node.href = url;
  return node;
}

function renderCutoff(office, taiwan, year, now) {
  const box = element('div', '', 'cutoff');
  box.append(element('strong', '台灣截郵｜聖誕・航空函件'));
  const date = airmailCutoff(office, taiwan, year);
  if (!date) {
    box.append(element('div', taiwan ? '這個目的地的適用日期待確認' : '這個年度尚無已查核的截郵表'));
    return box;
  }
  const time = element('time', date);
  time.dateTime = date;
  const line = element('div');
  line.append(time, ' · ', cutoffStatus(date, now));
  const label = office.cutoffRegional ? '中華郵政區域參考：' : '中華郵政：';
  box.append(line, link(label + office.cutoffRegion, taiwan.pdf));
  return box;
}

function renderCard(office, season, taiwan, year, now, copyPrefix = 'copy-') {
  const card = element('article', '', 'card');
  card.append(element('div', office.country, 'meta'), element('h3', office.name));
  const cutoff = renderCutoff(office, taiwan, year, now);
  if (!season) {
    card.append(cutoff, element('p', '這個年度尚無已查核的郵局資料。'));
    return card;
  }
  const address = element('address', season.address.join('\n'));
  const button = element('button', '複製地址');
  button.type = 'button';
  button.disabled = Boolean(season.addressNote);
  button.setAttribute('aria-label', '複製' + office.name + '地址');
  const status = element('div', '', 'meta');
  status.id = copyPrefix + office.id;
  status.setAttribute('role', 'status');
  button.addEventListener('click', () => copyAddress(address, button, status));
  card.append(cutoff);
  const addressMessage = season.addressNote ?? season.addressAdvice;
  if (addressMessage) card.append(element('p', addressMessage));
  card.append(address, button, status, element('p', season.reply), element('p',
    '當地活動期限：' + (season.deadline ? season.deadline + '（' + season.deadlineNote + '）' : '未列經查核的年度日期')));
  const sources = element('ul');
  for (const source of season.sources) {
    const item = element('li');
    item.append(link(source.label, source.url));
    sources.append(item);
  }
  addPostage(address, office.country);
  card.append(sources, element('p', '查核日 ' + season.checked, 'meta'));
  return card;
}

function renderTaiwan(taiwan, year, now) {
  const citation = byId('tw-source');
  const container = byId('table');
  citation.replaceChildren();
  container.replaceChildren();
  if (!taiwan) {
    citation.textContent = year + ' 年尚無已查核的中華郵政截郵表。';
    return;
  }
  citation.append(link(year + ' 年官方公告', taiwan.source), ' · ', link('原始 PDF', taiwan.pdf));
  const scroll = element('div', '', 'table-scroll');
  const table = element('table');
  table.setAttribute('aria-label', year + ' 年中華郵政截郵日期');
  const header = table.createTHead().insertRow();
  for (const title of ['洲別', '寄達地區', '聖誕・航空函件']) {
    const cell = element('th', title);
    cell.scope = 'col';
    header.append(cell);
  }
  const groups = new Map([['香港', '亞洲'], ['法國、德國', '歐洲'], ['美國', '美洲'],
    ['南非', '非洲'], ['澳大利亞', '大洋洲']]);
  let body;
  let continent;
  for (const [region, date] of taiwan.rows) {
    if (!body || groups.has(region)) {
      body = table.createTBody();
      continent = element('th', groups.get(region) ?? '');
      continent.scope = 'rowgroup';
      continent.className = 'continent';
    }
    const row = body.insertRow();
    if (body.rows.length === 1) row.append(continent);
    continent.rowSpan = body.rows.length;
    const label = element('th', region);
    label.scope = 'row';
    row.append(label);
    const time = element('time', date.replace('-', '/'));
    time.dateTime = year + '-' + date;
    row.insertCell().append(time, ' · ', cutoffStatus(time.dateTime, now));
  }
  scroll.append(table);
  container.append(scroll);
}

export function pickRecommendation(offices, year, previousId, random = Math.random) {
  const eligible = offices.filter(office => {
    const season = office.seasons[year];
    return season?.address?.length && !season.addressNote;
  });
  const alternatives = eligible.filter(office => office.id !== previousId);
  const pool = alternatives.length ? alternatives : eligible;
  return pool[Math.floor(random() * pool.length)];
}

async function start() {
  const response = await fetch('./data/catalog.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error('Catalog unavailable');
  const data = await response.json();
  const year = byId('year');
  const current = taipeiDate.format(new Date()).slice(0, 4);
  const years = [...new Set([current, ...Object.keys(data.taiwan),
    ...data.offices.flatMap(office => Object.keys(office.seasons))])].sort().reverse();
  const requested = new URL(location.href).searchParams.get('year');
  for (const value of years) year.append(new Option(value + ' 年', value));
  year.value = years.includes(requested) ? requested : current;
  const render = (now = new Date()) => {
    const query = byId('search').value;
    const reply = byId('reply').value;
    const offices = data.offices.filter(office => matches(office, office.seasons[year.value], query, reply));
    byId('results').textContent = offices.length ? offices.length + ' 間郵局' : '找不到符合條件的郵局。';
    const selected = year.value;
    byId('cards').replaceChildren(...offices.map(office =>
      renderCard(office, office.seasons[selected], data.taiwan[selected], selected, now)));
  };
  const search = byId('search');
  const reply = byId('reply');
  const randomButton = byId('random-address');
  const recommendation = byId('recommendation');
  const recommendedCard = byId('recommended-card');
  const anotherAddress = byId('another-address');
  let recommended;
  const setRecommendationVisible = visible => {
    if (!recommendation) return;
    recommendation.hidden = !visible;
    randomButton.setAttribute('aria-expanded', String(visible));
  };
  const renderRecommendation = (now = new Date()) => {
    if (!recommended || recommendation.hidden) return;
    const selected = year.value;
    recommendedCard.replaceChildren(renderCard(
      recommended, recommended.seasons[selected], data.taiwan[selected], selected, now, 'recommend-copy-'
    ));
  };
  const recommend = () => {
    recommended = pickRecommendation(data.offices, year.value, recommended?.id);
    setRecommendationVisible(true);
    anotherAddress.hidden = !recommended;
    if (recommended) renderRecommendation();
    else recommendedCard.replaceChildren(element('p', '這個年度還沒有可推薦的地址，請切換年份。'));
    byId('recommendation-heading').focus({preventScroll: true});
    recommendation.scrollIntoView({block: 'start'});
  };
  if (randomButton) randomButton.disabled = false;
  randomButton?.addEventListener('click', recommend);
  anotherAddress?.addEventListener('click', recommend);
  byId('close-recommendation')?.addEventListener('click', () => {
    setRecommendationVisible(false);
    randomButton.focus();
  });
  const yearLinks = document.querySelectorAll('[data-year-link]');
  const renderAll = () => {
    const now = new Date();
    if (search) render(now);
    else renderTaiwan(data.taiwan[year.value], year.value, now);
    renderRecommendation(now);
    for (const link of yearLinks) {
      const url = new URL(link.href);
      url.searchParams.set('year', year.value);
      link.href = url;
    }
    return taipeiDate.format(now);
  };
  search?.addEventListener('input', () => render());
  reply?.addEventListener('change', () => render());
  year.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('year', year.value);
    history.replaceState(null, '', url);
    recommended = undefined;
    setRecommendationVisible(false);
    renderedDate = renderAll();
  });
  let renderedDate = renderAll();
  const refreshDate = () => {
    if (taipeiDate.format(new Date()) !== renderedDate) renderedDate = renderAll();
  };
  window.setInterval(refreshDate, 60_000);
  document.addEventListener('visibilitychange', refreshDate);
}

if (typeof document !== 'undefined') start().catch(() => {
  const message = byId('results') ?? byId('tw-source');
  message.textContent = '資料載入失敗，請重新整理網頁。';
});
