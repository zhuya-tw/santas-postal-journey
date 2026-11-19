const tariff = 'https://www.post.gov.tw/post/internet/Postal/index.jsp?ID=2020204';
const rates = {
  hongKongMacau: {letter: 9, grams: 20, postcard: 6},
  asiaOceania: {letter: 13, grams: 10, postcard: 10},
  europeAfricaLatinAmerica: {letter: 17, grams: 10, postcard: 12},
  usCanada: {letter: 15, grams: 10, postcard: 11}
};

const zones = {
  香港: 'hongKongMacau', 澳門: 'hongKongMacau',
  澳洲: 'asiaOceania', 紐西蘭: 'asiaOceania',
  加拿大: 'usCanada', 美國: 'usCanada',
  斯洛伐克: 'europeAfricaLatinAmerica', 法國: 'europeAfricaLatinAmerica',
  德國: 'europeAfricaLatinAmerica', 瑞典: 'europeAfricaLatinAmerica',
  芬蘭: 'europeAfricaLatinAmerica', 奧地利: 'europeAfricaLatinAmerica',
  荷蘭: 'europeAfricaLatinAmerica', 挪威: 'europeAfricaLatinAmerica',
  英國: 'europeAfricaLatinAmerica', 白俄羅斯: 'europeAfricaLatinAmerica',
  俄羅斯: 'europeAfricaLatinAmerica', 丹麥: 'europeAfricaLatinAmerica'
};

export function postageFor(country) {
  return rates[zones[country]] ?? null;
}

export function addPostage(address, country) {
  const rate = postageFor(country);
  if (!rate) return;
  const box = document.createElement('div');
  box.className = 'address-box';
  const postage = document.createElement('div');
  postage.className = 'postage';
  postage.append('台灣寄出普通航空郵資');
  const amounts = document.createElement('div');
  amounts.textContent = '信函（≤' + rate.grams + ' 公克）NT$' + rate.letter +
    ' ／ 明信片 NT$' + rate.postcard;
  const source = document.createElement('a');
  source.href = tariff;
  source.textContent = '中華郵政資費表';
  postage.append(amounts, source);
  address.before(box);
  box.append(address, postage);
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('address[data-postage-country]').forEach(address =>
    addPostage(address, address.dataset.postageCountry));
}
