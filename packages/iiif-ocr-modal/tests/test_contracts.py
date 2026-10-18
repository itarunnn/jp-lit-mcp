"""クラウド通信以外のhash・結果・cancel境界を実装で点検する。"""
import base64
import hashlib
import importlib.util
import io
import json
import sys
from contextlib import contextmanager, redirect_stderr, redirect_stdout
from types import SimpleNamespace
from unittest.mock import patch
import unittest


class ModalContractsTests(unittest.TestCase):
    def module(self):
        self.assertIsNotNone(importlib.util.find_spec('iiif_ocr_modal'), 'Modal bridge package is not implemented')
        from iiif_ocr_modal import contracts
        return contracts

    def request(self):
        return {'operation': 'run', 'image_name': 'input-1.jpg', 'image': base64.b64encode(b'image').decode(),
                'image_sha256': hashlib.sha256(b'image').hexdigest(), 'expected_engine_sha256': 'a' * 64,
                'timeout_seconds': 600, 'probe_code': 'print(1)', 'wrapper_code': 'print(2)'}

    def test_rejects_image_hash_and_path_before_remote_dispatch(self):
        c = self.module()
        for key, value in [('image_sha256', '0' * 64), ('image_name', '../outside.jpg'),
                           ('timeout_seconds', 601), ('image', 'invalid!')]:
            request = self.request(); request[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                c.validate_request(request)
        self.assertEqual(c.validate_request(self.request())['image_sha256'], hashlib.sha256(b'image').hexdigest())

    def test_cancels_owned_call_after_timeout(self):
        c = self.module()
        class Call:
            object_id = 'fc-owned'
            cancelled = False
            def get(self, timeout): raise TimeoutError('test timeout')
            def cancel(self, terminate_containers=False): self.cancelled = terminate_containers
        call = Call()
        with self.assertRaises(TimeoutError): c.wait_for_call(call, 1)
        self.assertTrue(call.cancelled)

    def test_returns_completed_call_without_cancelling(self):
        c = self.module()
        class Call:
            def get(self, timeout): return {'raw': 'preserved'}
            def cancel(self, **kwargs): raise AssertionError('completed call cancelled')
        self.assertEqual(c.wait_for_call(Call(), 1), {'raw': 'preserved'})

    def test_rejects_response_traversal_and_hash_drift(self):
        c = self.module()
        body = base64.b64encode(b'raw').decode()
        response = {'files': {'input-1.json': body}, 'output_hashes': {'input-1.json': hashlib.sha256(b'raw').hexdigest()}}
        self.assertEqual(c.validate_files(response), {'input-1.json': b'raw'})
        for bad in ({'files': {'../outside.json': body}, 'output_hashes': {'../outside.json': hashlib.sha256(b'raw').hexdigest()}},
                    {'files': {'input-1.json': body}, 'output_hashes': {'input-1.json': 'b' * 64}}):
            with self.assertRaises(ValueError): c.validate_files(bad)

    def test_main_keeps_sdk_logs_on_stderr(self):
        self.module()
        from iiif_ocr_modal.__main__ import main
        @contextmanager
        def output(*args, **kwargs):
            print('SDK progress')
            yield
        call = SimpleNamespace(object_id='fc-test', get=lambda **kwargs: {'files': {}, 'output_hashes': {}},
                               cancel=lambda **kwargs: None)
        cloud = SimpleNamespace(app=SimpleNamespace(run=output), image=SimpleNamespace(object_id='im-test'),
                                execute=SimpleNamespace(spawn=lambda *args: call))
        request = self.request(); request['operation'] = 'inspect'
        stdin = SimpleNamespace(buffer=io.BytesIO(json.dumps(request).encode()))
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch.dict(sys.modules, {'modal': SimpleNamespace(enable_output=output), 'iiif_ocr_modal.cloud': cloud}), \
                patch.object(sys, 'stdin', stdin), redirect_stdout(stdout), redirect_stderr(stderr):
            self.assertEqual(main(), 0)
        self.assertTrue(stdout.getvalue().startswith('{'), 'SDK progress corrupted JSON stdout')
        self.assertTrue(json.loads(stdout.getvalue())['ok'])
        self.assertIn('SDK progress', stderr.getvalue())


if __name__ == '__main__': unittest.main()
