"""選択範囲の参照点検と全文書のID/base解決を実要求で確認する。"""

import hashlib
from tei_reader.model import Limits
from tei_reader.protocol import execute_request
from tests.support import ReaderCase


class ReferenceScopeTests(ReaderCase):
    def call(self, path, **extra):
        return execute_request({
            'operation': 'check_references', 'file_path': str(path),
            'expected_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'attributes': ['ref'], 'limit': 100, **extra,
        }, Limits())

    def test_scope_includes_root_and_resolves_ids_outside_scope(self):
        path = self.write_xml('<p xml:id="outside"/><div ref="#outside"><p ref="#missing"/></div><div ref="#else"/>')
        scoped = self.call(path, scope_xpath='/t:TEI[1]/t:div[1]')
        self.assertTrue(scoped['ok'], scoped)
        result = scoped['result']
        self.assertEqual(result['checked_scope'], 'literal_scope_fragments')
        self.assertEqual(result['scope_locator']['xpath'], '/t:TEI[1]/t:div[1]')
        self.assertEqual(result['total_occurrences'], 2)
        self.assertEqual([i['raw_token'] for i in result['items']], ['#outside', '#missing'])
        self.assertEqual(result['items'][0]['target_locator']['xpath'], '/t:TEI[1]/t:p[1]')
        self.assertEqual(result['summary_by_attribute']['ref']['unresolved_local'], 1)
        self.assertFalse(result['remote_resources_fetched'])

    def test_ancestor_base_and_global_duplicate_ids_are_preserved(self):
        path = self.write_xml('<p xml:id="dup"/><p xml:id="dup"/><div xml:base="remote.xml"><p ref="#dup" xml:base=""/></div><p ref="#dup"/>')
        based = self.call(path, scope_xpath='/t:TEI[1]/t:div[1]/t:p[1]')
        self.assertTrue(based['ok'], based)
        item = based['result']['items'][0]
        self.assertEqual(item['status'], 'base_context_unverified')
        self.assertEqual([b['value'] for b in item['xml_base_chain']], ['remote.xml', ''])
        duplicate = self.call(path, scope_xpath='/t:TEI[1]/t:p[3]')
        self.assertTrue(duplicate['ok'], duplicate)
        self.assertEqual(duplicate['result']['items'][0]['status'], 'ambiguous_local')
        self.assertEqual(duplicate['result']['items'][0]['candidate_count'], 2)

    def test_scope_pagination_empty_scope_and_null_compatibility(self):
        path = self.write_xml('<div>' + '<p ref="#a #b"/>' * 3 + '</div><p ref=""/>')
        whole = self.call(path)
        explicit_null = self.call(path, scope_xpath=None)
        self.assertTrue(explicit_null['ok'], explicit_null)
        self.assertEqual(explicit_null, whole)
        self.assertIsNone(whole['result']['scope_locator'])
        first = self.call(path, scope_xpath='/t:TEI[1]/t:div[1]', limit=4)
        second = self.call(path, scope_xpath='/t:TEI[1]/t:div[1]', limit=4, offset=4)
        self.assertTrue(first['ok'], first)
        self.assertTrue(second['ok'], second)
        self.assertEqual(first['result']['next_offset'], 4)
        self.assertIsNone(second['result']['next_offset'])
        self.assertEqual(first['result']['summary_by_attribute'], second['result']['summary_by_attribute'])
        self.assertEqual(first['result']['total_occurrences'], 6)
        empty = self.call(path, scope_xpath='/t:TEI[1]/t:p[1]')
        self.assertTrue(empty['ok'], empty)
        self.assertEqual(empty['result']['items'], [])
        self.assertEqual(empty['result']['summary_by_attribute']['ref']['empty_attribute_occurrences'], 1)

    def test_scope_errors_are_explicit(self):
        path = self.write_xml('<p/>')
        for scope in (False, 3, '', []):
            self.assertEqual(self.call(path, scope_xpath=scope)['error']['code'], 'invalid_request')
        for scope, code in (('//t:p', 'invalid_locator'), ('/t:TEI[1]/t:p[9]', 'locator_not_found')):
            self.assertEqual(self.call(path, scope_xpath=scope)['error']['code'], code)
