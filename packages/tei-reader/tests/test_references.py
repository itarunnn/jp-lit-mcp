"""参照tokenの補正、重複IDの誤解決、baseの誤解釈を検知する。"""

from tei_reader.document import load_document
from tei_reader.locator import build_index
from tei_reader.model import Limits
from tei_reader.references import check_references
from tests.support import ReaderCase


class ReferenceTests(ReaderCase):
    def index(self, content):
        return build_index(load_document(self.write_xml(content),None,Limits()))

    def test_reference_states(self):
        index=self.index('<p xml:id="ok"/><p xml:id="dup"/><p xml:id="dup"/><p ref="#ok #missing #dup # name file.xml#ok https://example.org/x #a,b #a%20b #a&#160;b"/><p ref=""/>')
        result=check_references(index,['ref'],100,0)
        self.assertEqual(result['total_occurrences'],10)
        self.assertEqual([i['status'] for i in result['items']], ['resolved_local','unresolved_local','ambiguous_local','empty_fragment_unverified','relative_or_bare_unverified','relative_or_bare_unverified','external_unverified','unresolved_local','unresolved_local','unresolved_local'])
        self.assertEqual(result['items'][0]['target_locator']['xpath'],'/t:TEI[1]/t:p[1]')
        self.assertEqual(result['items'][2]['candidate_count'],2)
        self.assertIsNone(result['items'][2]['target_locator'])
        self.assertEqual([i['raw_token'] for i in result['items']][-3:],['#a,b','#a%20b','#a\u00a0b'])
        self.assertEqual(result['summary_by_attribute']['ref']['empty_attribute_occurrences'],1)
        self.assertEqual(result['summary_by_attribute']['ref']['unresolved_local'],4)

    def test_xml_base_context(self):
        index=self.index('<p xml:id="a"/><div xml:base="other.xml"><p ref="#a" xml:base=""/></div><p xml:base="" ref="#a"/>')
        items=check_references(index,['ref'],100,0)['items']
        self.assertEqual(items[0]['status'],'base_context_unverified')
        self.assertEqual([x['value'] for x in items[0]['xml_base_chain']],['other.xml',''])
        self.assertEqual(items[0]['xml_base_chain'][0]['locator']['xpath'],'/t:TEI[1]/t:div[1]')
        self.assertEqual(items[1]['status'],'resolved_local')

    def test_reference_pagination(self):
        index=self.index('<p who="#a #b" ref="#c"/>'*25)
        first=check_references(index,['ref','who'],20,0)
        second=check_references(index,['ref','who'],20,20)
        self.assertEqual(first['total_occurrences'],75)
        self.assertEqual(first['summary_by_attribute'],second['summary_by_attribute'])
        self.assertEqual(first['next_offset'],20)
        all_items=check_references(index,['ref','who'],100,0)['items']
        pages=[check_references(index,['ref','who'],20,n)['items'] for n in (0,20,40,60)]
        self.assertEqual(sum(pages,[]),all_items)
        self.assertEqual([i['raw_token'] for i in all_items[:3]],['#c','#a','#b'])
        self.assertEqual([i['token_index'] for i in all_items[:3]],[0,0,1])
        end=check_references(index,['ref'],100,999)
        self.assertEqual(end['items'],[])
        self.assertIsNone(end['next_offset'])

    def test_kokoro_attributes_fixture(self):
        index=self.index('<said who="#sensei bare" toWhom="#narrator" ana="#consumption"/>')
        result=check_references(index,['who','toWhom','ana'],20,0)
        self.assertEqual(result['total_occurrences'],4)
        self.assertEqual([i['status'] for i in result['items']],['unresolved_local','relative_or_bare_unverified','unresolved_local','unresolved_local'])
        for attrs in ([],['ref']*2,[f'a{i}' for i in range(17)]):
            self.error('invalid_request',check_references,index,attrs,20,0)
