"""通信前の入力検査と取得結果の整合確認。SDKへの接続は行わない。"""
import base64
import hashlib
import re


def validate_request(request):
    if not isinstance(request, dict) or request.get('operation') not in ('inspect', 'run'):
        raise ValueError('invalid operation')
    for key in ('probe_code', 'wrapper_code'):
        if not isinstance(request.get(key), str) or not 1 <= len(request[key]) <= 65536:
            raise ValueError('invalid worker code')
    if type(request.get('timeout_seconds')) is not int or not 1 <= request['timeout_seconds'] <= 600:
        raise ValueError('invalid timeout')
    if request['operation'] == 'run':
        if not re.fullmatch(r'input-[1-4]\.(jpg|png)', str(request.get('image_name', ''))):
            raise ValueError('invalid image name')
        try:
            body = base64.b64decode(request['image'], validate=True)
        except Exception as error:
            raise ValueError('invalid image bytes') from error
        if not body or len(body) > 10 * 1024 * 1024 or hashlib.sha256(body).hexdigest() != request.get('image_sha256'):
            raise ValueError('image hash mismatch')
        if not re.fullmatch('[a-f0-9]{64}', str(request.get('expected_engine_sha256', ''))):
            raise ValueError('invalid engine identity')
    return request


def wait_for_call(call, timeout):
    try:
        return call.get(timeout=timeout)
    except BaseException:
        call.cancel(terminate_containers=True)
        raise


def validate_files(response):
    files, hashes = response['files'], response['output_hashes']
    if len(files) > 8 or set(files) != set(hashes):
        raise ValueError('invalid output set')
    result = {}
    total = 0
    for name, encoded in files.items():
        if not re.fullmatch(r'(?:input-[1-4]\.(?:json|txt)|gpu-validation\.json|gpu-wrapper\.py|opt\.json)', name):
            raise ValueError('invalid output name')
        body = base64.b64decode(encoded, validate=True)
        total += len(body)
        if total > 8 * 1024 * 1024 or hashlib.sha256(body).hexdigest() != hashes[name]:
            raise ValueError('output hash mismatch')
        result[name] = body
    return result
