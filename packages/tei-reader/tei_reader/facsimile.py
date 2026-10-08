"""明示facsの対応材料を、原座標・構造・参照状態付きで返す。"""

from .locator import make_locator, resolve_path
from .model import Element, Index, Limits, ReaderError, TEI_NS
import re
from .references import resolve_reference, _base_chain
from .operations import validate_page
from .page_ranges import page_range
from .tree import structured_unit


def _named(node, name):
    return node is not None and node.name == f'{{{TEI_NS}}}{name}'


def _summary(index, node):
    return {'locator': make_locator(index, node), 'name': node.name,
            'attributes': dict(node.attributes), 'xml_base_chain': _base_chain(index, node)}


def facsimile_links(index: Index, limit: int, offset: int, limits: Limits, include_inherited=False):
    validate_page(limit, offset)
    references = []
    total = 0
    owners = {}
    for node in index.elements:
        owner = node if 'facs' in node.attributes else owners.get(index.parents[node])
        owners[node] = owner
        if owner is None or (owner is not node and (not include_inherited or not node.name.startswith(f'{{{TEI_NS}}}'))):
            continue
        value = owner.attributes['facs']
        for token_index, token in enumerate(t for t in re.split(r'[ \t\r\n]+', value) if t):
            if offset <= total < offset + limit:
                references.append({'source_locator': make_locator(index, node), 'attribute_value': value,
                                   'raw_token': token, 'token_index': token_index,
                                   'facs_origin': {'kind': 'explicit' if owner is node else 'ancestor',
                                                   'locator': make_locator(index, owner), 'attribute_value': value},
                                   **resolve_reference(index, owner, token)})
            total += 1
    items = []
    for ref in references:
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
        page, page_diagnostics = page_range(index, source, limits)
        diagnostics.extend(page_diagnostics)
        if (_named(source, 'pb') and page is None) or _named(source, 'cb') or _named(source, 'lb'):
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
                      'facs_origin': ref['facs_origin'], 'page_range': page,
                      'target': _summary(index, target) if target is not None else None,
                      'surface': _summary(index, surface) if surface is not None else None,
                      'graphics': [_summary(index, n) for n in graphics[:10]],
                      'diagnostics': diagnostics + (['graphics_truncated'] if len(graphics) > 10 else [])})
    return {'remote_resources_fetched': False, 'source_collated': False,
            'total_occurrences': total, 'offset': offset, 'limit': limit,
            'returned_count': len(items), 'next_offset': offset + len(items) if offset + len(items) < total else None,
            'include_inherited': include_inherited, 'items': items}
