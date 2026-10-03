"""別namespaceの混同、混在文字列化、版違い選択を検知する。"""

from dataclasses import replace
import tracemalloc
from tei_reader.document import load_document
from tei_reader.locator import build_index, make_locator, resolve_locator, resolve_path
from tei_reader.tree import structured_unit
from tei_reader.model import Limits, XML_ID, Element
from tests.support import ReaderCase


class StructureTests(ReaderCase):
    def index(self, content):
        return build_index(load_document(self.write_xml(content), None, Limits()))

    def test_qname_sibling_index(self):
        index = self.index('<l/><x:l xmlns:x="urn:x"/><!--c--><?v x?><l/>')
        self.assertEqual(list(index.by_path), ['/t:TEI[1]', '/t:TEI[1]/t:l[1]', '/t:TEI[1]/n1:l[1]', '/t:TEI[1]/t:l[2]'])
        for node in index.elements:
            self.assertIs(resolve_locator(index, make_locator(index, node)), node)

    def test_prefix_rebinding(self):
        index = self.index('<x:l xmlns:x="urn:z"><x:l xmlns:x="urn:a" x:role="x:name"/></x:l>')
        self.assertEqual(index.namespaces['n1'], 'urn:a')
        self.assertEqual(index.namespaces['n2'], 'urn:z')
        leaf = index.elements[2]
        self.assertEqual(leaf.name, '{urn:a}l')
        out = structured_unit(index, leaf, Limits())['content']
        self.assertEqual(out['attributes'], {'{urn:a}role': 'x:name'})
        self.assertEqual(out['in_scope_namespaces']['x'], 'urn:a')

    def test_mixed_content_order(self):
        index = self.index('<p>前<![CDATA[中]]><hi xml:id="x">内</hi>後<!--注--><?view a?>末</p>外')
        result = structured_unit(index, index.elements[1], Limits())
        content = result['content']['content']
        self.assertEqual([n['kind'] for n in content], ['text','element','text','comment','pi','text'])
        self.assertEqual([n.get('value') for n in content], ['前中',None,'後','注','a','末'])
        self.assertEqual(content[1]['attributes'], {XML_ID:'x'})
        self.assertEqual(content[4]['target'], 'view')
        self.assertFalse(result['selection_applied'])
        self.assertIsNone(result['reading_text'])

    def test_parser_normalization_and_outside_misc(self):
        raw = ('<?v a?><!--外--><TEI xmlns="http://www.tei-c.org/ns/1.0"><p>A\r\n&amp;&#x1F600;</p></TEI><!--後-->').encode()
        index = build_index(load_document(self.write_xml(full=raw), None, Limits()))
        self.assertEqual(index.document.outside_root_misc, {'comments':2,'pis':1})
        out = structured_unit(index, index.elements[1], Limits())
        self.assertEqual(out['content']['content'][0]['value'], 'A\n&😀')

    def test_duplicate_id_path_selection(self):
        index = self.index('<p xml:id="dup"/><p xml:id="dup"/><p xml:id="one"/>')
        self.assertIsNone(make_locator(index,index.elements[1])['xml_id'])
        self.assertEqual(make_locator(index,index.elements[3])['xml_id'], 'one')
        self.assertIs(resolve_path(index, '/t:TEI[1]/t:p[2]'), index.elements[2])

    def test_locator_errors(self):
        index = self.index('<p xml:id="one"/>')
        locator = make_locator(index,index.elements[1])
        self.error('hash_mismatch', resolve_locator,index,dict(locator,document_sha256='0'*64))
        self.error('invalid_locator', resolve_locator,index,dict(locator,xml_id='wrong'))
        for path in ('//t:p','/t:TEI[1]/t:p[@x="a"]','/t:TEI[1]/t:p[01]','/t:TEI[1]/*[1]'):
            self.error('invalid_locator',resolve_path,index,path)
        self.error('locator_not_found',resolve_path,index,'/t:TEI[1]/t:p[2]')

    def test_xml_name_classification_and_unicode_names(self):
        index = self.index('<章><a\u0301/></章>')
        for path in ('/1[1]', '/.[1]', '/t:TEI[1]/t:1name[1]'):
            self.error('invalid_locator', resolve_path, index, path)
        for node in index.elements:
            self.assertIs(resolve_path(index, index.paths[node]), node)
        self.error('locator_not_found', resolve_path, index, '/t:TEI[1]/t:未収録[1]')
        self.error('locator_not_found', resolve_path, index, '/t:TEI[1]/t:\U00010000[1]')

    def test_extract_boundaries(self):
        for resource, content in (
            ('unit_elements','<p/>'*1999),
            ('unit_nodes','<!--x-->'*3999),
            ('unit_payload','😀'*20000),
        ):
            with self.subTest(resource=resource):
                index = self.index(content)
                structured_unit(index,index.document.root,Limits())
                extra = '<p/>' if resource=='unit_elements' else ('<!--x-->' if resource=='unit_nodes' else '😀')
                index = self.index(content+extra)
                error = self.error('unit_too_large',structured_unit,index,index.document.root,Limits())
                self.assertEqual(error.details['locator']['xpath'],'/t:TEI[1]')
                self.assertNotIn('content',error.details)
        index = self.index('<!--😀--><?v 😀?>')
        structured_unit(index,index.document.root,replace(Limits(),unit_payload=2))
        self.error('unit_too_large',structured_unit,index,index.document.root,replace(Limits(),unit_payload=1))

    def test_depth_256_projection(self):
        index = self.index('<p>'*255+'</p>'*255)
        out = structured_unit(index,index.document.root,Limits())
        self.assertEqual(out['content']['locator']['xpath'],'/t:TEI[1]')

    def test_namespace_projection_memory(self):
        declarations=' '.join(f'xmlns:n{i}="urn:{i}"' for i in range(1000))
        index=self.index('<div '+declarations+'>'+'<p/>'*1999+'</div>')
        tracemalloc.start()
        try:
            out=structured_unit(index,index.elements[1],Limits())
            _,peak=tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
        self.assertEqual(out['content']['content'][-1]['in_scope_namespaces']['n999'],'urn:999')
        self.assertLess(peak,8*1024*1024)
