"""Local OCR型lbの行本文とzone参照を原XMLから読む。"""

import hashlib
from dataclasses import replace
from tei_reader.model import Limits
from tei_reader.protocol import execute_request
from tests.support import ReaderCase


class LineRangeTests(ReaderCase):
    def call(self, content, *, limits=None, **extra):
        path = self.write_xml(content)
        before = path.read_bytes()
        response = execute_request({'operation': 'facsimile_links', 'file_path': str(path),
                                    'expected_sha256': hashlib.sha256(before).hexdigest(), **extra}, limits or Limits())
        self.assertEqual(path.read_bytes(), before)
        return response

    def fixture(self, body):
        return '''<facsimile><surface xml:id="s" ulx="0" uly="0" lrx="150" lry="200">
          <graphic url="images/page.png"/><zone xml:id="z" ulx="10" uly="20" lrx="60" lry="120"/>
        </surface></facsimile><text><body><p>''' + body + '</p></body></text>'

    def test_opt_in_local_zone_only_and_exact_line_boundaries(self):
        content = self.fixture('<pb facs="#s"/><lb corresp="#z" n="1"/>舊<choice><orig>字</orig><reg>辞</reg></choice>'
                               '<lb n="2"/>無位置<pb facs="#s"/><lb corresp="#z"/>次頁')
        self.assertEqual(self.call(content)['result']['total_occurrences'], 2)
        response = self.call(content, include_lb_corresp=True, limit=100)
        self.assertTrue(response['ok'], response)
        items = response['result']['items']
        self.assertEqual(len(items), 4)
        line = items[1]
        self.assertEqual(line['attribute_name'], 'corresp')
        self.assertEqual(line['target']['locator']['xml_id'], 'z')
        self.assertEqual(line['line_range']['boundary'], 'next_milestone')
        self.assertEqual(line['line_range']['end_locator']['xpath'].split('/')[-1], 't:lb[2]')
        self.assertEqual(line['line_range']['content']['content'][0]['value'], '舊')
        self.assertEqual(line['line_range']['content']['content'][1]['name'], '{http://www.tei-c.org/ns/1.0}choice')
        self.assertNotIn('無位置', str(line['line_range']))
        self.assertNotIn('milestone_content_not_expanded', line['diagnostics'])
        self.assertEqual(items[-1]['line_range']['boundary'], 'container_end')
        self.assertEqual(items[-1]['line_range']['content']['content'][0]['value'], '次頁')
        self.assertEqual(self.call(content, include_lb_corresp=True, limit=1, offset=1)['result']['next_offset'], 2)

    def test_corresp_is_narrow_and_coexists_with_facs(self):
        content = self.fixture('<lb facs="#s" corresp="#z #s #missing https://example.org/zone"/>甲'
                               '<lb corresp="#z"/>乙<pb/>丙<ref corresp="#z">参照</ref>')
        items = self.call(content, include_lb_corresp=True, include_inherited=True, limit=100)['result']['items']
        line = [i for i in items if i.get('attribute_name') == 'corresp']
        self.assertEqual(len(line), 2)
        self.assertEqual(line[0]['token_index'], 0)
        self.assertEqual(line[1]['line_range']['boundary'], 'next_milestone')
        self.assertEqual(line[1]['line_range']['end_locator']['xpath'].split('/')[-1], 't:pb[1]')
        self.assertNotIn('丙', str(line[1]['line_range']))

    def test_ambiguous_and_based_corresp_are_not_image_links(self):
        content = self.fixture('<lb corresp="#z" xml:base="elsewhere.xml"/>甲')
        self.assertEqual(self.call(content, include_lb_corresp=True)['result']['total_occurrences'], 0)
        content = self.fixture('<lb corresp="#z"/>甲') + '<zone xml:id="z"/>'
        self.assertEqual(self.call(content, include_lb_corresp=True)['result']['total_occurrences'], 0)

    def test_omission_branches_and_nested_milestones(self):
        content = self.fixture('<lb corresp="#z"/>' + '字' * 30 + '<lb/>後')
        line = self.call(content, include_lb_corresp=True, limits=replace(Limits(), unit_payload=20))['result']['items'][0]
        self.assertIsNone(line['line_range']['content'])
        self.assertEqual(line['line_range']['omission']['code'], 'unit_too_large')
        for body in ('<choice><orig><lb corresp="#z"/>甲</orig><reg>乙</reg></choice>',
                     '<lb corresp="#z"/>甲<hi><lb/>乙</hi>丙'):
            line = self.call(self.fixture(body), include_lb_corresp=True)['result']['items'][0]
            self.assertIsNone(line['line_range'])
            self.assertIn('line_stream_requires_review', line['diagnostics'])
        for bad in (1, 'true', None):
            self.assertEqual(self.call(content, include_lb_corresp=bad)['error']['code'], 'invalid_request')
