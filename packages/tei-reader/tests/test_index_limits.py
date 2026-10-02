"""長い祖先名のpath増幅と索引容量境界を実要求で確認する。"""

from dataclasses import replace
from tei_reader.model import Limits
from tei_reader.protocol import execute_request
from tests.support import ReaderCase


class IndexLimitsTests(ReaderCase):
    def inspect(self, path, limits):
        return execute_request({'operation': 'inspect_document', 'file_path': str(path)}, limits)

    def test_long_parent_name_is_bounded_with_default_limits(self):
        name = 'a' * 20_000
        path = self.write_xml('<' + name + '>' + '<p/>' * 2_000 + '</' + name + '>')
        response = self.inspect(path, Limits())
        self.assertFalse(response['ok'])
        self.assertEqual(response['error']['code'], 'document_too_complex')
        self.assertEqual(response['error']['details']['resource'], 'index_path_chars')
        self.assertNotIn(name, str(response))

    def test_index_character_capacity_includes_each_complete_unicode_path(self):
        path = self.write_xml('<章><p/><p/></章>')
        total = sum(map(len, (
            '/t:TEI[1]',
            '/t:TEI[1]/t:章[1]',
            '/t:TEI[1]/t:章[1]/t:p[1]',
            '/t:TEI[1]/t:章[1]/t:p[2]',
        )))
        accepted = self.inspect(path, replace(Limits(), index_path_chars=total))
        self.assertTrue(accepted['ok'], accepted)
        rejected = self.inspect(path, replace(Limits(), index_path_chars=total - 1))
        self.assertFalse(rejected['ok'])
        self.assertEqual(rejected['error']['code'], 'document_too_complex')
        self.assertEqual(rejected['error']['details'], {
            'resource': 'index_path_chars', 'maximum': total - 1,
        })
