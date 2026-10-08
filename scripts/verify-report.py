"""Validates the generated report: page count, per-page text volume, and that the
expected names and sections are present. Run after scripts/build-report.py."""

import sys
from pypdf import PdfReader

PATH = r"C:\Users\ROM\Downloads\CGCI-Campus-Navigation-Project-Report.pdf"

reader = PdfReader(PATH)
print(f"pages: {len(reader.pages)}")
metadata = reader.metadata or {}
print(f"title : {metadata.get('/Title')}")
print(f"author: {metadata.get('/Author')}")

full = ""
print("\nper-page:")
for index, page in enumerate(reader.pages, start=1):
    text = page.extract_text() or ""
    full += text
    lines = [line for line in text.split("\n") if line.strip()]
    first = lines[1][:66] if len(lines) > 1 else (lines[0][:66] if lines else "")
    print(f"  p{index:>2}: {len(text):>5} chars | {first}")

print("\nrequired content:")
for needle in [
    "Sandy Gabitanan",
    "Chynna Madriaga",
    "Developers",
    "Campus Site Map",
    "Dijkstra",
    "Breadth-first search",
    "Adjacency matrix",
    "adjacency matrix",
    "Bellman",
    "reachab",
    "G = (V, E)",
]:
    count = full.count(needle)
    flag = "ok " if count else "MISSING"
    print(f"  {flag} {needle!r}: {count}")

# A near-empty page usually means a bad page break.
thin = [i for i, p in enumerate(reader.pages, 1) if len(p.extract_text() or "") < 400]
print(f"\npages with little text: {thin if thin else 'none'}")