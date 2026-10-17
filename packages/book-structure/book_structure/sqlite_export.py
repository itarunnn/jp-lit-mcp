"""検証済みsnapshotを新規SQLiteへ写す。外部接続と原入力の変更を行わない。"""
import json
from pathlib import Path
import sqlite3


SCHEMA = """
PRAGMA foreign_keys=ON;
PRAGMA user_version=1;
CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE nodes(node_id TEXT PRIMARY KEY,kind TEXT NOT NULL);
CREATE TABLE inputs(path TEXT PRIMARY KEY,sha256 TEXT NOT NULL,role TEXT NOT NULL);
CREATE TABLE pages(page_id TEXT PRIMARY KEY,sequence_index INTEGER UNIQUE,canvas_id TEXT,coverage TEXT,data TEXT NOT NULL);
CREATE TABLE lines(line_ref TEXT PRIMARY KEY,page_id TEXT REFERENCES pages,raw_text TEXT,canvas_xywh TEXT,data TEXT NOT NULL);
CREATE TABLE regions(region_id TEXT PRIMARY KEY,page_id TEXT REFERENCES pages,kind TEXT,canvas_xywh TEXT,data TEXT NOT NULL);
CREATE TABLE region_lines(region_id TEXT REFERENCES regions,line_ref TEXT REFERENCES lines,PRIMARY KEY(region_id,line_ref));
CREATE TABLE spans(span_id TEXT PRIMARY KEY,line_ref TEXT REFERENCES lines,start_cp INTEGER,end_cp INTEGER);
CREATE TABLE units(unit_id TEXT PRIMARY KEY,kind TEXT,data TEXT NOT NULL);
CREATE TABLE unit_regions(unit_id TEXT REFERENCES units,region_id TEXT REFERENCES regions,PRIMARY KEY(unit_id,region_id));
CREATE TABLE unit_spans(unit_id TEXT REFERENCES units,span_id TEXT REFERENCES spans,PRIMARY KEY(unit_id,span_id));
CREATE TABLE fields(field_id TEXT PRIMARY KEY,unit_id TEXT REFERENCES units,role TEXT,raw_text TEXT,text TEXT,normalized_text TEXT);
CREATE TABLE field_spans(field_id TEXT REFERENCES fields,span_id TEXT REFERENCES spans,sequence_index INTEGER,PRIMARY KEY(field_id,sequence_index));
CREATE TABLE relations(relation_id TEXT PRIMARY KEY,kind TEXT,from_id TEXT REFERENCES nodes,to_id TEXT REFERENCES nodes,score REAL,data TEXT NOT NULL);
CREATE TABLE reviews(review_id TEXT PRIMARY KEY,subject_id TEXT REFERENCES nodes,subject_sha256 TEXT,aspect TEXT,result TEXT,actor_kind TEXT,actor_name TEXT,recorded_at TEXT,data TEXT NOT NULL);
CREATE TABLE revisions(revision_id TEXT PRIMARY KEY,subject_id TEXT REFERENCES nodes,operation TEXT,data TEXT NOT NULL);
CREATE TABLE review_invalidations(revision_id TEXT REFERENCES revisions,review_id TEXT REFERENCES reviews,PRIMARY KEY(revision_id,review_id));
CREATE INDEX fields_search ON fields(normalized_text);
CREATE INDEX units_kind ON units(kind);
CREATE INDEX relation_from ON relations(from_id,kind);
CREATE VIEW current_reviews AS SELECT r.* FROM reviews r WHERE NOT EXISTS(SELECT 1 FROM review_invalidations i WHERE i.review_id=r.review_id)
 AND r.rowid=(SELECT max(n.rowid) FROM reviews n WHERE n.subject_id=r.subject_id AND n.aspect=r.aspect AND n.actor_kind=r.actor_kind AND n.actor_name=r.actor_name);
"""


