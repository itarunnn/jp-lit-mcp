"""header確認、単位選択、構造抽出、申告来歴の対応照合。"""

from collections import Counter
import json
import math
from pathlib import Path
import re
from .document import local_file_path, read_local_bytes
from .locator import make_locator, resolve_locator, resolve_path
from .model import Element, Index, JsonValue, Limits, ReaderError, TEI_NS, UnitSummary, XML_ID
from .tree import structured_unit


def unit_summary(index: Index, element: Element) -> UnitSummary:
    parent = index.parents[element]
    return {'locator':make_locator(index,element),'name':element.name,'attributes':dict(element.attributes),
            'parent_locator':make_locator(index,parent) if parent else None,'depth':index.depths[element]}


def _descendants(node):
    stack = [child for child in reversed(node.content) if isinstance(child,Element)]
    while stack:
        current = stack.pop()
        yield current
        stack.extend(child for child in reversed(current.content) if isinstance(child,Element))


def _manifest_claims(index, manifest_path, limits):
    resolved = local_file_path(manifest_path)
    try:
        raw = read_local_bytes(resolved, limits.manifest_bytes)
    except ReaderError as error:
        if error.code == 'input_too_large':
            raise ReaderError('invalid_manifest','manifestの容量上限を超えています。') from None
        raise
    def pairs(items):
        output = {}
        for key,value in items:
            if key in output:
                raise ValueError('duplicate key')
            output[key]=value
        return output
    def nonfinite(value):
        raise ValueError('nonfinite')
    def finite_float(value):
        parsed=float(value)
        if not math.isfinite(parsed):
            raise ValueError('nonfinite')
        return parsed
    try:
        records = json.loads(raw.decode('utf-8-sig'),object_pairs_hook=pairs,parse_constant=nonfinite,parse_float=finite_float)
        if not isinstance(records,list) or len(records)>limits.manifest_records:
            raise ValueError('records')
        optional = ('url','repository','commit','path','retrieved_at')
        matches=[]
        for record in records:
            if not isinstance(record,dict) or not isinstance(record.get('local_path'),str) or not record['local_path']:
                raise ValueError('path')
            if not isinstance(record.get('sha256'),str) or not re.fullmatch('[0-9a-f]{64}',record['sha256']):
                raise ValueError('sha256')
            if type(record.get('bytes')) is not int or record['bytes']<0:
                raise ValueError('bytes')
            if any(k in record and not isinstance(record[k],str) for k in optional):
                raise ValueError('optional')
            candidate=(resolved.parent/record['local_path']).resolve()
            if candidate == index.document.file_path:
                matches.append(record)
    except (ValueError,UnicodeError,RecursionError,OSError,RuntimeError):
        raise ReaderError('invalid_manifest','manifestのJSONとfieldを確認してください。') from None
    if len(matches)!=1 or matches[0]['sha256']!=index.document.sha256 or matches[0]['bytes']!=index.document.byte_length:
        raise ReaderError('manifest_mismatch','manifestと指定XMLのpath/hash/bytesが一意に一致しません。')
    record=matches[0]
    return {**{k:record[k] for k in ('local_path','sha256','bytes',*optional) if k in record},
            'match_basis':'local_path+sha256+bytes','verification_state':'manifest_claims_matched_to_local_bytes'}


def inspect_document(index: Index, manifest_path: Path | None, limits: Limits) -> dict[str,JsonValue]:
    root=index.document.root
    children=[c for c in root.content if isinstance(c,Element)]
    headers=[c for c in children if c.name==f'{{{TEI_NS}}}teiHeader']
    bodies=[b for text in children if text.name==f'{{{TEI_NS}}}text' for b in text.content if isinstance(b,Element) and b.name==f'{{{TEI_NS}}}body']
    warnings=[]
    for objects,name in ((headers,'header'),(bodies,'body')):
        if not objects:
            warnings.append(f'missing_{name}')
        elif len(objects)>1:
            warnings.append(f'multiple_{name}s' if name=='header' else 'multiple_bodies')
    header=None
    if headers:
        header={'locator':make_locator(index,headers[0]),'content':None,'omission':None}
        try:
            header['content']=structured_unit(index,headers[0],limits)['content']
        except ReaderError as error:
            if error.code!='unit_too_large':
                raise
            header['omission']={'code':'unit_too_large'}
    counts=Counter()
    for body in bodies:
        counts[body.name]+=1
        counts.update(n.name for n in _descendants(body))
    return {'root':unit_summary(index,root),'document_element_counts':dict(Counter(n.name for n in index.elements)),
            'body_element_counts':dict(counts),'body_locators':[make_locator(index,b) for b in bodies],
            'header':header,'structure_warnings':warnings,
            'id_statistics':{'distinct_ids':len(index.ids),'duplicate_ids':sum(len(v)>1 for v in index.ids.values()),
                             'empty_id_occurrences':sum(n.attributes.get(XML_ID)=='' for n in index.elements)},
            'outside_root_misc':dict(index.document.outside_root_misc),
            'manifest_claims':_manifest_claims(index,manifest_path,limits) if manifest_path is not None else None}


def validate_page(limit: int, offset: int):
    if type(limit) is not int or not 1<=limit<=100 or type(offset) is not int or offset<0:
        raise ReaderError('invalid_request','limitは1〜100、offsetは非負整数で指定してください。')


def list_units(index: Index, scope_xpath: str, relation: str, element: str | None,
               attribute_equals: dict[str,str], limit: int, offset: int) -> dict[str,JsonValue]:
    validate_page(limit,offset)
    if relation not in ('children','descendants'):
        raise ReaderError('invalid_request','relationを確認してください。')
    scope=resolve_path(index,scope_xpath)
    candidates=(c for c in scope.content if isinstance(c,Element)) if relation=='children' else _descendants(scope)
    total=0
    items=[]
    for node in candidates:
        if (element is None or node.name==element) and all(node.attributes.get(k)==v for k,v in attribute_equals.items()):
            if offset<=total<offset+limit:
                items.append(unit_summary(index,node))
            total+=1
    return {'scope_locator':make_locator(index,scope),'relation':relation,'total_matching':total,'returned_count':len(items),
            'offset':offset,'limit':limit,'next_offset':offset+len(items) if offset+len(items)<total else None,'items':items}


def extract_unit(index: Index, locator, limits: Limits) -> dict[str,JsonValue]:
    return structured_unit(index,resolve_locator(index,locator),limits)
