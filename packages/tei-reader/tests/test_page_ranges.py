"""原XMLの改頁境界、部分構造、属性参照元を実要求で確認する。"""

import hashlib
from dataclasses import replace
from tei_reader.model import Limits
from tei_reader.protocol import execute_request
from tests.support import ReaderCase


def text_of(node):
    if node is None:
        return ''
    if node.get('kind') == 'text':
        return node['value']
    return ''.join(text_of(child) for child in node.get('content', []))


class PageRangeTests(ReaderCase):
    def call(self, content, *, limits=None, **extra):
        path = self.write_xml(content)
        before = path.read_bytes()
        result = execute_request({'operation': 'facsimile_links', 'file_path': str(path),
                                  'expected_sha256': hashlib.sha256(before).hexdigest(), **extra},
                                 limits or Limits())
        self.assertEqual(path.read_bytes(), before)
        return result

    def test_cuts_inside_paragraph_preserving_alternatives_and_original_locators(self):
        r = self.call('<surface xml:id="s"/><text><body><p xml:id="p">前<pb xml:id="a" facs="#s"/>'
                      '甲<choice><orig>舊</orig><reg>旧</reg></choice><pb xml:id="b" facs="#s"/>乙</p></body></text>')
        self.assertTrue(r['ok'], r)
        first, second = r['result']['items']
        page = first['page_range']
        self.assertEqual(first['source_content']['name'], '{http://www.tei-c.org/ns/1.0}pb')
        self.assertEqual(text_of(page['content']), '甲舊旧')
        self.assertEqual(page['start_locator']['xml_id'], 'a')
        self.assertEqual(page['end_locator']['xml_id'], 'b')
        self.assertEqual(page['boundary'], 'next_pb')
        p = page['content']['content'][0]['content'][0]
        self.assertEqual(p['locator']['xpath'], '/t:TEI[1]/t:text[1]/t:body[1]/t:p[1]')
        self.assertTrue(p['partial'])
        self.assertEqual(text_of(second['page_range']['content']), '乙')
        self.assertEqual(second['page_range']['boundary'], 'container_end')

    def test_range_crosses_logical_units_and_stops_at_a_pb_without_facs(self):
        r = self.call('<text><body><div><lg><l>前<pb facs="#s"/>甲</l><l><del>消</del><add>加</add></l>'
                      '</lg></div><div><p>注<note>細字</note><pb/>乙</p></div></body></text>')
        page = r['result']['items'][0]['page_range']
        self.assertEqual(text_of(page['content']), '甲消加注細字')
        self.assertEqual(page['boundary'], 'next_pb')
        self.assertEqual(page['end_locator']['xpath'], '/t:TEI[1]/t:text[1]/t:body[1]/t:div[2]/t:p[1]/t:pb[1]')

    def test_empty_pages_and_separate_texts_have_bounded_ranges(self):
        r = self.call('<text><group><text><body><pb xml:id="a" facs="#s"/><pb xml:id="b" facs="#s"/>甲'
                      '</body></text><text><body>別本文<pb facs="#s"/>乙</body></text></group></text>')
        items = r['result']['items']
        self.assertEqual(text_of(items[0]['page_range']['content']), '')
        self.assertEqual(text_of(items[1]['page_range']['content']), '甲')
        self.assertEqual(text_of(items[2]['page_range']['content']), '乙')

    def test_mixed_editions_are_held_for_review(self):
        r = self.call('<text><body><pb facs="#s" ed="A"/>甲<pb ed="B"/>乙</body></text>')
        item = r['result']['items'][0]
        self.assertIsNone(item['page_range'])
        self.assertIn('mixed_edition_page_boundary_requires_review', item['diagnostics'])

    def test_branch_milestones_do_not_define_a_flat_page_stream(self):
        for tag in ['choice', 'app', 'note', 'subst']:
            with self.subTest(tag=tag):
                r = self.call(f'<text><body><{tag}><pb facs="#s"/>甲</{tag}>乙</body></text>')
                item = r['result']['items'][0]
                self.assertIsNone(item['page_range'])
                self.assertIn('page_stream_requires_review', item['diagnostics'])

    def test_a_branch_pb_does_not_cut_an_outer_page(self):
        r = self.call('<text><body><pb facs="#s"/>甲<note><pb/>注</note>乙<pb/>次頁</body></text>')
        self.assertEqual(text_of(r['result']['items'][0]['page_range']['content']), '甲注乙')

    def test_nonempty_pb_and_missing_stream_remain_markers(self):
        for content in ['<pb facs="#s"/>', '<text><body><pb facs="#s">字</pb>甲</body></text>']:
            with self.subTest(content=content):
                item = self.call(content)['result']['items'][0]
                self.assertIsNone(item['page_range'])
                self.assertIn('page_stream_requires_review', item['diagnostics'])

    def test_large_page_is_omitted_as_a_whole(self):
        for limits, content in [(replace(Limits(), unit_payload=4), '字' * 5),
                                (replace(Limits(), unit_elements=2), '<p><hi>甲</hi></p><p>乙</p>'),
                                (replace(Limits(), unit_nodes=2), '甲<!--注--><?p 文?>乙')]:
            with self.subTest(limits=limits):
                item = self.call(f'<text><body><pb facs="#s"/>{content}</body></text>', limits=limits)['result']['items'][0]
                self.assertIsNone(item['page_range']['content'])
                self.assertEqual(item['page_range']['omission']['code'], 'unit_too_large')
                self.assertIsNotNone(item['source_content'])

    def test_inherited_facs_is_opt_in_with_override_and_empty_barrier(self):
        content = ('<surface xml:id="s"/><surface xml:id="t"/><text><body><div xml:id="d" facs="#s #missing">'
                   '<p xml:id="p">甲</p><p facs=""><hi xml:id="stop">乙</hi></p>'
                   '<p xml:id="own" facs="#t"><hi xml:id="child">丙</hi></p></div></body></text>')
        self.assertEqual(self.call(content)['result']['total_occurrences'], 3)
        r = self.call(content, include_inherited=True, limit=100)
        self.assertTrue(r['ok'], r)
        items = r['result']['items']
        p = [i for i in items if i['source_locator']['xml_id'] == 'p']
        self.assertEqual([i['raw_token'] for i in p], ['#s', '#missing'])
        self.assertEqual(p[0]['facs_origin']['kind'], 'ancestor')
        self.assertEqual(p[0]['facs_origin']['locator']['xml_id'], 'd')
        self.assertFalse(any(i['source_locator']['xml_id'] == 'stop' for i in items))
        child = next(i for i in items if i['source_locator']['xml_id'] == 'child')
        self.assertEqual(child['raw_token'], '#t')
        self.assertEqual(child['facs_origin']['locator']['xml_id'], 'own')

    def test_inherited_uri_uses_the_attribute_owners_base(self):
        content = ('<surface xml:id="s"/><text><body><div facs="#s"><p xml:id="p" xml:base="other.xml">甲</p></div>'
                   '<div xml:base="other.xml" facs="#s"><p xml:id="q">乙</p></div></body></text>')
        items = self.call(content, include_inherited=True)['result']['items']
        p = next(i for i in items if i['source_locator']['xml_id'] == 'p')
        q = next(i for i in items if i['source_locator']['xml_id'] == 'q')
        self.assertEqual(p['reference_status'], 'resolved_local')
        self.assertEqual(p['xml_base_chain'], [])
        self.assertEqual(q['reference_status'], 'base_context_unverified')

    def test_inherited_pagination_and_strict_boolean(self):
        content = '<text><body><div facs="#a #b"><p>甲</p></div></body></text>'
        r = self.call(content, include_inherited=True, limit=1, offset=2)
        self.assertTrue(r['ok'], r)
        self.assertEqual(r['result']['total_occurrences'], 4)
        self.assertEqual(r['result']['next_offset'], 3)
        self.assertEqual(r['result']['items'][0]['raw_token'], '#a')
        for invalid in [1, 'true', None]:
            self.assertEqual(self.call(content, include_inherited=invalid)['error']['code'], 'invalid_request')
