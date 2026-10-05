"""明示facsの対応材料を、原座標・構造・参照状態付きで返す。"""

from .locator import make_locator, resolve_path
from .model import Element, Index, Limits, ReaderError, TEI_NS
from .references import check_references, _base_chain
from .tree import structured_unit


def _named(node, name):
    return node is not None and node.name == f'{{{TEI_NS}}}{name}'


def _summary(index, node):
    return {'locator': make_locator(index, node), 'name': node.name,
            'attributes': dict(node.attributes), 'xml_base_chain': _base_chain(index, node)}


def facsimile_links(index: Index, limit: int, offset: int, limits: Limits):
    references = check_references(index, ['facs'], limit, offset)
    items = []
    for ref in references['items']:
        source = resolve_path(index, ref['source_locator']['xpath'])
        target = resolve_path(index, ref['target_locator']['xpath']) if ref['target_locator'] else None
        surface = None
        ancestors = []
        current = target
        while current is not None:
            if _named(current, 'surface') and surface is None:
                surface = current
            ancestors.append(current)
            current = index.parents[current]
        diagnostics = []
        if sum(_named(n, 'zone') for n in ancestors) > 1 or sum(_named(n, 'surface') for n in ancestors) > 1:
            diagnostics.append('nested_geometry')
        if _named(source, 'pb') or _named(source, 'cb') or _named(source, 'lb'):
            diagnostics.append('milestone_content_not_expanded')
        graphics = []
        if _named(target, 'graphic'):
            graphics = [target]
        elif surface:
            graphics = [n for n in surface.content if isinstance(n, Element) and _named(n, 'graphic')]
        omission = None
        try:
            content = structured_unit(index, source, limits)['content']
        except ReaderError as error:
            if error.code != 'unit_too_large':
                raise
            content = None
            omission = {'code': error.code, 'locator': ref['source_locator']}
        items.append({'source_locator': ref['source_locator'], 'source_content': content,
                      'omission': omission, 'attribute_value': ref['attribute_value'],
                      'token_index': ref['token_index'], 'raw_token': ref['raw_token'],
                      'reference_status': ref['status'], 'candidate_count': ref['candidate_count'],
                      'xml_base_chain': ref['xml_base_chain'],
                      'target': _summary(index, target) if target is not None else None,
                      'surface': _summary(index, surface) if surface is not None else None,
                      'graphics': [_summary(index, n) for n in graphics[:10]],
                      'diagnostics': diagnostics + (['graphics_truncated'] if len(graphics) > 10 else [])})
    return {'remote_resources_fetched': False, 'source_collated': False,
            'total_occurrences': references['total_occurrences'], 'offset': offset, 'limit': limit,
            'returned_count': len(items), 'next_offset': references['next_offset'], 'items': items}
