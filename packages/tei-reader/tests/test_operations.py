"""一覧の範囲混同、header平坦化、申告来歴の誤照合を検知する。"""

from dataclasses import replace
import json
from tei_reader.document import load_document
from tei_reader.locator import build_index, make_locator
from tei_reader.operations import inspect_document, list_units, extract_unit
from tei_reader.model import Limits, TEI_NS
from tests.support import ReaderCase


class OperationTests(ReaderCase):
    def index(self, content):
        return build_index(load_document(self.write_xml(content), None, Limits()))

    def test_inspect_scopes(self):
        index = self.index('<teiHeader><title>題<hi>補</hi></title></teiHeader><text><body><p/></body></text>')
        result = inspect_document(index,None,Limits())
        self.assertEqual(result['body_element_counts'], {f'{{{TEI_NS}}}body':1,f'{{{TEI_NS}}}p':1})
        self.assertEqual(result['header']['locator']['xpath'], '/t:TEI[1]/t:teiHeader[1]')
        self.assertEqual(result['header']['content']['content'][0]['content'][0]['value'],'題')
        self.assertEqual(result['structure_warnings'], [])
        result = inspect_document(index,None,replace(Limits(),unit_elements=1))
        self.assertIsNone(result['header']['content'])
        self.assertEqual(result['header']['omission']['code'],'unit_too_large')

    def test_missing_multiple_scopes(self):
        result=inspect_document(self.index(''),None,Limits())
        self.assertEqual(result['structure_warnings'],['missing_header','missing_body'])
        result=inspect_document(self.index('<teiHeader/><teiHeader/><text><body/><body/></text>'),None,Limits())
        self.assertEqual(result['structure_warnings'],['multiple_headers','multiple_bodies'])
        self.assertEqual(result['body_element_counts'][f'{{{TEI_NS}}}body'],2)

    def test_list_scope_filters(self):
        index=self.index('<div><ab type="長歌" n="230"/><ab type="⻑歌" n="230"/><ab type=""/><ab/></div>')
        scope='/t:TEI[1]'
        self.assertEqual(list_units(index,scope,'children',None,{},20,0)['total_matching'],1)
        self.assertEqual(list_units(index,scope,'descendants',None,{},20,0)['total_matching'],5)
        exact=list_units(index,scope,'descendants',f'{{{TEI_NS}}}ab',{'type':'長歌'},20,0)
        self.assertEqual(exact['total_matching'],1)
        empty=list_units(index,scope,'descendants',None,{'type':''},20,0)
        self.assertEqual(empty['total_matching'],1)
        repeats=list_units(index,scope,'descendants',None,{'n':'230'},1,0)
        self.assertEqual(repeats['total_matching'],2)
        self.assertEqual(repeats['next_offset'],1)
        self.assertEqual(list_units(index,scope,'descendants',None,{},100,999)['items'],[])
        for limit in (0,101):
            self.error('invalid_request',list_units,index,scope,'children',None,{},limit,0)

    def manifest(self,index,**updates):
        record={'local_path':index.document.file_path.name,'sha256':index.document.sha256,'bytes':index.document.byte_length,
                'url':'https://example.org/claimed','commit':'claimed','secret_extra':'exclude'}
        record.update(updates)
        path=self.base/'manifest.json'
        path.write_text(json.dumps([record]),encoding='utf-8')
        return path,record

    def test_manifest_claims(self):
        index=self.index('<teiHeader/>')
        path,record=self.manifest(index)
        claims=inspect_document(index,path,Limits())['manifest_claims']
        self.assertEqual(claims['url'],'https://example.org/claimed')
        self.assertEqual(claims['verification_state'],'manifest_claims_matched_to_local_bytes')
        self.assertNotIn('secret_extra',claims)
        for update in ({'sha256':'0'*64},{'bytes':999},{'local_path':'other.xml'}):
            path,_=self.manifest(index,**update)
            self.error('manifest_mismatch',inspect_document,index,path,Limits())
        path,record=self.manifest(index)
        path.write_text(json.dumps([record,record]),encoding='utf-8')
        self.error('manifest_mismatch',inspect_document,index,path,Limits())

    def test_manifest_limits_and_invalid_json(self):
        index=self.index('')
        path,record=self.manifest(index)
        raw=json.dumps([record]).encode()
        path.write_bytes(raw+b' '*(65536-len(raw)))
        self.assertIsNotNone(inspect_document(index,path,Limits())['manifest_claims'])
        path.write_bytes(path.read_bytes()+b' ')
        self.error('invalid_manifest',inspect_document,index,path,Limits())
        for raw in (b'[',b'[{"local_path":"a","local_path":"b"}]',b'[NaN]',b'{}'):
            path.write_bytes(raw)
            self.error('invalid_manifest',inspect_document,index,path,Limits())
        path.write_bytes(b'\xef\xbb\xbf'+json.dumps([record]).encode())
        self.assertIsNotNone(inspect_document(index,path,Limits())['manifest_claims'])
        path.write_text(json.dumps([record]+[dict(record,local_path=f'other{i}') for i in range(99)]),encoding='utf-8')
        self.assertIsNotNone(inspect_document(index,path,Limits())['manifest_claims'])
        path.write_text(json.dumps([record]+[dict(record,local_path=f'other{i}') for i in range(100)]),encoding='utf-8')
        self.error('invalid_manifest',inspect_document,index,path,Limits())
        for update in ({'bytes':True},{'sha256':'bad'},{'local_path':''},{'url':False}):
            path,_=self.manifest(index,**update)
            self.error('invalid_manifest',inspect_document,index,path,Limits())

    def test_extract_layers(self):
        index=self.index('<lg><l type="本文"><choice><orig>萬</orig><reg>万</reg></choice><subst><del>乃</del><add>刀</add></subst></l><l type="訓">よみ<note targetEnd="#a">注</note><anchor xml:id="a"/></l><pb facs="#zone"/><zone xml:id="zone" ulx="1"/></lg>')
        result=extract_unit(index,make_locator(index,index.elements[1]),Limits())
        contents=result['content']['content']
        self.assertEqual(contents[0]['attributes']['type'],'本文')
        self.assertEqual(contents[1]['attributes']['type'],'訓')
        self.assertEqual([n['name'] for n in contents[0]['content'][0]['content']], [f'{{{TEI_NS}}}orig',f'{{{TEI_NS}}}reg'])
        self.assertEqual([n['name'] for n in contents[0]['content'][1]['content']], [f'{{{TEI_NS}}}del',f'{{{TEI_NS}}}add'])
        self.assertIsNone(result['reading_text'])
        self.assertNotIn('quality_flags',result)

    def test_manifest_overflow_float_is_nonfinite(self):
        index=self.index('')
        path,_=self.manifest(index)
        raw=path.read_text(encoding='utf-8').replace('"exclude"','1e999')
        path.write_text(raw,encoding='utf-8')
        self.error('invalid_manifest',inspect_document,index,path,Limits())
