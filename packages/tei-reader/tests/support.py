"""実fileと手書きXMLを使うテスト補助。"""

from pathlib import Path
import tempfile
import unittest
from tei_reader.model import TEI_NS, Limits, ReaderError


class ReaderCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tei-reader-", dir=Path(__file__).resolve().parents[1])
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def write_xml(self, content="", *, full=None, name="資料 空白.xml"):
        raw = full if full is not None else f'<TEI xmlns="{TEI_NS}">{content}</TEI>'.encode()
        path = self.base / name
        path.write_bytes(raw)
        return path

    def error(self, code, func, *args, **kwargs):
        with self.assertRaises(ReaderError) as ctx:
            func(*args, **kwargs)
        self.assertEqual(ctx.exception.code, code)
        return ctx.exception
