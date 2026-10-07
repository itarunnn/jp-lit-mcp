"""XML空白で分割したliteral参照の点検。外部資源を取得しない。"""

import re
from .locator import make_locator, resolve_path
from .model import Index, JsonValue, ReaderError, XML_BASE
from .operations import validate_page

DEFAULT_ATTRIBUTES = ['ref','who','toWhom','facs','corresp','target','targetEnd','resp','rendition','sameAs','url']
STATUSES = ('resolved_local','unresolved_local','ambiguous_local','empty_fragment_unverified',
            'base_context_unverified','external_unverified','relative_or_bare_unverified')


def _base_chain(index, node):
    chain=[]
    while node is not None:
        if XML_BASE in node.attributes:
            chain.append({'locator':make_locator(index,node),'value':node.attributes[XML_BASE]})
        node=index.parents[node]
    chain.reverse()
    return chain


def resolve_reference(index, owner, token):
    """参照属性を宣言した要素のbaseとID集合でliteral tokenを点検する。"""
    chain = _base_chain(index, owner)
    targets = []
    if token == '#':
        status = 'empty_fragment_unverified'
    elif token.startswith('#'):
        if any(entry['value'] for entry in chain):
            status = 'base_context_unverified'
        else:
            targets = index.ids.get(token[1:], [])
            status = 'resolved_local' if len(targets) == 1 else ('ambiguous_local' if targets else 'unresolved_local')
    elif re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:', token):
        status = 'external_unverified'
    else:
        status = 'relative_or_bare_unverified'
    return {'status': status, 'target_locator': make_locator(index, targets[0]) if len(targets) == 1 else None,
            'candidate_count': len(targets), 'xml_base_chain': chain}


def check_references(index: Index, attributes: list[str], limit: int, offset: int,
                     scope_xpath: str | None = None) -> dict[str,JsonValue]:
    validate_page(limit,offset)
    if not isinstance(attributes,list) or not 1<=len(attributes)<=16 or any(not isinstance(a,str) or not a for a in attributes) or len(set(attributes))!=len(attributes):
        raise ReaderError('invalid_request','参照属性を重複のない1〜16個のkeyで指定してください。')
    summary={a:{**dict.fromkeys(STATUSES,0),'empty_attribute_occurrences':0} for a in attributes}
    items=[]
    total=0
    scope=resolve_path(index,scope_xpath) if scope_xpath is not None else None
    scope_prefix=index.paths[scope]+'/' if scope is not None else None
    for node in index.elements:
        if scope is not None and node is not scope and not index.paths[node].startswith(scope_prefix):
            continue
        chain=None
        for attribute in attributes:
            if attribute not in node.attributes:
                continue
            value=node.attributes[attribute]
            tokens=[t for t in re.split(r'[ \t\r\n]+',value) if t]
            if not tokens:
                summary[attribute]['empty_attribute_occurrences']+=1
                continue
            if chain is None:
                chain=_base_chain(index,node)
            for token_index,token in enumerate(tokens):
                resolved = resolve_reference(index, node, token)
                status = resolved['status']
                summary[attribute][status]+=1
                if offset<=total<offset+limit:
                    items.append({'source_locator':make_locator(index,node),'attribute':attribute,'attribute_value':value,
                                  'token_index':token_index,'raw_token':token,'status':status,
                                  **resolved})
                total+=1
    return {'checked_scope':'literal_scope_fragments' if scope is not None else 'literal_document_fragments',
            'scope_locator':make_locator(index,scope) if scope is not None else None,
            'repair_applied':False,'remote_resources_fetched':False,
            'total_occurrences':total,'summary_by_attribute':summary,'offset':offset,'limit':limit,'returned_count':len(items),
            'next_offset':offset+len(items) if offset+len(items)<total else None,'items':items}
