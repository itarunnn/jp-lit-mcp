import hashlib
import math
import os
from pathlib import Path
import struct

os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = "16000000"
import cv2 as cv
import numpy as np

SETTINGS = {"max_edge": 1024, "nfeatures": 2000, "ratio_test": .75,
            "ransac_threshold": 3, "min_inliers": 12, "min_inlier_ratio": .4,
            "min_coverage": .08, "min_overlap": .5, "min_scale": .25, "max_scale": 4,
            "difference_threshold": 25, "percentiles": [2, 98], "seed": 0, "threads": 1}


def load_image(source):
    file = Path(source["image_path"])
    if not file.is_absolute() or file.is_symlink() or not file.is_file() or file.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("画像file・容量を確認してください")
    data = file.read_bytes()
    if hashlib.sha256(data).hexdigest() != source["sha256"]:
        raise ValueError("画像hashが一致しません")
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width, height = struct.unpack(">II", data[16:24])
        if width * height > 16000000:
            raise ValueError("画像寸法が上限を超えます")
    elif not data.startswith(b"\xff\xd8"):
        raise ValueError("JPEG/PNG画像を指定してください")
    image = cv.imdecode(np.frombuffer(data, np.uint8), cv.IMREAD_GRAYSCALE | cv.IMREAD_IGNORE_ORIENTATION)
    if image is None or image.size > 16000000 or image.shape != (source["height"], source["width"]):
        raise ValueError("画像寸法が一致しません")
    height, width = image.shape
    scale = min(1, SETTINGS["max_edge"] / max(height, width))
    resized = cv.resize(image, (max(1, round(width * scale)), max(1, round(height * scale))), interpolation=cv.INTER_AREA)
    actual = np.diag([resized.shape[1] / width, resized.shape[0] / height, 1.])
    small = cv.resize(resized, (9, 8), interpolation=cv.INTER_AREA)
    dhash = small[:, 1:] > small[:, :-1]
    orb = cv.ORB_create(nfeatures=SETTINGS["nfeatures"])
    points, descriptors = orb.detectAndCompute(resized, None)
    return {"image": resized, "scale": actual, "dhash": dhash, "points": points, "descriptors": descriptors,
            "image_size": [width, height], "analysis_size": [resized.shape[1], resized.shape[0]]}


def coverage(points, image):
    return float(cv.contourArea(cv.convexHull(points.astype(np.float32)))) / image.size


def align(query, candidate, identical):
    result = {"status": "held", "method": "orb_affine_ransac", "matrix": None,
              "candidate_image_to_query_image": None, "inliers": 0, "matches": 0, "inlier_ratio": 0.,
              "query_coverage": 0., "candidate_coverage": 0., "overlap": 0., "median_reprojection_error": None,
              "raw_mean_difference": None, "normalized_mean_difference": None, "changed_fraction": None,
              "photometric_gain": None, "photometric_offset": None, "diagnostics": [], "artifacts": {}}
    if identical:
        matrix = np.array([[1., 0., 0.], [0., 1., 0.]])
        result["method"] = "encoded_identity"
    else:
        if query["descriptors"] is None or candidate["descriptors"] is None or len(query["descriptors"]) < 2:
            result["diagnostics"].append("insufficient_features")
            return result, None, None
        pairs = cv.BFMatcher(cv.NORM_HAMMING).knnMatch(candidate["descriptors"], query["descriptors"], k=2)
        matches, used = [], set()
        for pair in sorted(pairs, key=lambda p: p[0].distance if p else 256):
            if len(pair) == 2 and pair[0].distance < SETTINGS["ratio_test"] * pair[1].distance and pair[0].trainIdx not in used:
                matches.append(pair[0])
                used.add(pair[0].trainIdx)
        result["matches"] = len(matches)
        if len(matches) < SETTINGS["min_inliers"]:
            result["diagnostics"].append("insufficient_matches")
            return result, None, None
        src = np.array([candidate["points"][m.queryIdx].pt for m in matches], np.float32)
        dst = np.array([query["points"][m.trainIdx].pt for m in matches], np.float32)
        matrix, mask = cv.estimateAffinePartial2D(src, dst, method=cv.RANSAC, ransacReprojThreshold=3,
                                                 maxIters=2000, confidence=.99, refineIters=10)
        if matrix is None or mask is None or not np.isfinite(matrix).all():
            result["diagnostics"].append("transform_unavailable")
            return result, None, None
        inliers = mask.ravel().astype(bool)
        count = int(inliers.sum())
        result.update(inliers=count, inlier_ratio=count / len(matches),
                      query_coverage=coverage(dst[inliers], query["image"]),
                      candidate_coverage=coverage(src[inliers], candidate["image"]))
        prediction = src[inliers] @ matrix[:, :2].T + matrix[:, 2]
        result["median_reprojection_error"] = float(np.median(np.linalg.norm(prediction - dst[inliers], axis=1)))
        scale = math.hypot(matrix[0, 0], matrix[1, 0])
        if (count < 12 or result["inlier_ratio"] < .4 or min(result["query_coverage"], result["candidate_coverage"]) < .08
                or not .25 <= scale <= 4 or result["median_reprojection_error"] > 3):
            result["diagnostics"].append("weak_or_local_correspondence")
            return result, None, None
    height, width = query["image"].shape
    overlap = cv.warpAffine(np.ones_like(candidate["image"]), matrix, (width, height), flags=cv.INTER_NEAREST, borderValue=0)
    overlap = cv.erode(overlap, np.ones((3, 3), np.uint8)).astype(bool)
    result["overlap"] = float(overlap.mean())
    if result["overlap"] < .5:
        result["diagnostics"].append("insufficient_overlap")
        return result, None, None
    aligned = cv.warpAffine(candidate["image"], matrix, (width, height), borderValue=235)
    matrix3 = np.vstack([matrix, [0., 0., 1.]])
    result.update(status="aligned", matrix=matrix.tolist(),
                  candidate_image_to_query_image=(np.linalg.inv(query["scale"]) @ matrix3 @ candidate["scale"]).tolist())
    return result, aligned, overlap


