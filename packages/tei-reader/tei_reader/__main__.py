"""1要求1応答のローカルCLI。"""

import argparse
from pathlib import Path
import sys
from . import __version__
from .model import Limits, ReaderError
from .protocol import encode_response, error_response, execute_request, parse_request, response_exit


class _Parser(argparse.ArgumentParser):
    def error(self, message):
        raise ReaderError('invalid_request','--request FILE または --request - を指定してください。')


def main(argv: list[str] | None = None) -> int:
    limits=Limits()
    parser=_Parser(description='ローカルTEIの構造・出典位置・文書内参照をJSONで確認する。')
    parser.add_argument('--version',action='version',version=__version__)
    parser.add_argument('--request',required=True,help='UTF-8要求JSONのfile。- はstdin。')
    try:
        args=parser.parse_args(argv)
        if args.request=='-':
            raw=sys.stdin.buffer.read(limits.request_bytes+1)
        else:
            try:
                with Path(args.request).open('rb') as stream:
                    raw=stream.read(limits.request_bytes+1)
            except (OSError,ValueError):
                raise ReaderError('file_access_error','要求fileを読み込めません。') from None
        response=execute_request(parse_request(raw),limits)
    except ReaderError as error:
        response=error_response(None,error)
    except Exception:
        response=error_response(None,ReaderError('internal_error','内部処理を完了できません。'))
    try:
        output=encode_response(response,limits)
    except ReaderError as error:
        response=error_response(response.get('operation'),error)
        output=encode_response(response,limits)
    except Exception:
        response=error_response(response.get('operation'),ReaderError('internal_error','応答JSONを作成できません。'))
        output=encode_response(response,limits)
    sys.stdout.buffer.write(output)
    return response_exit(response)


if __name__=='__main__':
    raise SystemExit(main())
