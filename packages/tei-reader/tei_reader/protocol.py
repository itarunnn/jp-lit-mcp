"""JSON要求の契約、操作のdispatch、共通応答。"""

import json
from collections.abc import Mapping
import math
from pathlib import Path
import re
from .document import load_document
from .locator import build_index
from .model import JsonValue, Limits, ReaderError
from .operations import extract_unit, inspect_document, list_units, validate_page
from .references import check_references, DEFAULT_ATTRIBUTES
from .facsimile import facsimile_links

OPERATIONS = {'inspect_document','list_units','extract_unit','check_references','facsimile_links'}
_HASH = re.compile(r'[0-9a-f]{64}\Z')
_NAME = re.compile(r'(?:\{[^{}]+\})?[^{}:/\s\[\]*()@|\'"=]+\Z')


def _invalid():
    raise ReaderError('invalid_request','要求JSONの操作・field・型を確認してください。')


def _is_hash(value):
    return isinstance(value,str) and bool(_HASH.fullmatch(value))


def _is_name(value):
    return isinstance(value,str) and bool(_NAME.fullmatch(value))


def validate_request(request):
    if not isinstance(request,dict) or not isinstance(request.get('operation'),str) or request['operation'] not in OPERATIONS:
        _invalid()
    op=request['operation']
    fields={'operation','file_path','expected_sha256'}
    additions={'inspect_document':{'provenance_manifest_path'},'list_units':{'scope_xpath','relation','element','attribute_equals','limit','offset'},
               'extract_unit':{'locator','view'},'check_references':{'attributes','limit','offset','scope_xpath'},
               'facsimile_links':{'limit','offset','include_inherited'}}
    if request.keys()-(fields|additions[op]) or not isinstance(request.get('file_path'),str) or not request['file_path']:
        _invalid()
    expected=request.get('expected_sha256')
    if not _is_hash(expected) and not (op=='inspect_document' and expected is None):
        _invalid()
    normalized=dict(request,expected_sha256=expected)
    if op=='inspect_document':
        path=request.get('provenance_manifest_path')
        if path is not None and (not isinstance(path,str) or not path):
            _invalid()
        normalized['provenance_manifest_path']=path
    elif op=='list_units':
        if not isinstance(request.get('scope_xpath'),str) or not request['scope_xpath']:
            _invalid()
        relation=request.get('relation','children')
        if not isinstance(relation,str) or relation not in ('children','descendants'):
            _invalid()
        element=request.get('element')
        if element is not None and not _is_name(element):
            _invalid()
        attrs=request.get('attribute_equals',{})
        if not isinstance(attrs,dict) or len(attrs)>16 or any(not _is_name(k) or not isinstance(v,str) for k,v in attrs.items()):
            _invalid()
        normalized.update(relation=relation,element=element,attribute_equals=attrs)
    elif op=='extract_unit':
        locator=request.get('locator')
        if not isinstance(locator,dict) or locator.keys()-{'document_sha256','xpath','xml_id'}:
            _invalid()
        if not _is_hash(locator.get('document_sha256')) or not isinstance(locator.get('xpath'),str) or not locator['xpath']:
            _invalid()
        if 'xml_id' in locator and locator['xml_id'] is not None and not isinstance(locator['xml_id'],str):
            _invalid()
        if request.get('view','structured')!='structured':
            _invalid()
        normalized['view']='structured'
    elif op=='check_references':
        attrs=request.get('attributes',DEFAULT_ATTRIBUTES)
        if not isinstance(attrs,list) or not 1<=len(attrs)<=16 or any(not _is_name(a) for a in attrs) or len(set(attrs))!=len(attrs):
            _invalid()
        normalized['attributes']=list(attrs)
        scope=request.get('scope_xpath')
        if scope is not None and (not isinstance(scope,str) or not scope):
            _invalid()
        normalized['scope_xpath']=scope
    if op == 'facsimile_links':
        inherited = request.get('include_inherited', False)
        if not isinstance(inherited, bool):
            _invalid()
        normalized['include_inherited'] = inherited
    if op in ('list_units','check_references','facsimile_links'):
        limit,offset=request.get('limit',20),request.get('offset',0)
        validate_page(limit,offset)
        normalized.update(limit=limit,offset=offset)
    return normalized


def parse_request(raw: bytes) -> dict[str,JsonValue]:
    if len(raw)>Limits().request_bytes:
        _invalid()
    def pairs(items):
        result={}
        for key,value in items:
            if key in result:
                raise ValueError('duplicate')
            result[key]=value
        return result
    def nonfinite(value):
        raise ValueError('nonfinite')
    def finite_float(value):
        parsed=float(value)
        if not math.isfinite(parsed):
            raise ValueError('nonfinite')
        return parsed
    try:
        decoded=json.loads(raw.decode('utf-8-sig'),object_pairs_hook=pairs,parse_constant=nonfinite,parse_float=finite_float)
    except (ValueError,UnicodeError,RecursionError):
        _invalid()
    return validate_request(decoded)


def error_response(operation, error: ReaderError):
    return {'api_version':'0.1','operation':operation if isinstance(operation,str) and operation in OPERATIONS else None,
            'ok':False,'error':{'code':error.code,'message':error.message,'details':error.details}}


def execute_request(request: dict[str,JsonValue], limits: Limits) -> dict[str,JsonValue]:
    operation=request.get('operation') if isinstance(request,dict) else None
    try:
        request=validate_request(request)
        doc=load_document(Path(request['file_path']),request['expected_sha256'],limits)
        index=build_index(doc,limits)
        if operation=='inspect_document':
            path=request['provenance_manifest_path']
            result=inspect_document(index,Path(path) if path is not None else None,limits)
        elif operation=='list_units':
            result=list_units(index,request['scope_xpath'],request['relation'],request['element'],request['attribute_equals'],request['limit'],request['offset'])
        elif operation=='extract_unit':
            result=extract_unit(index,request['locator'],limits)
        elif operation=='facsimile_links':
            result=facsimile_links(index,request['limit'],request['offset'],limits,request['include_inherited'])
        else:
            result=check_references(index,request['attributes'],request['limit'],request['offset'],request['scope_xpath'])
        return {'api_version':'0.1','operation':operation,'ok':True,
                'document':{'sha256':doc.sha256,'byte_length':doc.byte_length,'namespaces':index.namespaces,
                            'verification':{'xml_well_formed':True,'tei_schema_validated':False,'remote_resources_fetched':False,'source_collated':False}},
                'result':result}
    except ReaderError as error:
        return error_response(operation,error)
    except Exception:
        return error_response(operation,ReaderError('internal_error','内部処理を完了できません。'))


def encode_response(response: dict[str,JsonValue], limits: Limits) -> bytes:
    def mapping_default(value):
        if isinstance(value,Mapping):
            return dict(value)
        raise TypeError('Unsupported JSON value')
    encoder=json.JSONEncoder(ensure_ascii=False,separators=(',',':'),allow_nan=False,default=mapping_default)
    buffer=bytearray()
    for chunk in encoder.iterencode(response):
        encoded=chunk.encode('utf-8')
        if len(buffer)+len(encoded)+1>limits.response_bytes:
            raise ReaderError('output_too_large','応答JSONのbyte上限を超えています。',{'max_bytes':limits.response_bytes})
        buffer.extend(encoded)
    buffer.extend(b'\n')
    return bytes(buffer)


def response_exit(response):
    if response['ok']:
        return 0
    code=response['error']['code']
    return 2 if code=='invalid_request' else (4 if code=='internal_error' else 3)
