"""固定文書のQNameと兄弟indexによる正規位置。"""

from collections import Counter
import re
from .model import Document, Element, Index, Limits, Locator, ReaderError, TEI_NS, XML_ID, XML_NS


def _split_name(name):
    if name.startswith('{'):
        uri, local = name[1:].split('}', 1)
        return uri, local
    return '', name


def build_index(document: Document, limits: Limits = Limits()) -> Index:
    elements = []
    parents, depths = {}, {}
    uris = set()
    ids = {}
    stack = [(document.root, None, 1)]
    while stack:
        node, parent, depth = stack.pop()
        elements.append(node)
        parents[node], depths[node] = parent, depth
        for name in (node.name, *node.attributes):
            uri, _ = _split_name(name)
            if uri:
                uris.add(uri)
        if node.attributes.get(XML_ID):
            ids.setdefault(node.attributes[XML_ID], []).append(node)
        stack.extend((child, node, depth+1) for child in reversed(node.content) if isinstance(child, Element))
    namespaces = {'t': TEI_NS, 'xml': XML_NS}
    namespaces.update({f'n{i}': uri for i, uri in enumerate(sorted(uris - {TEI_NS, XML_NS}), 1)})
    prefixes = {uri: prefix for prefix, uri in namespaces.items()}
    counters = {}
    paths = {}
    path_chars = 0
    for node in elements:
        parent = parents[node]
        counter = counters.setdefault(parent, Counter())
        counter[node.name] += 1
        uri, local = _split_name(node.name)
        qname = f'{prefixes[uri]}:{local}' if uri else local
        parent_path = paths[parent] if parent is not None else ''
        step = f'/{qname}[{counter[node.name]}]'
        path_chars += len(parent_path) + len(step)
        if path_chars > limits.index_path_chars:
            raise ReaderError('document_too_complex', 'XPath索引の容量上限を超えています。',
                              {'resource': 'index_path_chars', 'maximum': limits.index_path_chars})
        paths[node] = parent_path + step
    return Index(document, namespaces, elements, paths, {p:n for n,p in paths.items()}, parents, depths, ids)


def make_locator(index: Index, element: Element) -> Locator:
    value = element.attributes.get(XML_ID)
    return {'document_sha256': index.document.sha256, 'xpath': index.paths[element],
            'xml_id': value if value and len(index.ids[value]) == 1 else None}


# XML 1.0 (Fifth Edition) のNameStartChar/NameCharからcolonを除くNCName。
_START = r'A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\U00010000-\U000EFFFF'
_REST = _START + r'0-9.\-\u00B7\u0300-\u036F\u203F-\u2040'
_PATH = re.compile(r'(?:/(?:[A-Za-z_][A-Za-z_0-9]*:)?['+_START+r']['+_REST+r']*\[[1-9][0-9]*\])+\Z')


def resolve_path(index: Index, xpath: str) -> Element:
    if not isinstance(xpath, str) or not _PATH.fullmatch(xpath):
        raise ReaderError('invalid_locator', 'readerの正規絶対pathを指定してください。')
    node = index.by_path.get(xpath)
    if node is None:
        raise ReaderError('locator_not_found', '指定位置が文書内にありません。')
    return node


def resolve_locator(index: Index, locator: Locator) -> Element:
    if locator['document_sha256'] != index.document.sha256:
        raise ReaderError('hash_mismatch', 'locatorと入力文書のhashが一致しません。')
    node = resolve_path(index, locator['xpath'])
    if 'xml_id' in locator and locator['xml_id'] != make_locator(index, node)['xml_id']:
        raise ReaderError('invalid_locator', '補助IDが指定位置と一致しません。')
    return node
