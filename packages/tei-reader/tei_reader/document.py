"""同一byte snapshotから上限付きXML論理treeを構築する。"""

import hashlib
from collections import ChainMap
from pathlib import Path
import pyexpat
import re
from types import MappingProxyType
import xml.etree.ElementTree as ET
from .model import Comment, Document, Element, Limits, PI, ReaderError, TEI_NS, Text, XML_NS


def local_file_path(path: Path) -> Path:
    def acceptable(p):
        spelling = str(p).replace('/', '\\')
        return p.is_absolute() and not spelling.startswith('\\\\')
    try:
        if not acceptable(path):
            raise ReaderError('file_access_error', '絶対ローカルfile pathを指定してください。')
        resolved = path.resolve(strict=True)
        if not acceptable(resolved) or not resolved.is_file():
            raise ReaderError('file_access_error', 'ローカル通常fileを指定してください。')
        return resolved
    except (OSError, ValueError, RuntimeError):
        raise ReaderError('file_access_error', '指定fileを確認できません。') from None


def read_local_bytes(path: Path, max_bytes: int) -> bytes:
    resolved = local_file_path(path)
    try:
        with resolved.open('rb') as stream:
            buffer = bytearray()
            while len(buffer) <= max_bytes:
                chunk = stream.read(min(65_536, max_bytes + 1 - len(buffer)))
                if not chunk:
                    break
                buffer.extend(chunk)
    except (OSError, ValueError):
        raise ReaderError('file_access_error', '指定fileを読み込めません。') from None
    if len(buffer) > max_bytes:
        raise ReaderError('input_too_large', '入力byte上限を超えています。', {'max_bytes': max_bytes})
    return bytes(buffer)


class _Target:
    def __init__(self, limits: Limits):
        self.limits = limits
        self.stack: list[Element] = []
        self.root = None
        self.pending_ns = {}
        self.counts = {'elements': 0, 'nodes': 0, 'attributes': 0, 'namespace_declarations': 0}
        self.misc = {'comments': 0, 'pis': 0}

    def increment(self, field, count=1):
        self.counts[field] += count
        maximum = getattr(self.limits, field)
        if self.counts[field] > maximum:
            raise ReaderError('document_too_complex', 'XML構築上限を超えています。', {'resource': field, 'maximum': maximum})

    def start_ns(self, prefix, uri):
        self.increment('namespace_declarations')
        self.pending_ns[prefix] = uri

    def end_ns(self, prefix):
        pass  # 各elementのbinding snapshotをstackから復元する。

    def start(self, name, attributes):
        if len(self.stack) + 1 > self.limits.depth:
            raise ReaderError('document_too_complex', 'XML深度上限を超えています。', {'maximum': self.limits.depth, 'resource': 'depth'})
        self.increment('elements')
        self.increment('nodes')
        self.increment('attributes', len(attributes))
        bindings = self.stack[-1].in_scope_namespaces if self.stack else ChainMap(MappingProxyType({'xml': XML_NS}))
        if self.pending_ns:
            # 継承内容は共有し、このelementで宣言された差分だけ保持する。
            bindings = bindings.new_child(MappingProxyType(self.pending_ns))
            self.pending_ns = {}
        node = Element(name, dict(attributes), bindings)
        if self.stack:
            self.stack[-1].content.append(node)
        else:
            self.root = node
        self.stack.append(node)

    def end(self, name):
        self.stack.pop()

    def data(self, value):
        if not value or not self.stack:
            return
        content = self.stack[-1].content
        if content and isinstance(content[-1], Text):
            content[-1].value += value
        else:
            self.increment('nodes')
            content.append(Text(value))

    def comment(self, value):
        self.increment('nodes')
        if self.stack:
            self.stack[-1].content.append(Comment(value))
        else:
            self.misc['comments'] += 1

    def pi(self, target, value):
        self.increment('nodes')
        if self.stack:
            self.stack[-1].content.append(PI(target, value))
        else:
            self.misc['pis'] += 1

    def doctype(self, name, pubid, system):
        raise ReaderError('doctype_forbidden', 'DOCTYPE宣言を含むXMLは受け付けません。')

    def close(self):
        return self.root


def load_document(path: Path, expected_sha256: str | None, limits: Limits) -> Document:
    version = re.fullmatch(r'expat_(\d+)\.(\d+)\.(\d+)', pyexpat.EXPAT_VERSION)
    if not version or tuple(map(int, version.groups())) < (2, 7, 2):
        raise ReaderError('unsupported_runtime', 'Expat 2.7.2以上が必要です。')
    resolved = local_file_path(path)
    raw = read_local_bytes(resolved, limits.xml_bytes)
    sha256 = hashlib.sha256(raw).hexdigest()
    if expected_sha256 is not None and expected_sha256 != sha256:
        raise ReaderError('hash_mismatch', '期待hashと入力fileのhashが一致しません。')
    target = _Target(limits)
    parser = ET.XMLParser(target=target)
    try:
        parser.feed(raw)
        root = parser.close()
    except (ET.ParseError, ValueError, LookupError):
        raise ReaderError('invalid_xml', 'XMLの整形式を確認できません。') from None
    if root is None or root.name != f'{{{TEI_NS}}}TEI':
        raise ReaderError('unsupported_document', 'TEI namespaceのTEI rootを指定してください。')
    return Document(resolved, sha256, len(raw), root, target.misc)
