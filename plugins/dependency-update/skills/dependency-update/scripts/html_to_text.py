#!/usr/bin/env python3
"""Print the readable text of an HTML page, such as a release-notes page.

Usage: html_to_text.py <url | file | ->

Headings become '#' lines, list items '- ', inline <code> becomes `code`,
and <pre> blocks keep their line breaks. Scripts, styles, and page chrome
(nav, header, footer, aside, and the devsite navigation of Google pages)
are dropped. Use it instead of WebFetch when exact wording and API names
matter: WebFetch returns a model-written summary, not the page text.

Find a version's section with `grep -n` on the output, then print the
line range with `sed -n '<from>,<to>p'`.
Standard library only (Python 3.9+).
"""
import re
import sys
import urllib.request
from html.parser import HTMLParser

SKIP = {
    "script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form", "button", "template",
    "devsite-header", "devsite-book-nav", "devsite-toc", "devsite-feedback", "devsite-thumb-rating",
    "devsite-footer-promos", "devsite-footer-linkboxes", "devsite-footer-utility", "devsite-banner",
}
BLOCK = {"p", "div", "section", "article", "main", "table", "tr", "ul", "ol", "dl", "dt", "dd", "blockquote", "figure", "figcaption", "br", "hr"}
HEADINGS = {"h1": "# ", "h2": "## ", "h3": "### ", "h4": "#### ", "h5": "##### ", "h6": "###### "}


class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip_tag, self.skip_depth = None, 0
        self.pre = 0

    def handle_starttag(self, tag, attrs):
        if self.skip_tag:
            if tag == self.skip_tag:
                self.skip_depth += 1
            return
        if tag in SKIP:
            self.skip_tag, self.skip_depth = tag, 1
            return
        if tag in HEADINGS:
            self.out.append("\n\n" + HEADINGS[tag])
        elif tag == "li":
            self.out.append("\n- ")
        elif tag == "pre":
            self.pre += 1
            self.out.append("\n```\n")
        elif tag == "code" and not self.pre:
            self.out.append("`")
        elif tag in ("td", "th"):
            self.out.append(" | ")
        elif tag in BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if self.skip_tag:
            if tag == self.skip_tag:
                self.skip_depth -= 1
                if self.skip_depth == 0:
                    self.skip_tag = None
            return
        if tag in HEADINGS:
            self.out.append("\n")
        elif tag == "pre" and self.pre:
            self.pre -= 1
            self.out.append("\n```\n")
        elif tag == "code" and not self.pre:
            self.out.append("`")
        elif tag in BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if self.skip_tag:
            return
        self.out.append(data if self.pre else re.sub(r"\s+", " ", data))

    def text(self):
        lines = [line.rstrip() for line in "".join(self.out).splitlines()]
        return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() + "\n"


def main():
    if len(sys.argv) == 2 and sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    if src == "-":
        html = sys.stdin.read()
    elif re.match(r"https?://", src):
        req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0 (dependency-update skill)"})
        with urllib.request.urlopen(req, timeout=30) as r:
            html = r.read().decode(r.headers.get_content_charset() or "utf-8", errors="replace")
    else:
        with open(src, encoding="utf-8", errors="replace") as fh:
            html = fh.read()
    parser = Text()
    parser.feed(html)
    sys.stdout.write(parser.text())


if __name__ == "__main__":
    main()
