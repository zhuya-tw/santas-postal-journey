"""Inspect official sources. Only validated first-time Taiwan tables can be published."""
import argparse
import hashlib
import io
import json
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "site/data/catalog.json"
CONFIG = ROOT / "config/sources.json"
TW = "www.post.gov.tw"
HOSTS = {TW, "www.canadapost-postescanada.ca", "www.deutschepost.de",
         "my.posti.fi", "www.laposte.fr", "api.boutique.laposte.fr", "www.post.at",
         "shop.deutschepost.de"}
LIMIT = 8_000_000
DATE = r"(?:11|12)/[0-3]?\d"

def safe_url(url, hosts):
    parsed = urlsplit(url)
    return (parsed.scheme == "https" and parsed.netloc.lower() in hosts
            and not parsed.fragment)

def fetch(url, hosts, allowed_types):
    if not safe_url(url, hosts):
        raise ValueError("URL outside the official allowlist")

    class Redirect(HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            if not safe_url(newurl, hosts):
                raise ValueError("Redirect outside the official allowlist")
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    request = Request(url, headers={"User-Agent": "SantaPostalJourney/1.0 (official-source monitor)"})
    with build_opener(Redirect()).open(request, timeout=15) as response:
        if response.headers.get_content_type() not in allowed_types:
            raise ValueError("Unexpected content type")
        body = response.read(LIMIT + 1)
        if not body or len(body) > LIMIT:
            raise ValueError("Unexpected response size")
        return body, response.headers.get_content_charset() or "utf-8"

class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links, self.parts = [], []
        self.anchor = None
        self.hidden = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "template"}:
            self.hidden += 1
        if tag == "a" and not self.hidden:
            attributes = dict(attrs)
            self.anchor = (attributes.get("href") or "", [attributes.get("title") or ""])

    def handle_endtag(self, tag):
        if tag in {"script", "style", "template"} and self.hidden:
            self.hidden -= 1
        if tag == "a" and self.anchor is not None:
            href, words = self.anchor
            self.links.append((href, " ".join(words)))
            self.anchor = None

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)
            if self.anchor is not None:
                self.anchor[1].append(data)

    @property
    def text(self):
        return " ".join(" ".join(self.parts).split())

def page(url, hosts):
    body, encoding = fetch(url, hosts, {"text/html"})
    return Page(body.decode(encoding))

def compact(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value))

def is_announcement(value, year):
    return f"公告{year - 1911}年寄往各國(地區)耶誕節及新年郵件截郵日期" in compact(value)

def find_announcements(document, base, year):
    found = {}
    for href, label in document.links:
        url = urljoin(base, href)
        if not safe_url(url, {TW}) or not is_announcement(label, year):
            continue
        parsed = urlsplit(url)
        key = parse_qs(parsed.query).get("news_no", [""])[0]
        if parsed.path.startswith("/post/internet/") and key.isdecimal():
            found[key] = url
    return found

def parse_table(text, year, expected_regions):
    normalized = unicodedata.normalize("NFKC", text)
    flat = compact(normalized)
    title = f"{year - 1911}年寄往國外各國(地區)耶誕、新年航空及快捷郵件截郵日期表"
    if title not in flat or "耶誕郵件新年郵件" not in flat:
        raise ValueError("PDF year, title or group headers do not match")
    columns = r"\s*".join(("航", "空", "函", "件", "航", "空", "包", "裹", "快", "捷", "郵", "件"))
    # Poppler may lay out column labels in vertical glyph rows.
    horizontal = re.search(columns + r"\s*" + columns, normalized)
    vertical = all(re.search(r"\s{2,}".join(pattern), normalized)
                   for pattern in ("航航快航航快", "空空捷空空捷", "函包郵函包郵", "件裹件件裹件"))
    if not (horizontal or vertical):
        raise ValueError("PDF column order cannot be verified")
    rows = []
    regions = "|".join(map(re.escape, expected_regions))
    row_pattern = re.compile(rf"^\s*(?:(?:亞\s*洲|歐\s*洲|美\s*洲|非\s*洲|大\s*洋\s*洲|[亞歐美非大洋洲])\s+)?({regions})((?:\s+{DATE}){{6}})\s*$")
    for line in normalized.splitlines():
        if not re.search(r"\d{1,2}/\d{1,2}", line):
            continue
        match = row_pattern.fullmatch(line)
        if not match:
            raise ValueError("Unrecognised or incomplete date row")
        dates = []
        for token in match[2].split():
            month, day = map(int, token.split("/"))
            dates.append(date(year, month, day).strftime("%m-%d"))
        rows.append([match[1], *dates])
    if [row[0] for row in rows] != expected_regions:
        raise ValueError("Region names, order or count changed")
    return rows

