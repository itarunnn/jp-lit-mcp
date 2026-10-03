"""XMLの論理内容、処理上限、位置情報の共通型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from collections.abc import Mapping
from pathlib import Path
from typing import TypedDict

TEI_NS = "http://www.tei-c.org/ns/1.0"
XML_NS = "http://www.w3.org/XML/1998/namespace"
XML_ID = f"{{{XML_NS}}}id"
XML_BASE = f"{{{XML_NS}}}base"
type JsonValue = str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]


@dataclass(frozen=True)
class Limits:
    request_bytes: int = 65_536
    xml_bytes: int = 10_485_760
    depth: int = 256
    elements: int = 100_000
    nodes: int = 200_000
    attributes: int = 200_000
    namespace_declarations: int = 200_000
    index_path_chars: int = 16_777_216
    unit_elements: int = 2_000
    unit_nodes: int = 4_000
    unit_payload: int = 20_000
    response_bytes: int = 1_048_576
    manifest_bytes: int = 65_536
    manifest_records: int = 100


class ReaderError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


@dataclass(eq=False)
class Element:
    name: str
    attributes: dict[str, str]
    in_scope_namespaces: Mapping[str, str]
    content: list[ContentNode] = field(default_factory=list)


@dataclass
class Text:
    value: str


@dataclass
class Comment:
    value: str


@dataclass
class PI:
    target: str
    value: str


type ContentNode = Element | Text | Comment | PI


@dataclass
class Document:
    file_path: Path
    sha256: str
    byte_length: int
    root: Element
    outside_root_misc: dict[str, int]


class Locator(TypedDict):
    document_sha256: str
    xpath: str
    xml_id: str | None


class UnitSummary(TypedDict):
    locator: Locator
    name: str
    attributes: dict[str, str]
    parent_locator: Locator | None
    depth: int


@dataclass
class Index:
    document: Document
    namespaces: dict[str, str]
    elements: list[Element]
    paths: dict[Element, str]
    by_path: dict[str, Element]
    parents: dict[Element, Element | None]
    depths: dict[Element, int]
    ids: dict[str, list[Element]]
