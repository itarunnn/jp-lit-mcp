"""固定image内だけで動く推論。原engineの行脱落検査は既存wrapperを使う。"""
import base64
import hashlib
import io
import json
import subprocess
import sys
import time
from pathlib import Path
from .contracts import validate_request

SOURCE_COMMIT = '939cbfaf617eb8fd7e54cf1daeb66fb5a92749ec'


def worker(request, image_id):
    validate_request(request)
    began = time.monotonic()
    completed = subprocess.run([sys.executable, '-c', request['probe_code']], capture_output=True, timeout=120)
    if completed.returncode:
        raise RuntimeError('engine inspection failed: ' + completed.stderr.decode('utf-8', errors='replace')[-2000:])
    metadata = json.loads(completed.stdout)
    identity = {'source_commit': SOURCE_COMMIT, 'image_id': image_id, 'metadata': metadata}
    engine_hash = hashlib.sha256(json.dumps(identity, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    result = {'metadata': metadata, 'engine_sha256': engine_hash, 'image_id': image_id,
              'source_commit': SOURCE_COMMIT, 'gpu_type': 'A10', 'status': 'completed',
              'files': {}, 'output_hashes': {}, 'stdout': '', 'stderr': '', 'error': None}
    if request['operation'] == 'inspect':
        result['worker_seconds'] = time.monotonic() - began
        return result
    if engine_hash != request['expected_engine_sha256']:
        raise ValueError('remote engine identity changed')
    from PIL import Image
    data = base64.b64decode(request['image'], validate=True)
    with Image.open(io.BytesIO(data)) as image:
        if image.width * image.height > 16000000:
            raise ValueError('image dimensions exceed limit')
        result['input_width'], result['input_height'] = image.size
    result['input_sha256'] = hashlib.sha256(data).hexdigest()
    image_path = Path('/input') / request['image_name']
    image_path.parent.mkdir(exist_ok=True)
    image_path.write_bytes(data)
    output = Path('/out'); output.mkdir(exist_ok=True)
    wrapper = output / 'gpu-wrapper.py'; wrapper.write_text(request['wrapper_code'], encoding='utf-8')
    try:
        process = subprocess.run([sys.executable, str(wrapper), str(image_path), str(output / 'results')],
                                 cwd='/root/kotenocr_cli', capture_output=True, timeout=request['timeout_seconds'])
        result['stdout'] = process.stdout.decode('utf-8', errors='replace')[-1048576:]
        result['stderr'] = process.stderr.decode('utf-8', errors='replace')[-1048576:]
        if process.returncode:
            result.update(status='failed', error=f'OCR exit {process.returncode}')
    except subprocess.TimeoutExpired as error:
        result.update(status='failed', error='OCR timeout',
                      stdout=(error.stdout or b'').decode('utf-8', errors='replace')[-1048576:],
                      stderr=(error.stderr or b'').decode('utf-8', errors='replace')[-1048576:])
    stem = image_path.stem
    paths = {f'{stem}.json': output / f'results/{stem}/json/{stem}.json',
             f'{stem}.txt': output / f'results/{stem}/txt/{stem}_main.txt',
             'gpu-wrapper.py': wrapper, 'gpu-validation.json': output / 'gpu-validation.json',
             'opt.json': output / 'results/opt.json'}
    for name, path in paths.items():
        if path.is_file():
            body = path.read_bytes()
            if len(body) > 4 * 1024 * 1024:
                raise ValueError('raw output exceeds limit')
            result['files'][name] = base64.b64encode(body).decode()
            result['output_hashes'][name] = hashlib.sha256(body).hexdigest()
    result['worker_seconds'] = time.monotonic() - began
    return result
