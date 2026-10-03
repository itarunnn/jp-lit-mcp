"""本文層を選択せず、順序付き構造をJSONへ投影する。"""

from .model import Comment, Element, Index, JsonValue, Limits, PI, ReaderError, Text
from .locator import make_locator


def structured_unit(index: Index, element: Element, limits: Limits) -> dict[str, JsonValue]:
    locator = make_locator(index, element)
    stack = [element]
    elements = nodes = payload = 0
    while stack:
        node = stack.pop()
        nodes += 1
        if isinstance(node, Element):
            elements += 1
            stack.extend(reversed(node.content))
        else:
            payload += len(node.value)
        if elements > limits.unit_elements or nodes > limits.unit_nodes or payload > limits.unit_payload:
            raise ReaderError('unit_too_large', '抽出単位の上限を超えています。', {'locator': locator})
    def shell(node):
        return {'kind':'element','name':node.name,'attributes':node.attributes,
                'in_scope_namespaces':node.in_scope_namespaces,'locator':make_locator(index,node),'content':[]}
    root = shell(element)
    stack = [(element, root)]
    while stack:
        node, output = stack.pop()
        for child in node.content:
            if isinstance(child, Element):
                projected = shell(child)
                stack.append((child, projected))
            elif isinstance(child, PI):
                projected = {'kind':'pi','target':child.target,'value':child.value}
            else:
                projected = {'kind':'text' if isinstance(child, Text) else 'comment','value':child.value}
            output['content'].append(projected)
    return {'locator':locator,'selection_applied':False,'reading_text':None,'content':root}