def export_sqlite(source: Path, output: Path):
    if source.stat().st_size > 64 * 1024 * 1024:
        raise ValueError("入力容量が上限を超えています")
    book = json.loads(source.read_text(encoding="utf-8-sig"))
    if book.get("schema_version") != "0.1":
        raise ValueError("書籍構造のversionが不正です")
    output.open("xb").close()
    db = sqlite3.connect(output)
    success = False
    dump = lambda value: json.dumps(value, ensure_ascii=False)
    try:
        db.executescript(SCHEMA)
        with db:
            db.execute("INSERT INTO metadata VALUES(?,?)", ("structure_id", book["structure_id"]))
            for items, key, kind in [(book[k], key, k) for k, key in [("pages", "page_id"), ("lines", "line_ref"), ("regions", "region_id"), ("spans", "span_id"), ("units", "unit_id"), ("relations", "relation_id")]]:
                db.executemany("INSERT INTO nodes VALUES(?,?)", [(item[key], kind) for item in items])
            for unit in book["units"]:
                db.executemany("INSERT INTO nodes VALUES(?,?)", [(field["field_id"], "field") for field in unit["fields"]])
            db.executemany("INSERT INTO inputs VALUES(?,?,?)", [(x["path"], x["sha256"], x["role"]) for x in book["inputs"]])
            db.executemany("INSERT INTO pages VALUES(?,?,?,?,?)", [(p["page_id"], p["sequence_index"], p["canvas_id"], p["coverage"], dump(p)) for p in book["pages"]])
            db.executemany("INSERT INTO lines VALUES(?,?,?,?,?)", [(x["line_ref"], x["page_id"], x["raw_text"], dump(x["canvas_xywh"]), dump(x)) for x in book["lines"]])
            for x in book["regions"]:
                db.execute("INSERT INTO regions VALUES(?,?,?,?,?)", (x["region_id"], x["page_id"], x["kind"], dump(x["canvas_xywh"]), dump(x)))
                db.executemany("INSERT INTO region_lines VALUES(?,?)", [(x["region_id"], key) for key in x["line_refs"]])
            db.executemany("INSERT INTO spans VALUES(?,?,?,?)", [(s["span_id"], s["line_ref"], *s["range_cp"]) for s in book["spans"]])
            for u in book["units"]:
                db.execute("INSERT INTO units VALUES(?,?,?)", (u["unit_id"], u["kind"], dump(u)))
                db.executemany("INSERT INTO unit_regions VALUES(?,?)", [(u["unit_id"], key) for key in u["region_ids"]])
                db.executemany("INSERT INTO unit_spans VALUES(?,?)", [(u["unit_id"], key) for key in u["span_ids"]])
                for f in u["fields"]:
                    db.execute("INSERT INTO fields VALUES(?,?,?,?,?,?)", (f["field_id"], u["unit_id"], f["role"], f["raw_text"], f["text"], f["normalized_text"]))
                    db.executemany("INSERT INTO field_spans VALUES(?,?,?)", [(f["field_id"], key, i) for i, key in enumerate(f["span_ids"])])
            db.executemany("INSERT INTO relations VALUES(?,?,?,?,?,?)", [(r["relation_id"], r["kind"], r["from_id"], r["to_id"], r["score"], dump(r)) for r in book["relations"]])
            db.executemany("INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?,?)", [(r["review_id"], r["subject_id"], r["subject_sha256"], r["aspect"], r["result"], r["actor"]["kind"], r["actor"]["name"], r["recorded_at"], dump(r)) for r in book["reviews"]])
            db.executemany("INSERT INTO revisions VALUES(?,?,?,?)", [(r["revision_id"], r["subject_id"], r["operation"], dump(r)) for r in book["revisions"]])
            db.executemany("INSERT INTO review_invalidations VALUES(?,?)", [(r["revision_id"], key) for r in book["revisions"] for key in r.get("payload", {}).get("invalidated_review_ids", [])])
            if db.execute("PRAGMA foreign_key_check").fetchall():
                raise sqlite3.IntegrityError("参照整合が不正です")
        success = True
    finally:
        db.close()
        if not success:
            output.unlink(missing_ok=True)
