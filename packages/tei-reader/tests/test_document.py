"""snapshot/DOCTYPE/資源上限が破られた場合を検知する。"""

from dataclasses import replace
import hashlib
from pathlib import Path
import tracemalloc
from unittest.mock import patch
from tei_reader.document import load_document, read_local_bytes
from tei_reader.model import Limits, TEI_NS
from tests.support import ReaderCase


class DocumentTests(ReaderCase):
    def test_snapshot_read_once(self):
        path = self.write_xml('<p>原文</p>')
        raw = path.read_bytes()
        original = Path.open
        opens = []
        def observed(p, *args, **kwargs):
            opens.append(p)
            return original(p, *args, **kwargs)
        with patch.object(Path, 'open', observed):
            doc = load_document(path, None, Limits())
        self.assertEqual(opens, [path.resolve()])
        self.assertEqual(doc.sha256, hashlib.sha256(raw).hexdigest())
        self.assertEqual(doc.byte_length, len(raw))
        self.assertEqual(doc.root.content[0].content[0].value, '原文')

    def test_doctype_utf8_utf16(self):
        for encoding in ('utf-8', 'utf-16'):
            for declaration in ('<!DOCTYPE TEI [<!ENTITY secret "秘">]>', '<!DOCTYPE TEI SYSTEM "file:///secret">'):
                with self.subTest(encoding=encoding, declaration=declaration):
                    raw = (f'<?xml version="1.0" encoding="{encoding}"?>{declaration}<TEI xmlns="{TEI_NS}"/>').encode(encoding)
                    self.error('doctype_forbidden', load_document, self.write_xml(full=raw), None, Limits())

    def test_depth_boundary(self):
        for depth in (256, 257):
            path = self.write_xml('<p>' * (depth-1) + '</p>' * (depth-1))
            if depth == 256:
                self.assertIsNotNone(load_document(path, None, Limits()).root)
            else:
                self.error('document_too_complex', load_document, path, None, Limits())

    def test_input_bytes_boundary(self):
        prefix = f'<TEI xmlns="{TEI_NS}"><!--'.encode()
        suffix = b'--></TEI>'
        raw = prefix + b'x' * (10_485_760-len(prefix)-len(suffix)) + suffix
        path = self.write_xml(full=raw)
        self.assertEqual(load_document(path, None, Limits()).byte_length, 10_485_760)
        path.write_bytes(raw + b' ')
        self.error('input_too_large', load_document, path, None, Limits())

    def test_element_boundary(self):
        path = self.write_xml('<p/>' * 99_999)
        self.assertIsNotNone(load_document(path, None, Limits()).root)
        path = self.write_xml('<p/>' * 100_000)
        self.error('document_too_complex', load_document, path, None, Limits())

    def test_node_boundary(self):
        path = self.write_xml('<!--x-->' * 199_999)
        self.assertIsNotNone(load_document(path, None, Limits()).root)
        path = self.write_xml('<!--x-->' * 200_000)
        self.error('document_too_complex', load_document, path, None, Limits())

    def test_attribute_boundary(self):
        # 同じ属性名を複数elementへ分け、XMLの属性一意性と区別する。
        path = self.write_xml('<p a="1" b="2" c="3" d="4"/>' * 50_000)
        self.assertIsNotNone(load_document(path, None, Limits()).root)
        path = self.write_xml('<p a="1" b="2" c="3" d="4"/>' * 50_000 + '<p e="5"/>')
        self.error('document_too_complex', load_document, path, None, Limits())

    def test_namespace_declarations_boundary(self):
        # 実宣言上限を小さくし、namespace再束縛を含めcallbackの計数を検証。
        limits = replace(Limits(), namespace_declarations=3)
        self.assertIsNotNone(load_document(self.write_xml('<p xmlns:x="urn:a"/><p xmlns:x="urn:b"/>'), None, limits).root)
        self.error('document_too_complex', load_document, self.write_xml('<p xmlns:x="urn:a"/><p xmlns:x="urn:b"/><p xmlns:x="urn:c"/>'), None, limits)

    def test_namespace_global_boundary(self):
        declarations=' '.join(f'xmlns:n{i}="urn:x"' for i in range(199_999))
        self.assertIsNotNone(load_document(self.write_xml('<p '+declarations+'/>'),None,Limits()).root)
        self.error('document_too_complex',load_document,self.write_xml('<p '+declarations+' xmlns:overflow="urn:x"/>'),None,Limits())

    def test_unknown_xml_encoding(self):
        path=self.write_xml(full=b'<?xml version="1.0" encoding="unknown-codec"?><TEI/>')
        self.error('invalid_xml',load_document,path,None,Limits())

    def test_invalid_xml_hash_and_root(self):
        self.error('hash_mismatch', load_document, self.write_xml(), '0'*64, Limits())
        self.error('invalid_xml', load_document, self.write_xml(full=b'<broken>private'), None, Limits())
        self.error('unsupported_document', load_document, self.write_xml(full=f'<teiCorpus xmlns="{TEI_NS}"/>'.encode()), None, Limits())
        self.error('unsupported_document', load_document, self.write_xml(full=b'<TEI/>'), None, Limits())

    def test_local_path_restrictions(self):
        for path in (Path('https://example.org/file.xml'), Path(r'\\server\file.xml'), Path(r'\\?\J:\file.xml'), self.base, Path('relative.xml')):
            with self.subTest(path=path):
                self.error('file_access_error', read_local_bytes, path, 100)
        self.error('file_access_error', read_local_bytes, self.base/'missing.xml', 100)
        with patch.object(Path, 'resolve', return_value=Path(r'\\server\file.xml')):
            self.error('file_access_error', read_local_bytes, self.base/'link.xml', 100)

    def test_runtime_floor(self):
        with patch('tei_reader.document.pyexpat.EXPAT_VERSION', 'expat_2.7.1'):
            self.error('unsupported_runtime', load_document, self.write_xml(), None, Limits())

    def test_inherited_namespace_memory(self):
        declarations=' '.join(f'xmlns:n{i}="urn:{i}"' for i in range(1000))
        for children in ('<p/>'*1000, ''.join(f'<p xmlns:x="urn:child{i}"/>' for i in range(1000))):
            with self.subTest(rebinding='xmlns:x' in children):
                path=self.write_xml('<div '+declarations+'>'+children+'</div>')
                tracemalloc.start()
                try:
                    doc=load_document(path,None,Limits())
                    _,peak=tracemalloc.get_traced_memory()
                finally:
                    tracemalloc.stop()
                leaf=doc.root.content[0].content[-1]
                self.assertEqual(leaf.in_scope_namespaces['n999'],'urn:999')
                self.assertLess(peak,8*1024*1024)
