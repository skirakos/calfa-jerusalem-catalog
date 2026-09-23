#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

BASE = Path("/Users/sedakirakosyan/Desktop/inscriptions_calfa")
PIPELINE = BASE / "jerusalem_step1_output"
PREPARED = BASE / "jerusalem_boundary_full" / "prepared"
MANIFEST = BASE / "jerusalem_complete_through_step3_3768.txt"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}

def parse_manifest(path: Path) -> list[tuple[str, str]]:
    out = []
    seen = set()
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.search(r"(Jerusalem_V\d+)[/\\:_\s-]+([^\s,;]+)", line)
        if not m:
            continue
        key = (m.group(1), m.group(2))
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out

def choose(json_dir: Path, notice: str) -> Path | None:
    # Publish only complete Step-3 records from the manifest.
    p = json_dir / f"{notice}-refine.json"
    return p if p.is_file() else None

def image_urls(volume: str, notice: str, base_url: str) -> list[str]:
    if not base_url:
        return []
    d = PREPARED / volume / notice
    if not d.is_dir():
        return []
    root = base_url.rstrip("/")
    return [
        f"{root}/{quote(volume)}/{quote(notice)}/{quote(p.name)}"
        for p in sorted(d.iterdir())
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    ]

def text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    return str(v)

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image-base-url", default="")
    ap.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "site" / "data" / "catalog.json",
    )
    args = ap.parse_args()

    if not MANIFEST.is_file():
        raise SystemExit(f"Manifest not found: {MANIFEST}")

    records = []
    missing = []

    for volume, notice in parse_manifest(MANIFEST):
        json_dir = PIPELINE / volume / "json"
        src = choose(json_dir, notice)
        if src is None:
            missing.append(f"{volume}/{notice}")
            continue

        try:
            raw = json.loads(src.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"WARN invalid JSON {src}: {exc}")
            missing.append(f"{volume}/{notice}")
            continue

        if not isinstance(raw, dict):
            missing.append(f"{volume}/{notice}")
            continue

        fields = {k: v for k, v in raw.items() if not str(k).startswith("_")}

        manuscript_number = (
            text(fields.get("numero"))
            or text(fields.get("no_notice"))
            or str(notice)
        )

        # Public manuscript ID requested by the project:
        # Jerusalem = J + manuscript number.
        manuscript_id = f"J{manuscript_number}"

        date_display = (
            text(fields.get("details_date"))
            or text(fields.get("date_debut"))
            or text(fields.get("date_fin"))
        )

        title = text(fields.get("titre")) or None

        blob = [
            manuscript_id,
            "Jerusalem",
            manuscript_number,
            str(notice),
            title or "",
            date_display,
        ]
        for value in fields.values():
            if value is None:
                continue
            if isinstance(value, str):
                blob.append(value)
            else:
                blob.append(json.dumps(value, ensure_ascii=False))

        records.append({
            "id": manuscript_id,
            "collection": "Jerusalem",
            "source": "Jerusalem",
            "volume": volume,
            "notice": str(notice),
            "number": manuscript_number,
            "title": title,
            "date": date_display,
            "fields": fields,
            "images": image_urls(volume, str(notice), args.image_base_url),
            "searchableText": "\n".join(blob),
        })

    ids = [r["id"] for r in records]
    duplicate_ids = sorted({x for x in ids if ids.count(x) > 1})
    if duplicate_ids:
        raise SystemExit(
            "Duplicate public manuscript IDs detected: "
            + ", ".join(duplicate_ids[:20])
        )

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "collection": "Jerusalem",
        "idPrefix": "J",
        "records": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Manifest entries: {len(parse_manifest(MANIFEST))}")
    print(f"Published records: {len(records)}")
    print(f"Missing Step3 JSON: {len(missing)}")
    if missing:
        print("First missing:", ", ".join(missing[:10]))
    print(f"Output: {args.output}")
    print(f"Image base URL: {args.image_base_url or '(not configured)'}")

if __name__ == "__main__":
    main()
