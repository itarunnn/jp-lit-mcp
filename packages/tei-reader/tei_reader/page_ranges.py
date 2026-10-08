"""pbの後続本文を原位置付きの部分構造として切り出す。"""

from .locator import make_locator
from .model import Comment, Element, PI, ReaderError, TEI_NS, Text

_STREAMS = {f'{{{TEI_NS}}}{n}' for n in ('text', 'sourceDoc')}
_BRANCHES = {f'{{{TEI_NS}}}{n}' for n in ('choice', 'app', 'note', 'subst', 'del', 'add')}
_PB = f'{{{TEI_NS}}}pb'


def _stream(index, node):
    current = index.parents[node]
    while current is not None:
        if current.name in _BRANCHES:
            return None
        if current.name in _STREAMS:
            return current
        current = index.parents[current]
    return None


def _edition(node):
    return {'ed': node.attributes.get('ed'), 'ed_ref': node.attributes.get('edRef')}


def page_range(index, pb, limits):
    if pb.name != _PB:
        return None, []
    container = _stream(index, pb)
    if container is None or pb.content:
        return None, ['page_stream_requires_review']
    # 版・本文枝を推測して一つのページ列へまとめない。
    seen = False
    end = None
    for candidate in index.elements:
        if candidate is pb:
            seen = True
        elif seen and candidate.name == _PB and _stream(index, candidate) is container:
            end = candidate
            break
    if end is not None and _edition(end) != _edition(pb):
        return None, ['mixed_edition_page_boundary_requires_review']
    locator = make_locator(index, pb)
    result = {'start_locator': locator, 'end_locator': make_locator(index, end) if end else None,
              'container_locator': make_locator(index, container),
              'boundary': 'next_pb' if end else 'container_end', 'edition': _edition(pb),
              'content': None, 'omission': None}
    active = finished = False
    elements = nodes = payload = 0

    def count(element=False, value=''):
        nonlocal elements, nodes, payload
        nodes += 1
        elements += int(element)
        payload += len(value)
        if elements > limits.unit_elements or nodes > limits.unit_nodes or payload > limits.unit_payload:
            raise ReaderError('unit_too_large', 'ページ範囲の上限を超えています。', {'locator': locator})

    def project(node):
        nonlocal active, finished
        if node is pb:
            active = True
            return None
        if node is end:
            finished = True
            return None
        if isinstance(node, Element):
            if node is not container and node.name in _STREAMS:
                return None
            began_active = active
            children = []
            for child in node.content:
                if finished:
                    break
                output = project(child)
                if output is not None:
                    children.append(output)
            if not children and not began_active:
                return None
            count(element=True)
            return {'kind': 'element', 'name': node.name, 'attributes': dict(node.attributes),
                    'in_scope_namespaces': dict(node.in_scope_namespaces), 'locator': make_locator(index, node),
                    'partial': not began_active or finished or len(children) != len(node.content), 'content': children}
        if not active or finished:
            return None
        count(value=node.value)
        if isinstance(node, PI):
            return {'kind': 'pi', 'target': node.target, 'value': node.value}
        return {'kind': 'text' if isinstance(node, Text) else 'comment', 'value': node.value}

    try:
        # fragmentの各祖先タグは原XMLの部分切出し。仮のXML要素は作らない。
        projected = project(container)
        result['content'] = {'kind': 'fragment', 'content': projected['content'] if projected else []}
    except ReaderError as error:
        if error.code != 'unit_too_large':
            raise
        result['omission'] = {'code': error.code, 'locator': locator}
    return result, []
