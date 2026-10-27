#!/usr/bin/env python3
"""Print an overview of a Zyninote vault (or one subject) for writing notes.

Usage:
    python inventory.py <vault> [subject]

For each subject: title, registered tags, tags in use, and every note with its
order, tags, summary and heading tree (with ids), so you can pick an `order`,
reuse existing tags and link to real heading ids.

Heading ids: an explicit `{#id}` (or TSX `<Section id>`) is exact. Otherwise the
id is approximated the way github-slugger does it and marked with `~`; for links
to `~` ids, run the app's check afterwards (or give the target an explicit id).

Standard library only.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

NOTE_EXT = re.compile(r"\.(md|mdx|tsx)$")


def frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end < 0:
        return {}, text
    data = {}
    for line in text[3:end].splitlines():
        m = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
        if m:
            data[m.group(1)] = parse_value(m.group(2).strip())
    return data, text[end + 4 :]


def parse_value(v):
    if v.startswith("[") and v.endswith("]"):
        return [x.strip().strip("\"'") for x in v[1:-1].split(",") if x.strip()]
    if re.fullmatch(r"-?\d+(\.\d+)?", v):
        return float(v) if "." in v else int(v)
    return v.strip("\"'")


def tsx_meta(text):
    m = re.search(r"export\s+const\s+meta\s*=\s*\{(.*?)\n\s*\}", text, re.S)
    if not m:
        return {}
    body = m.group(1)
    data = {}
    for key in ("title", "summary"):
        k = re.search(rf"{key}\s*:\s*[\"'`](.*?)[\"'`]", body)
        if k:
            data[key] = k.group(1)
    o = re.search(r"order\s*:\s*(-?\d+)", body)
    if o:
        data["order"] = int(o.group(1))
    t = re.search(r"tags\s*:\s*\[(.*?)\]", body, re.S)
    if t:
        data["tags"] = re.findall(r"[\"'`](.*?)[\"'`]", t.group(1))
    return data


def slug(text):
    # Approximation of github-slugger: lowercase, drop punctuation/symbols, spaces -> '-'.
    out = []
    for ch in text.lower():
        cat = unicodedata.category(ch)
        if ch in " ":
            out.append("-")
        elif ch in "-_" or cat[0] in "LNM":
            out.append(ch)
    return "".join(out)


ATTR = re.compile(r"\s*\{([^{}]*)\}\s*$")


def md_headings(body):
    heads, fence = [], None
    for line in body.splitlines():
        f = re.match(r"^\s*(`{3,}|~{3,})", line)
        if f:
            if fence is None:
                fence = f.group(1)[0]
            elif f.group(1)[0] == fence:
                fence = None
            continue
        if fence:
            continue
        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if not m:
            continue
        level, title = len(m.group(1)), m.group(2)
        hid, fold, exact = None, False, False
        a = ATTR.search(title)
        if a and re.fullmatch(r"(\s*[#.][^\s#.]+)+\s*", a.group(1)):
            title = title[: a.start()].rstrip()
            for part in a.group(1).split():
                if part.startswith("#"):
                    hid, exact = part[1:], True
                elif part == ".fold":
                    fold = True
        heads.append((level, title, hid or slug(re.sub(r"[`*_$]", "", title)), exact, fold))
    return heads


def tsx_headings(text):
    heads, depth = [], 1
    for m in re.finditer(r"<Section\b([^>]*?)(/?)>|</Section>", text):
        if m.group(0) == "</Section>":
            depth -= 1
            continue
        attrs = m.group(1)
        hid = re.search(r"id=[\"']([^\"']*)", attrs)
        title = re.search(r"title=[\"']([^\"']*)", attrs)
        level = min(depth + 1, 6)
        heads.append((level, title.group(1) if title else "?", hid.group(1) if hid else "?", True, bool(re.search(r"\bfold\b", attrs))))
        if not m.group(2):
            depth += 1
    return heads


def note_info(path):
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".tsx":
        return tsx_meta(text), tsx_headings(text)
    data, body = frontmatter(text)
    return data, md_headings(body)


def subject_report(sdir):
    sub_meta = {}
    sf = sdir / "_subject.md"
    if sf.exists():
        sub_meta, _ = frontmatter(sf.read_text(encoding="utf-8"))
    registered = sub_meta.get("tags", []) or []
    if isinstance(registered, str):
        registered = [registered]
    notes = []
    for f in sorted(sdir.iterdir()):
        if f.is_dir():
            if not f.name.startswith(("_", ".")):
                print(f"  !! subfolder not allowed: {f.name}/")
            continue
        if f.name.startswith(("_", ".")) or not NOTE_EXT.search(f.name):
            continue
        meta, heads = note_info(f)
        notes.append((f, meta, heads))
    notes.sort(key=lambda n: (n[1].get("order", float("inf")), natural(n[0].stem)))

    print(f"## {sdir.name}/  —  {sub_meta.get('title', '(no _subject.md)')}")
    if sub_meta.get("summary"):
        print(f"   summary: {sub_meta['summary']}")
    used = {}
    for f, meta, _ in notes:
        for t in meta.get("tags", []) or []:
            used.setdefault(t, []).append(f.name)
    print(f"   registered tags: {registered}")
    unreg = [t for t in used if t not in registered]
    if unreg:
        print(f"   !! used but NOT registered: {unreg}")
    for t in registered:
        print(f"     - {t}: {len(used.get(t, []))} note(s)")
    print()
    for f, meta, heads in notes:
        order = meta.get("order", "-")
        print(f"   [{order}] {f.name}  «{meta.get('title', f.stem)}»  tags={meta.get('tags', [])}")
        if meta.get("summary"):
            print(f"        summary: {meta['summary']}")
        for level, title, hid, exact, fold in heads:
            mark = "" if exact else "~"
            print(f"        {'  ' * (level - 2)}{'#' * level} {title}  → #{mark}{hid}{'  (fold)' if fold else ''}")
    others = [f.name for f in sdir.iterdir() if f.is_file() and not NOTE_EXT.search(f.name) and not f.name.startswith(("_", "."))]
    if others:
        print(f"   other files: {others}")
    cheats = sdir / "_cheats.json"
    if cheats.exists():
        try:
            print(f"   cheat cards: {len(json.loads(cheats.read_text(encoding='utf-8')).get('cards', []))}")
        except Exception:
            print("   !! _cheats.json is not valid JSON")
    print()


def natural(s):
    return [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", s)]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    vault = Path(sys.argv[1])
    if not vault.is_dir():
        sys.exit(f"vault not found: {vault}")
    comps = vault / "_components"
    if comps.is_dir():
        print("shared components (content/_components):", sorted(p.name for p in comps.iterdir() if p.is_file()))
        print()
    subjects = [vault / sys.argv[2]] if len(sys.argv) > 2 else sorted(p for p in vault.iterdir() if p.is_dir() and not p.name.startswith(("_", ".")))
    for s in subjects:
        if not s.is_dir():
            sys.exit(f"subject not found: {s}")
        subject_report(s)


if __name__ == "__main__":
    main()