def read_pdf(url):
    from pypdf import PdfReader

    body, _ = fetch(url, {TW}, {"application/pdf", "application/octet-stream"})
    if not body.startswith(b"%PDF-"):
        raise ValueError("Attachment is not a PDF")
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(body), strict=True)
        if len(reader.pages) != 1:
            raise ValueError("Expected a one-page table")
        return reader.pages[0].extract_text(extraction_mode="layout")
    except PdfReadError as error:
        raise ValueError("PDF extraction failed") from error

def taiwan_candidate(catalog, sources, year):
    known = catalog["taiwan"].get(str(year))
    found = {}
    failures = 0
    for url in sources:
        try:
            found.update(find_announcements(page(url, {TW}), url, year))
        except (OSError, ValueError):
            failures += 1
    if known:
        url = known["source"]
        found.setdefault(parse_qs(urlsplit(url).query)["news_no"][0], url)
    if not found:
        raise ValueError(f"No discoverable announcement for {year} ({failures} list fetch errors)")
    if len(found) != 1 or (failures and not known):
        raise ValueError("Announcement uniqueness could not be verified")
    url = next(iter(found.values()))
    article = page(url, {TW})
    if not is_announcement(article.text, year):
        raise ValueError("Announcement title or publication year mismatch")
    attachments = {
        urljoin(url, href) for href, _ in article.links
        if safe_url(urljoin(url, href), {TW})
        and urlsplit(urljoin(url, href)).path.startswith("/post/FileCenter/")
        and urlsplit(urljoin(url, href)).path.lower().endswith(".pdf")
    }
    if len(attachments) != 1:
        raise ValueError("Expected exactly one official PDF attachment")
    pdf = attachments.pop()
    latest = catalog["taiwan"][max(catalog["taiwan"])]
    rows = parse_table(read_pdf(pdf), year, [row[0] for row in latest["rows"]])
    return {"source": url, "pdf": pdf, "rows": rows}

def foreign_signal(source):
    url = source["url"]
    hosts = {urlsplit(url).hostname}
    if urlsplit(url).hostname == "www.laposte.fr":
        hosts.add("api.boutique.laposte.fr")
    content = page(url, hosts).text.casefold().replace("’", "'")
    excerpts = []
    for anchor in source["anchors"]:
        marker = anchor.casefold().replace("’", "'")
        offset = content.find(marker)
        if offset < 0:
            raise ValueError("Expected address or policy text missing")
        excerpts.append(content[max(0, offset - 120):offset + len(marker) + 300])
    return hashlib.sha256("\n".join(excerpts).encode()).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=datetime.now(timezone(timedelta(hours=8))).year)
    parser.add_argument("--report", type=Path, default=ROOT / "review-report.json")
    parser.add_argument("--apply", action="store_true", help="Add a newly validated Taiwan table")
    args = parser.parse_args()
    catalog, config = load(CATALOG), load(CONFIG)
    state_file = ROOT / "config/baseline.json"
    baseline = load(state_file) if state_file.exists() else {}
    report = {"year": args.year, "review": [], "observed": {}, "published": False}

    try:
        candidate = taiwan_candidate(catalog, config["taiwanLists"], args.year)
        known = catalog["taiwan"].get(str(args.year))
        if known and (known["pdf"], known["rows"]) != (candidate["pdf"], candidate["rows"]):
            report["review"].append({"id": "tw", "reason": "Published table or PDF changed"})
            report["candidate"] = candidate
        elif not known:
            report["candidate"] = candidate
            if args.apply and args.year == datetime.now(timezone(timedelta(hours=8))).year:
                catalog["taiwan"][str(args.year)] = candidate
                write(CATALOG, catalog)
                report["published"] = True
    except (OSError, ValueError) as error:
        report["review"].append({"id": "tw", "reason": str(error)})

    for source in config["foreign"]:
        identifier = source["id"]
        try:
            digest = foreign_signal(source)
            report["observed"][identifier] = digest
            if baseline.get(identifier) != digest:
                reason = "Content changed" if identifier in baseline else "Baseline awaiting approval"
                report["review"].append({"id": identifier, "reason": reason, "source": source["url"]})
        except (OSError, ValueError) as error:
            report["review"].append({"id": identifier, "reason": str(error), "source": source["url"]})
    for office in catalog["offices"]:
        if str(args.year) not in office["seasons"]:
            report["review"].append({"id": office["id"], "reason": "No reviewed office entry for this year"})
    write(args.report, report)
    print(f"Year {args.year}: {len(report['review'])} review items; published={report['published']}")

if __name__ == "__main__":
    main()
