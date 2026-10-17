import argparse
import json
from pathlib import Path
from .sqlite_export import export_sqlite


def main():
    parser = argparse.ArgumentParser(description="書籍構造JSONの派生出力")
    parser.add_argument("operation", choices=["sqlite"])
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    export_sqlite(args.input, args.output)
    print(json.dumps({"ok": True, "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
