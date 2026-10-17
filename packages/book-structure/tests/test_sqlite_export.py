import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from contextlib import closing

from book_structure.sqlite_export import export_sqlite, SCHEMA


class SqliteExportTests(unittest.TestCase):
    def test_relations_to_review_and_revision_keep_their_nodes(self):
        actor = {"kind": "agent", "name": "reader"}
        book = {"schema_version": "0.1", "structure_id": "b", "inputs": [], "pages": [{"page_id": "p", "sequence_index": 0, "canvas_id": "canvas", "coverage": "ready"}],
                "lines": [], "regions": [], "spans": [], "units": [],
                "reviews": [{"review_id": "review", "subject_id": "p", "subject_sha256": "a"*64, "aspect": "layout", "result": "accepted", "actor": actor, "recorded_at": "2026-10-18T00:00:00Z"}],
                "revisions": [{"revision_id": "revision", "subject_id": "p", "operation": "review", "payload": {}, "actor": actor}],
                "relations": [{"relation_id": "relation", "kind": "refers_to", "from_id": "review", "to_id": "revision", "score": None}]}
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory)/"structure.json", Path(directory)/"book.sqlite"
            source.write_text(json.dumps(book), encoding="utf-8")
            export_sqlite(source, target)
            with closing(sqlite3.connect(target)) as db:
                self.assertEqual(db.execute("SELECT from_id,to_id FROM relations").fetchall(), [("review", "revision")])
                self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_current_reviews_keep_each_actor_and_explicit_invalidations(self):
        with closing(sqlite3.connect(":memory:")) as db:
            db.executescript(SCHEMA)
            db.execute("INSERT INTO nodes VALUES('field','field')")
            db.execute("INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?,?)", ("human-old", "field", "a"*64, "transcription", "rejected", "human", "reader", "2026-10-17T00:00:00Z", "{}"))
            for key, kind, name, result in [("human", "human", "reader", "accepted"), ("agent1", "agent", "one", "needs_review"), ("agent2", "agent", "two", "accepted")]:
                db.execute("INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?,?)", (key, "field", "a"*64, "transcription", result, kind, name, "2026-10-17T00:00:00Z", "{}"))
            self.assertEqual(db.execute("SELECT count(*) FROM current_reviews").fetchone()[0], 3)
            db.execute("INSERT INTO revisions VALUES('revision','field','replace_text','{}')")
            db.execute("INSERT INTO review_invalidations VALUES('revision','human')")
            self.assertEqual(db.execute("SELECT actor_name FROM current_reviews ORDER BY actor_name").fetchall(), [("one",), ("two",)])

    def test_search_and_join_keep_raw_text_geometry_and_same_spelling(self):
        book = {"schema_version": "0.1", "structure_id": "b1", "inputs": [], "pages": [{"page_id": "p1", "sequence_index": 0, "canvas_id": "canvas-1", "coverage": "ready"}],
                "lines": [{"line_ref": "l1", "page_id": "p1", "raw_text": "圖一", "canvas_xywh": [10,20,30,40]}],
                "regions": [{"region_id": "r1", "page_id": "p1", "kind": "figure", "line_refs": [], "canvas_xywh": [1,2,300,400]}],
                "spans": [{"span_id": "s1", "line_ref": "l1", "range_cp": [0,2]}],
                "units": [{"unit_id": "e1", "kind": "entry", "region_ids": ["r1"], "span_ids": ["s1"], "fields": [{"field_id": "f1", "role": "headword", "raw_text": "圖一", "text": "図一", "normalized_text": "図一", "span_ids": ["s1"]}]}],
                "relations": [], "reviews": [], "revisions": []}
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "structure.json"
            source.write_text(json.dumps(book), encoding="utf-8")
            target = Path(directory) / "book.sqlite"
            export_sqlite(source, target)
            with closing(sqlite3.connect(target)) as db:
                self.assertEqual(db.execute("SELECT raw_text,text FROM fields WHERE normalized_text LIKE '図%'").fetchall(), [("圖一", "図一")])
                self.assertEqual(db.execute("SELECT l.raw_text,p.canvas_id FROM fields f JOIN field_spans fs USING(field_id) JOIN spans s USING(span_id) JOIN lines l USING(line_ref) JOIN pages p USING(page_id)").fetchall(), [("圖一", "canvas-1")])
                self.assertEqual(db.execute("SELECT kind,canvas_xywh FROM regions").fetchone(), ("figure", "[1, 2, 300, 400]"))
                self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])
            before = target.read_bytes()
            with self.assertRaises(FileExistsError):
                export_sqlite(source, target)
            self.assertEqual(target.read_bytes(), before)

    def test_dangling_reference_is_rejected(self):
        book = {"schema_version": "0.1", "structure_id": "b1", "inputs": [], "pages": [], "lines": [{"line_ref": "l1", "page_id": "missing", "raw_text": "x", "canvas_xywh": None}],
                "regions": [], "spans": [], "units": [], "relations": [], "reviews": [], "revisions": []}
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "structure.json"
            source.write_text(json.dumps(book), encoding="utf-8")
            with self.assertRaises(sqlite3.IntegrityError):
                export_sqlite(source, Path(directory) / "bad.sqlite")
