import argparse
import json
from pathlib import Path
import sys

from .analysis import analyze


def main():
    parser = argparse.ArgumentParser(description="保存済み画像の類似・整列差分をローカルで計算します")
    parser.add_argument("--request", required=True)
    args = parser.parse_args()
    try:
        file = Path(args.request)
        if file.stat().st_size > 2 * 1024 * 1024:
            raise ValueError("要求容量が上限を超えます")
        result = analyze(json.loads(file.read_text(encoding="utf-8-sig")))
        print(json.dumps({"ok": True, "result": result}, ensure_ascii=False, allow_nan=False))
        return 0
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 4


sys.exit(main())
