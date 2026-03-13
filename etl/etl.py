"""
LILA BLACK — ETL Script
Reads all .nakama-0 parquet files and uploads to Supabase.

Usage:
    cd etl
    pip install -r requirements.txt
    python etl.py

Requires a .env file (or set env vars) with:
    SUPABASE_URL=https://ydwmcthdjvhmiewwnpfo.supabase.co
    SUPABASE_SERVICE_KEY=<your-service-role-key>
"""

import os
import sys
import re
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq
import pandas as pd
from supabase import create_client, Client
from tqdm import tqdm

# ─── CONFIG ──────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://ydwmcthdjvhmiewwnpfo.supabase.co"
# Using service role key for write access during ETL
# Set via env var SUPABASE_KEY or replace below
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

DATA_ROOT = Path(__file__).parent.parent / "player_data" / "player_data"

DAYS = {
    "February_10": date(2026, 2, 10),
    "February_11": date(2026, 2, 11),
    "February_12": date(2026, 2, 12),
    "February_13": date(2026, 2, 13),
    "February_14": date(2026, 2, 14),
}

# Map coordinate config from README
MAP_CONFIG = {
    "AmbroseValley": {"scale": 900,  "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581,  "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

BATCH_SIZE = 500  # rows per Supabase upsert

# ─── COORDINATE TRANSFORM ────────────────────────────────────────────────────

def world_to_pixel(x: float, z: float, map_id: str) -> tuple[int, int]:
    """Convert world (x, z) coords to minimap pixel (px, py) coords."""
    cfg = MAP_CONFIG.get(map_id)
    if cfg is None:
        return 0, 0
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    px = int(u * 1024)
    py = int((1 - v) * 1024)  # Y axis is flipped
    # Clamp to [0, 1024]
    px = max(0, min(1024, px))
    py = max(0, min(1024, py))
    return px, py


# ─── FILE PARSING ────────────────────────────────────────────────────────────

UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE
)

def is_bot_user(user_id: str) -> bool:
    return not bool(UUID_PATTERN.match(user_id))


def parse_filename(filename: str) -> tuple[str, str]:
    """Extract (user_id, match_id) from filename like user_match.nakama-0"""
    name = filename.replace(".nakama-0", "")
    # Bot user_ids are short numeric strings (no dashes)
    # Human user_ids are UUIDs: exactly 36 chars (8-4-4-4-12) with 4 dashes
    # The separator between user_id and match_id is always a single underscore
    first_underscore = name.index("_")
    user_id = name[:first_underscore]

    if user_id.isdigit():
        # Bot: user_id is numeric, everything after first _ is match_id
        match_id = name[first_underscore + 1:]
    else:
        # Human: user_id is a UUID (36 chars), separator at index 36
        # Format: {36-char-uuid}_{36-char-uuid}
        user_id = name[:36]
        match_id = name[37:]  # skip the underscore at position 36

    return user_id, match_id


def load_parquet_file(filepath: Path) -> pd.DataFrame | None:
    """Load a single parquet file into a DataFrame."""
    try:
        table = pq.read_table(str(filepath))
        return table.to_pandas()
    except Exception as e:
        print(f"  ⚠ Failed to read {filepath.name}: {e}")
        return None


# ─── ETL LOGIC ───────────────────────────────────────────────────────────────

def process_file(filepath: Path, day_date: date) -> list[dict]:
    """Process a single .nakama-0 file into a list of event dicts."""
    df = load_parquet_file(filepath)
    if df is None or df.empty:
        return []

    # Decode event column from bytes → string
    df["event"] = df["event"].apply(
        lambda x: x.decode("utf-8") if isinstance(x, bytes) else str(x)
    )

    # Get map_id from first row
    map_id = df["map_id"].iloc[0] if "map_id" in df.columns else "Unknown"

    # Parse user_id + match_id from filename
    user_id, match_id = parse_filename(filepath.name)
    bot = is_bot_user(user_id)

    rows = []
    for _, row in df.iterrows():
        x = float(row["x"])
        z = float(row["z"])
        px, py = world_to_pixel(x, z, map_id)

        # ts: convert datetime to ms integer for ordering
        ts_val = row["ts"]
        if hasattr(ts_val, "value"):
            ts_ms = int(ts_val.value // 1_000_000)  # ns → ms
        elif hasattr(ts_val, "timestamp"):
            ts_ms = int(ts_val.timestamp() * 1000)
        else:
            ts_ms = 0

        rows.append({
            "user_id":    user_id,
            "match_id":   match_id,
            "map_id":     map_id,
            "date":       day_date.isoformat(),
            "x":          x,
            "z":          z,
            "px":         px,
            "py":         py,
            "ts":         ts_ms,
            "event_type": row["event"],
            "is_bot":     bot,
        })
    return rows


def build_match_index(all_events: list[dict]) -> list[dict]:
    """Aggregate event rows into per-match metadata."""
    from collections import defaultdict
    match_map: dict[str, dict] = defaultdict(lambda: {
        "human_ids": set(), "bot_ids": set(), "count": 0,
        "map_id": "", "date": ""
    })
    for ev in all_events:
        mid = ev["match_id"]
        match_map[mid]["count"] += 1
        match_map[mid]["map_id"] = ev["map_id"]
        match_map[mid]["date"]   = ev["date"]
        if ev["is_bot"]:
            match_map[mid]["bot_ids"].add(ev["user_id"])
        else:
            match_map[mid]["human_ids"].add(ev["user_id"])

    result = []
    for match_id, info in match_map.items():
        result.append({
            "match_id":     match_id,
            "map_id":       info["map_id"],
            "date":         info["date"],
            "human_count":  len(info["human_ids"]),
            "bot_count":    len(info["bot_ids"]),
            "total_events": info["count"],
        })
    return result


def upload_in_batches(supabase: Client, table: str, rows: list[dict], label: str):
    """Upload rows to Supabase in batches."""
    total = len(rows)
    print(f"\n📤 Uploading {total:,} rows to `{table}`...")
    for i in tqdm(range(0, total, BATCH_SIZE), desc=label):
        batch = rows[i : i + BATCH_SIZE]
        try:
            supabase.table(table).upsert(batch).execute()
        except Exception as e:
            print(f"\n  ✗ Batch {i//BATCH_SIZE + 1} failed: {e}")
            raise
    print(f"  ✓ Done uploading {total:,} rows to `{table}`")


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_KEY:
        print("❌ SUPABASE_KEY not set. Export it as an env variable:")
        print("   $env:SUPABASE_KEY='your-service-role-key'")
        sys.exit(1)

    print(f"🔗 Connecting to Supabase: {SUPABASE_URL}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    all_events: list[dict] = []
    total_files = 0
    failed_files = 0

    # ── Process all day folders ──
    for folder_name, day_date in DAYS.items():
        folder = DATA_ROOT / folder_name
        if not folder.exists():
            print(f"  ⚠ Folder not found: {folder}")
            continue

        files = [f for f in folder.iterdir() if not f.name.startswith(".")]
        print(f"\n📂 {folder_name} ({len(files)} files) — {day_date}")

        for filepath in tqdm(files, desc=f"  Reading {folder_name}"):
            rows = process_file(filepath, day_date)
            if rows:
                all_events.extend(rows)
                total_files += 1
            else:
                failed_files += 1

    print(f"\n✅ Read {total_files:,} files → {len(all_events):,} event rows")
    if failed_files:
        print(f"   ⚠ {failed_files} files failed/skipped")

    # ── Upload events ──
    upload_in_batches(supabase, "events", all_events, "events")

    # ── Build + upload match index ──
    matches = build_match_index(all_events)
    print(f"\n📋 Built match index: {len(matches):,} unique matches")
    upload_in_batches(supabase, "matches", matches, "matches")

    # ── Validation ──
    print("\n🔍 Validating upload...")
    event_count = supabase.table("events").select("id", count="exact").execute()
    match_count = supabase.table("matches").select("match_id", count="exact").execute()
    print(f"  events  table: {event_count.count:,} rows")
    print(f"  matches table: {match_count.count:,} rows")
    print("\n🎉 ETL complete!")


if __name__ == "__main__":
    main()
