"""実CLIのJSON/終了code/文字encoding/失敗時非出力を検証する。"""

from dataclasses import replace
import hashlib
import json
import os
import subprocess
import sys
import tracemalloc
from unittest.mock import patch
from tei_reader.protocol import parse_request, execute_request, encode_response
from tei_reader.model import Limits
from tests.support import ReaderCase


class CLITests(ReaderCase):
    def call(self, request=None, *, raw=None, args=None):
        data=raw if raw is not None else json.dumps(request,ensure_ascii=False).encode()
        return subprocess.run([sys.executable,'-m','tei_reader',*(args or ['--request','-'])],input=data,capture_output=True)

    def check_response(self, completed, exit_code):
        self.assertEqual(completed.returncode,exit_code,completed.stderr)
        self.assertEqual(completed.stderr,b'')
        self.assertTrue(completed.stdout.endswith(b'\n'))
        self.assertEqual(completed.stdout.count(b'\n'),1)
        result=json.loads(completed.stdout)
        self.assertEqual(result['api_version'],'0.1')
        return result

    def requests(self):
        path=self.write_xml('<teiHeader><title>題</title></teiHeader><text><body><p xml:id="a">文</p></body></text>')
        base={'file_path':str(path),'expected_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        locator={'document_sha256':base['expected_sha256'],'xpath':'/t:TEI[1]/t:text[1]/t:body[1]/t:p[1]'}
        return [dict(base,operation='inspect_document'),dict(base,operation='list_units',scope_xpath='/t:TEI[1]'),
                dict(base,operation='extract_unit',locator=locator),dict(base,operation='check_references')]

    def test_cli_four_operations(self):
        for request in self.requests():
            with self.subTest(operation=request['operation']):
                response=self.check_response(self.call(request),0)
                self.assertTrue(response['ok'])
                self.assertFalse(response['document']['verification']['tei_schema_validated'])
                request_file=self.base/'要求 空白.json'
                request_file.write_text(json.dumps(request,ensure_ascii=False),encoding='utf-8')
                self.assertTrue(self.check_response(self.call(request,args=['--request',str(request_file)]),0)['ok'])
        request=self.requests()[0]
        request.pop('expected_sha256')
        self.assertTrue(self.check_response(self.call(request),0)['ok'])

    def test_request_errors(self):
        request=self.requests()[1]
        variants=[dict(request,operation='unknown'),dict(request,unknown='x'),dict(request,limit=True),dict(request,limit=0),
                  dict(request,limit=101),dict(request,offset=-1),dict(request,relation='other'),
                  dict(request,element='t:div'),dict(request,attribute_equals={'x':False}),dict(request,expected_sha256='BAD')]
        omitted=dict(request);omitted.pop('expected_sha256');variants.append(omitted)
        for variant in variants:
            result=self.check_response(self.call(variant),2)
            self.assertEqual(result['error']['code'],'invalid_request')
        for raw in (b'{"operation":"x","operation":"y"}',b'{"x":NaN}',b'[]',b'{',b'{"x":1e999}',b'{'*2000):
            self.assertEqual(self.check_response(self.call(raw=raw),2)['error']['code'],'invalid_request')
        self.assertIsNone(self.check_response(self.call(variants[0]),2)['operation'])
        self.check_response(self.call(request,args=['--no-such-option']),2)
        extract=self.requests()[2]
        self.check_response(self.call(dict(extract,view='plain')),2)
        refs=self.requests()[3]
        for attributes in ([],['ref','ref'],['x']*17):
            self.check_response(self.call(dict(refs,attributes=attributes)),2)

    def test_utf8_bom_request_limits(self):
        request=self.requests()[0]
        raw=json.dumps(request,ensure_ascii=False).encode()
        self.check_response(self.call(raw=b'\xef\xbb\xbf'+raw),0)
        self.check_response(self.call(raw=raw+b' '*(65536-len(raw))),0)
        self.check_response(self.call(raw=raw+b' '*(65537-len(raw))),2)

    def test_response_budget(self):
        path=self.write_xml('<p huge="'+'x'*1_048_576+'"/>')
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        request={'operation':'extract_unit','file_path':str(path),'expected_sha256':digest,
                 'locator':{'document_sha256':digest,'xpath':'/t:TEI[1]/t:p[1]'}}
        result=self.check_response(self.call(request),3)
        self.assertEqual(result['error']['code'],'output_too_large')
        self.assertNotIn('content',result)
        small={'ok':True,'result':'😀'}
        encoded=encode_response(small,Limits())
        self.assertEqual(encoded,json.dumps(small,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()+b'\n')
        self.assertEqual(encode_response(small,replace(Limits(),response_bytes=len(encoded))),encoded)
        self.error('output_too_large',encode_response,small,replace(Limits(),response_bytes=len(encoded)-1))
        for result in ({'locator':'/t:p[1]'*200000},{'namespaces':{f'n{i}':'u'*100 for i in range(12000)}}):
            self.error('output_too_large',encode_response,result,Limits())

    def test_error_privacy(self):
        path=self.write_xml(full=b'<TEI>SECRET_UNCLOSED')
        result=self.check_response(self.call({'operation':'inspect_document','file_path':str(path)}),3)
        self.assertEqual(result['error']['code'],'invalid_xml')
        self.assertNotIn('SECRET_UNCLOSED',json.dumps(result))
        request=self.requests()[2]
        self.check_response(self.call(dict(request,expected_sha256='0'*64)),3)
        request['locator']['document_sha256']='0'*64
        self.check_response(self.call(request),3)
        valid=parse_request(json.dumps(self.requests()[0]).encode())
        with patch('tei_reader.protocol.load_document',side_effect=RuntimeError('SECRET_INTERNAL')):
            result=execute_request(valid,Limits())
        self.assertEqual(result['error']['code'],'internal_error')
        self.assertNotIn('SECRET_INTERNAL',json.dumps(result))

    def test_help_and_version(self):
        for arg in ('--help','--version'):
            completed=self.call({},args=[arg])
            self.assertEqual(completed.returncode,0)
            self.assertEqual(completed.stderr,b'')
            self.assertTrue(completed.stdout)

    def test_help_is_utf8_with_ascii_pipe_encoding(self):
        completed=subprocess.run(
            [sys.executable,'-m','tei_reader','--help'],
            input=b'',capture_output=True,
            env=dict(os.environ,PYTHONIOENCODING='ascii'),
        )
        self.assertEqual(completed.returncode,0,completed.stdout)
        self.assertEqual(completed.stderr,b'')
        self.assertIn('ローカルTEI',completed.stdout.decode('utf-8'))

    def test_response_budget_stops_generation(self):
        # 同一の長い原属性値をoccurrenceごとに保持する参照応答を再現する。
        response={'items':[{'attribute_value':'#a '*22000}]*100}
        tracemalloc.start()
        try:
            self.error('output_too_large',encode_response,response,Limits())
            _,peak=tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
        self.assertLess(peak,4*1024*1024)
