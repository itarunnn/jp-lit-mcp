"""固定版Relax NGによる開発・研究時のTEI検証。"""
import argparse
import hashlib
import json
from pathlib import Path
from lxml import etree


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    args = parser.parse_args()
    xml_parser = etree.XMLParser(resolve_entities=False, no_network=True)
    schema = etree.RelaxNG(etree.parse(str(args.schema), xml_parser))
    document = etree.parse(str(args.input), xml_parser)
    schema.assertValid(document)
    print(json.dumps({"ok": True, "schema_sha256": hashlib.sha256(args.schema.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
