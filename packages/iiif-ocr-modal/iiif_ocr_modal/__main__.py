"""stdin/stdout JSON bridge。認証値を出力しない。"""
import importlib.metadata
import json
import sys
import time
import os
from pathlib import Path
from contextlib import redirect_stdout
from .contracts import validate_request, validate_files, wait_for_call


def main():
    try:
        raw = sys.stdin.buffer.read(16 * 1024 * 1024 + 1)
        if len(raw) > 16 * 1024 * 1024:
            raise ValueError('request exceeds limit')
        request = validate_request(json.loads(raw))
        cancel_path = os.environ.get('JP_LIT_MODAL_CANCEL_PATH')
        cancelled = lambda: bool(cancel_path and Path(cancel_path).exists())
        if cancelled():
            raise InterruptedError('host cancelled before build')
        import modal
        from .cloud import app, image, execute
        started = time.monotonic()
        with redirect_stdout(sys.stderr), modal.enable_output():
            with app.run(detach=False):
                if cancelled():
                    raise InterruptedError('host cancelled before dispatch')
                call = execute.spawn(request, image.object_id)
                print('Modal call ' + call.object_id, file=sys.stderr, flush=True)
                # SDK 1.5.1のFunctionCall.get待機切れは組込みTimeoutError。
                result = wait_for_call(call, 1500, cancelled=cancelled, poll_timeout_types=(TimeoutError,),
                                       on_cancel=lambda: print('Modal call cancelled ' + call.object_id, file=sys.stderr, flush=True))
        validate_files(result)
        result.update(call_id=call.object_id, client_version=importlib.metadata.version('modal'),
                      wall_seconds=time.monotonic()-started, resource_cpu=2, resource_memory_mib=8192)
        print(json.dumps({'ok': True, 'result': result}, ensure_ascii=False))
    except Exception as error:
        # SDKの例外に認証contextを混ぜず、型と安全な自前メッセージだけを返す。
        print(json.dumps({'ok': False, 'error': type(error).__name__}))
        return 4
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
