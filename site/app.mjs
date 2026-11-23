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

export function sortByCutoff(offices, taiwan, year, showExpired = false, now = new Date()) {
  const today = taipeiDate.format(now);
  const entries = offices.map(office => {
    const date = airmailCutoff(office, taiwan, year);
    const group = !date ? 1 : date < today ? 2 : 0;
    return {office, date, group};
  });
  return entries
    .filter(entry => showExpired || entry.group !== 2)
    .sort((a, b) => a.group - b.group || (a.group === 1 ? 0 :
      a.group === 2 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
    .map(entry => entry.office);
}

export function matches(office, season, query, reply, {shipping, activity} = {}) {
  if (shipping && (season?.shipping ?? 'check') !== shipping) return false;
  if (activity && (season?.activity ?? 'pending') !== activity) return false;
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
  if (office.cutoffRegional || office.cutoffRegion?.endsWith('地區')) line.append('（區域參考）');
  box.append(line);
  return box;
}

function renderCard(office, season, taiwan, year, now) {
  const card = element('article', '', 'card');
  const title = office.name.startsWith(office.country) ? office.name : office.country + '・' + office.name;
  card.append(element('h3', title), renderCutoff(office, taiwan, year, now));
  if (season) {
    const address = element('address', season.address.join('\n'));
    card.append(address);
    const restriction = season.restriction ?? season.addressNote ?? (office.id === "at" ? "海外寄件須附國際回郵券及寫妥地址的回郵信封。" : null);
    if (restriction) card.append(element('p', restriction));
    if (season.address.length) {
      const button = element('button', '複製地址');
      button.type = 'button';
      button.setAttribute('aria-label', '複製' + title + '地址');
      const status = element('div');
      status.setAttribute('role', 'status');
      button.addEventListener('click', () => copyAddress(address, button, status));
      card.append(button, status);
    }
  }

  return card;
}

export function pickRecommendation(offices, year, previousId, random = Math.random) {
  const eligible = offices.filter(office => {
    const season = office.seasons[year];
    return season?.address?.length && !season.addressNote && !season.referenceOnly;
  });
  const alternatives = eligible.filter(office => office.id !== previousId);
  const pool = alternatives.length ? alternatives : eligible;
  return pool[Math.floor(random() * pool.length)];
}

async function start() {
  const [catalog, additional] = await Promise.all(['catalog', 'extra-addresses'].map(async file => {
    const response = await fetch('./data/' + file + '.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }));
  const data = {...catalog, offices: [...catalog.offices, ...additional]};
  const year = byId('year');
  const current = taipeiDate.format(new Date()).slice(0, 4);
  const years = [...new Set([current, ...Object.keys(data.taiwan),
    ...data.offices.flatMap(office => Object.keys(office.seasons))])].sort().reverse();
  const requested = new URL(location.href).searchParams.get('year');
  for (const value of years) year.append(new Option(value + ' 年', value));
  year.value = years.includes(requested) ? requested : current;
  const showExpired = byId('show-expired');
  const shipping = byId('shipping');
  const activity = byId('activity');
  const render = (now = new Date()) => {
    const query = byId('search').value;
    const filters = {shipping: shipping.value, activity: activity.value};
    const matching = data.offices.filter(office => {
      const season = office.seasons[year.value];
      return season && matches(office, season, query, '', filters);
    });
    const offices = sortByCutoff(matching, data.taiwan[year.value], year.value, showExpired.checked, now);
    byId('results').textContent = offices.length ? offices.length + ' 間郵局' : '找不到符合條件的郵局。';
    const selected = year.value;
    byId('cards').replaceChildren(...offices.map(office =>
      renderCard(office, office.seasons[selected], data.taiwan[selected], selected, now)));
  };
  const search = byId('search');
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
      recommended, recommended.seasons[selected], data.taiwan[selected], selected, now
    ));
  };
  const recommend = () => {
    recommended = pickRecommendation(sortByCutoff(data.offices, data.taiwan[year.value], year.value), year.value, recommended?.id);
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
  const renderAll = () => {
    const now = new Date();
    render(now);
    renderRecommendation(now);
    return taipeiDate.format(now);
  };
  search?.addEventListener('input', () => render());
  for (const control of [showExpired, shipping, activity]) {
    control.addEventListener('change', () => render());
  }
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
  const message = byId('results');
  message.textContent = '資料載入失敗，請重新整理網頁。';
});
