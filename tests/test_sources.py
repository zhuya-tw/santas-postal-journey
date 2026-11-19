import unittest
from unittest.mock import patch

from scripts import check_sources as sources

class PostalTests(unittest.TestCase):
    def setUp(self):
        self.catalog = sources.load(sources.CATALOG)
        self.regions = [row[0] for row in self.catalog["taiwan"]["2026"]["rows"]]
        self.title = "115年寄往國外各國(地區)耶誕、新年航空及快捷郵件截郵日期表"
        self.headers = "耶誕郵件 新年郵件\n航  航  快  航  航  快\n空  空  捷  空  空  捷\n函  包  郵  函  包  郵\n件  裹  件  件  裹  件"

    def test_snapshot_data(self):
        self.assertEqual(len(set(self.regions)), 24)
        for year, season in self.catalog["taiwan"].items():
            self.assertTrue(sources.safe_url(season["pdf"], {sources.TW}))
            for region, *dates in season["rows"]:
                self.assertTrue(region)
                self.assertEqual(len(dates), 6)
                for token in dates:
                    self.assertIn(sources.date.fromisoformat(year + "-" + token).month, (11, 12))
        for office in self.catalog["offices"]:
            for year, season in office["seasons"].items():
                self.assertTrue(season["address"] and season["reply"])
                for item in season["sources"]:
                    self.assertTrue(sources.safe_url(item["url"], sources.HOSTS))
                if season["deadline"]:
                    self.assertEqual(str(sources.date.fromisoformat(season["deadline"]).year), year)

    def test_exact_table_round_trip(self):
        rows = self.catalog["taiwan"]["2026"]["rows"]
        text = "\n".join([self.title, self.headers, *[
            "  ".join([region, *[token.replace("-", "/") for token in dates]])
            for region, *dates in rows]])
        self.assertEqual(sources.parse_table(text, 2026, self.regions), rows)
        for broken in [text.replace("115年", "114年"), text.replace("12/10", "12/32", 1),
                       text.replace("12/10  ", "", 1), text.replace("耶誕郵件 新年郵件", "新年郵件 耶誕郵件"),
                       text.replace("加拿大", "更名", 1), text + "\n加拿大 11/20"]:
            with self.subTest(broken=broken[:45]), self.assertRaises(ValueError):
                sources.parse_table(broken, 2026, self.regions)

    def test_official_announcement_and_malicious_lookalike(self):
        good = "/post/internet/Group/index.jsp?news_no=75425"
        label = "公告115年寄往各國（地區）耶誕節及新年郵件截郵日期。"
        html = f'<a href="{good}" title="{label}">details</a><a href="https://www.post.gov.tw.evil.test{good}">{label}</a>'
        page = sources.Page(html)
        url = "https://www.post.gov.tw"
        self.assertEqual(sources.find_announcements(page, url, 2026), {"75425": url + good})
        self.assertEqual(sources.find_announcements(page, url, 2027), {})
        for url in ["https://www.post.gov.tw@evil.test/", "http://www.post.gov.tw/", "https://www.post.gov.tw:443/"]:
            self.assertFalse(sources.safe_url(url, {sources.TW}))

    def test_ambiguous_announcement_is_rejected(self):
        label = "公告116年寄往各國（地區）耶誕節及新年郵件截郵日期。"
        html = "".join(f'<a href="/post/internet/Group/index.jsp?news_no={n}">{label}</a>' for n in [123, 456])
        with patch.object(sources, "page", return_value=sources.Page(html)):
            with self.assertRaisesRegex(ValueError, "uniqueness"):
                sources.taiwan_candidate(self.catalog, ["https://www.post.gov.tw"], 2027)

    def test_foreign_policy_change_changes_fingerprint(self):
        source = {"url": "https://www.deutschepost.de/", "anchors": ["vollständige Absender"]}
        with patch.object(sources, "page", side_effect=[
            sources.Page("<p>vollständige Absender. 2026</p>"),
            sources.Page("<p>vollständige Absender. 2027</p>"),
            sources.Page("<p>moved</p>")
        ]):
            self.assertNotEqual(sources.foreign_signal(source), sources.foreign_signal(source))
            with self.assertRaises(ValueError):
                sources.foreign_signal(source)

if __name__ == "__main__":
    unittest.main()
