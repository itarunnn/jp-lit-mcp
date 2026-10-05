"""明示facs参照の構造・位置・未解決状態を実XMLで点検する。"""

import hashlib
from dataclasses import replace
from tei_reader.model import Limits
from tei_reader.protocol import execute_request, encode_response
from tests.support import ReaderCase


class FacsimileTests(ReaderCase):
    def call(self, path, *, limits=None, **extra):
        return execute_request({'operation': 'facsimile_links', 'file_path': str(path),
                                'expected_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                **extra}, limits or Limits())

    def test_zone_surface_graphic_locators_and_original_choices(self):
        path = self.write_xml('''<facsimile><surface xml:id="s" ulx="10" uly="20" lrx="110" lry="220">
          <graphic url="https://example.org/page.jpg"/>
          <zone xml:id="z" ulx="20" uly="40" lrx="50" lry="100"/>
        </surface></facsimile><text><body><p xml:id="p" facs="#z #s">前<choice><orig>舊</orig>
          <reg>旧</reg></choice><del>消</del><add>加</add><note>注</note>後</p></body></text>''')
        response = self.call(path)
        self.assertTrue(response['ok'], response)
        items = response['result']['items']
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['reference_status'], 'resolved_local')
        self.assertEqual(items[0]['target']['locator']['xml_id'], 'z')
        self.assertEqual(items[0]['surface']['attributes']['ulx'], '10')
        self.assertEqual(items[0]['graphics'][0]['attributes']['url'], 'https://example.org/page.jpg')
        self.assertEqual(items[1]['source_locator']['xml_id'], 'p')
        self.assertEqual(items[0]['source_content']['content'][1]['name'], '{http://www.tei-c.org/ns/1.0}choice')
        self.assertFalse(response['document']['verification']['source_collated'])
        self.assertFalse(response['result']['remote_resources_fetched'])

    def test_duplicate_id_base_and_missing_target_remain_unresolved(self):
        path = self.write_xml('''<surface xml:id="d"/><surface xml:id="d"/>
        <p facs="#d #missing"/><div xml:base="https://example.org/other.xml"><p facs="#d"/></div>''')
        result = self.call(path)['result']
        self.assertEqual([i['reference_status'] for i in result['items']],
                         ['ambiguous_local', 'unresolved_local', 'base_context_unverified'])
        self.assertTrue(all(i['target'] is None for i in result['items']))
        self.assertEqual(result['items'][2]['xml_base_chain'][0]['value'], 'https://example.org/other.xml')

    def test_polygon_rotation_nested_zone_and_pb_are_preserved(self):
        path = self.write_xml('''<surface xml:id="s"><zone xml:id="z" points="1,2 3,4 5,6" rotate="15">
            <zone xml:id="nested"/></zone></surface><text><body><pb facs="#z"/>
            <p facs="#nested">本文</p><p facs="https://example.org/canvas#xywh=1,2,3,4"/></body></text>''')
        items = self.call(path)['result']['items']
        self.assertEqual(items[0]['source_content']['name'], '{http://www.tei-c.org/ns/1.0}pb')
        self.assertIn('milestone_content_not_expanded', items[0]['diagnostics'])
        self.assertEqual(items[0]['target']['attributes']['points'], '1,2 3,4 5,6')
        self.assertIn('nested_geometry', items[1]['diagnostics'])
        self.assertEqual(items[2]['raw_token'], 'https://example.org/canvas#xywh=1,2,3,4')

    def test_pagination_omission_and_hash_pin(self):
        path = self.write_xml('<p facs="#none">' + '字' * 30 + '</p><p facs="#two"/>')
        response = self.call(path, limit=1, limits=replace(Limits(), unit_payload=20))
        self.assertTrue(response['ok'], response)
        item = response['result']['items'][0]
        self.assertIsNone(item['source_content'])
        self.assertEqual(item['omission']['code'], 'unit_too_large')
        self.assertEqual(response['result']['next_offset'], 1)
        second = self.call(path, limit=1, offset=1)
        self.assertIsNone(second['result']['next_offset'])
        self.assertEqual(second['result']['items'][0]['token_index'], 0)
        bad = self.call(path, expected_sha256='0' * 64)
        self.assertEqual(bad['error']['code'], 'hash_mismatch')
        for args in ({'limit': 101}, {'limit': True}, {'offset': -1}, {'unexpected': True}):
            self.assertEqual(self.call(path, **args)['error']['code'], 'invalid_request')
        encode_response(response, Limits())