def difference_images(query, aligned, mask, result):
    raw = cv.absdiff(query, aligned)
    qlo, qhi = np.percentile(query[mask], [2, 98])
    alo, ahi = np.percentile(aligned[mask], [2, 98])
    gain = float((qhi - qlo) / (ahi - alo)) if ahi - alo > 1 and qhi - qlo > 1 else 1.
    offset = float(qlo - alo * gain)
    adjusted = np.clip(aligned.astype(float) * gain + offset, 0, 255).astype(np.uint8)
    delta = cv.absdiff(query, adjusted)
    changed = (delta > 25) & mask
    result.update(raw_mean_difference=float(raw[mask].mean()), normalized_mean_difference=float(delta[mask].mean()),
                  changed_fraction=float(changed.sum() / mask.sum()), photometric_gain=gain, photometric_offset=offset)
    highlighted = cv.cvtColor(query, cv.COLOR_GRAY2BGR)
    highlighted[changed] = [0, 0, 255]
    overlay = cv.addWeighted(query, .5, aligned, .5, 0)
    outputs = {"aligned": aligned, "overlay": overlay, "raw_difference": raw, "difference": highlighted}
    for image in outputs.values():
        image[~mask] = 128
    return outputs


def analyze(request):
    candidates = request["candidates"]
    ids = [request["query"]["id"]] + [source["id"] for source in candidates]
    if not 1 <= len(candidates) <= 20 or len(set(ids)) != len(ids):
        raise ValueError("queryと候補IDを重複なしで1〜20件指定してください")
    output = Path(request["output_dir"])
    if not output.is_absolute() or output.exists():
        raise ValueError("新しい絶対pathの保存先を指定してください")
    cv.setNumThreads(1)
    cv.setRNGSeed(0)
    query = load_image(request["query"])
    loaded = [load_image(source) for source in candidates]
    output.mkdir()
    def artifact(name, image):
        file = output / name
        if not cv.imwrite(str(file), image):
            raise ValueError("PNG保存に失敗しました")
        return {"path": name, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()}
    query_artifact = artifact("query.png", query["image"])
    results = []
    for index, (source, image) in enumerate(zip(candidates, loaded)):
        identical = source["sha256"] == request["query"]["sha256"] and image["image_size"] == query["image_size"]
        result, aligned, mask = align(query, image, identical)
        result.update(id=source["id"], image_size=image["image_size"], analysis_size=image["analysis_size"],
                      dhash_distance=int(np.count_nonzero(query["dhash"] != image["dhash"])))
        if aligned is not None:
            for kind, pixels in difference_images(query["image"], aligned, mask, result).items():
                result["artifacts"][kind] = artifact(f"candidate-{index + 1}-{kind}.png", pixels)
        results.append(result)
    results.sort(key=lambda r: (r["status"] != "aligned", r["method"] != "encoded_identity", -r["inliers"], r["dhash_distance"]))
    for rank, result in enumerate(results, 1):
        result["rank"] = rank
    return {"engine": {"python": __import__("platform").python_version(), "opencv": cv.__version__, "numpy": np.__version__},
            "settings": SETTINGS, "query": {"image_size": query["image_size"], "analysis_size": query["analysis_size"], "artifact": query_artifact},
            "candidates": results}
