"""一時Appに固定版runtimeと対象画像だけを渡す。"""
from pathlib import Path
import modal
from .worker import SOURCE_COMMIT, worker

app = modal.App('jp-lit-koten-ocr-pilot')
image = (modal.Image.from_registry('nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04', add_python='3.10')
         .apt_install('git', 'libgl1', 'libglib2.0-0', 'wget', 'unzip', 'build-essential')
         .env({'PYTHONPATH': '/opt/jp-lit', 'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1',
               'HF_DATASETS_OFFLINE': '1', 'PYTHONDONTWRITEBYTECODE': '1'})
         .run_commands(f'git clone https://github.com/ndl-lab/ndlkotenocr_cli.git /root/kotenocr_cli && cd /root/kotenocr_cli && git checkout {SOURCE_COMMIT}')
         .run_commands('python -m pip install torch==2.1.1 torchvision==0.16.1 torchaudio==2.1.1 torchtext==0.16.1 --index-url https://download.pytorch.org/whl/cu121')
         .run_commands('CC=gcc CXX=g++ python -m pip install -r /root/kotenocr_cli/requirements.txt')
         .run_commands('python -m pip install mmcv==2.1.0 -f https://download.openmmlab.com/mmcv/dist/cu121/torch2.1/index.html')
         .run_commands('wget -q https://lab.ndl.go.jp/dataset/ndlkotensekiocr/trocr/model-ver2.zip -O /tmp/koten-model.zip && unzip -q /tmp/koten-model.zip -d /root/kotenocr_cli/src/text_kotenseki_recognition/',
                       'wget -q https://lab.ndl.go.jp/dataset/ndlkotensekiocr/layoutmodel/ndl_kotenseki_layout_ver3.pth -O /root/kotenocr_cli/src/ndl_kotenseki_layout/models/ndl_kotenseki_layout_ver3.pth')
         .add_local_dir(Path(__file__).parent, '/opt/jp-lit/iiif_ocr_modal', copy=True))


@app.function(image=image, gpu='A10', cpu=2, memory=8192, max_containers=1,
              retries=0, timeout=780, startup_timeout=600, scaledown_window=2, include_source=False,
              block_network=True, single_use_containers=True)
def execute(request, image_id):
    return worker(request, image_id)
