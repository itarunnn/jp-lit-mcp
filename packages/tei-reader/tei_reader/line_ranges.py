"""lbの直後から同じ親の次のmilestoneまでを原位置付きで保存する。"""

from .locator import make_locator
from .model import Element, PI, ReaderError, TEI_NS, Text

_MILESTONES = {f'{{{TEI_NS}}}{n}' for n in ('lb', 'pb', 'cb')}
_STREAMS = {f'{{{TEI_NS}}}{n}' for n in ('text', 'sourceDoc')}
_BRANCHES = {f'{{{TEI_NS}}}{n}' for n in ('choice', 'app', 'note', 'subst', 'del', 'add')}


def line_range(index, lb, limits):
    parent = index.parents[lb]
    current = parent
    while current is not None and current.name not in _STREAMS:
        if current.name in _BRANCHES:
            return None, ['line_stream_requires_review']
        current = index.parents[current]
    if current is None or lb.content:
        return None, ['line_stream_requires_review']
    locator = make_locator(index, lb)
    result = {'start_locator': locator, 'end_locator': None, 'container_locator': make_locator(index, parent),
              'boundary': 'container_end', 'content': None, 'omission': None}
    elements = nodes = payload = 0

    def project(node):
        nonlocal elements, nodes, payload
        nodes += 1
        if isinstance(node, Element):
            if node.name in _MILESTONES or node.name in _STREAMS:
                raise ReaderError('line_stream_requires_review', '入れ子の行境界は原XMLで確認してください。')
            elements += 1
        else:
            payload += len(node.value)
        if elements > limits.unit_elements or nodes > limits.unit_nodes or payload > limits.unit_payload:
            raise ReaderError('unit_too_large', '行範囲の上限を超えています。')
        if isinstance(node, Element):
            return {'kind': 'element', 'name': node.name, 'attributes': dict(node.attributes),
                    'in_scope_namespaces': dict(node.in_scope_namespaces), 'locator': make_locator(index, node),
                    'content': [project(child) for child in node.content]}
        if isinstance(node, PI):
            return {'kind': 'pi', 'target': node.target, 'value': node.value}
        return {'kind': 'text' if isinstance(node, Text) else 'comment', 'value': node.value}

    active = False
    selected = []
    for node in parent.content:
        if node is lb:
            active = True
        elif active:
            if isinstance(node, Element) and node.name in _MILESTONES:
                result['boundary'] = 'next_milestone'
                result['end_locator'] = make_locator(index, node)
                break
            selected.append(node)
    try:
        result['content'] = {'kind': 'fragment', 'content': [project(node) for node in selected]}
    except ReaderError as error:
        if error.code == 'line_stream_requires_review':
            return None, [error.code]
        if error.code != 'unit_too_large':
            raise
        result['omission'] = {'code': error.code, 'locator': locator}
    return result, []
