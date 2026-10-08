import hashlib
import tempfile
import unittest
from pathlib import Path

import cv2 as cv
import numpy as np

try:
    from iiif_image.analysis import analyze
except ModuleNotFoundError:
    analyze = None


def picture(seed=7, size=512):
    image = np.full((size, size), 235, np.uint8)
    rng = np.random.default_rng(seed)
    for _ in range(90):
        x, y = rng.integers(35, size - 35, size=2)
        radius = int(rng.integers(4, 18))
        cv.circle(image, (int(x), int(y)), radius, int(rng.integers(15, 130)), 2)
        cv.line(image, (int(x), int(y)), (int(x + radius), int(y + radius)), 55, 2)
    return image


class AnalysisCase(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(analyze, "解析機能を実装する")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def source(self, image, name):
        file = self.root / (name + ".png")
        self.assertTrue(cv.imwrite(str(file), image))
        return {"id": name, "image_path": str(file), "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                "width": image.shape[1], "height": image.shape[0]}

    def run_pair(self, first, second):
        return analyze({"query": self.source(first, "query"), "candidates": [self.source(second, "candidate")],
                        "output_dir": str(self.root / "output")})

    def test_recovers_rotation_scale_and_translation(self):
        original = picture()
        known = cv.getRotationMatrix2D((256, 256), 5, .95)
        known[:, 2] += [9, -7]
        changed = cv.warpAffine(original, known, (512, 512), borderValue=235)
        result = self.run_pair(original, changed)["candidates"][0]
        self.assertEqual(result["status"], "aligned")
        matrix = np.array(result["candidate_image_to_query_image"])
        for point in [[110, 130], [300, 360], [410, 110]]:
            transformed = known @ [*point, 1]
            recovered = matrix @ [*transformed, 1]
            np.testing.assert_allclose(recovered[:2], point, atol=2.5)
        self.assertGreater(result["overlap"], .8)
        self.assertLess(result["raw_mean_difference"], 15)

    def test_original_pixel_matrix_handles_analysis_resize(self):
        original = cv.resize(picture(), (1536, 1536))
        changed = cv.resize(original, (768, 768))
        result = self.run_pair(original, changed)["candidates"][0]
        self.assertEqual(result["status"], "aligned")
        mapped = np.array(result["candidate_image_to_query_image"]) @ [200, 300, 1]
        np.testing.assert_allclose(mapped[:2], [400, 600], atol=4)

    def test_identity_has_zero_difference_and_rank_precedes_distractor(self):
        query = self.source(picture(), "query")
        same = self.source(picture(), "same")
        other = self.source(picture(100), "other")
        result = analyze({"query": query, "candidates": [other, same], "output_dir": str(self.root / "output")})
        match = result["candidates"][0]
        self.assertEqual(match["id"], "same")
        self.assertEqual(match["method"], "encoded_identity")
        self.assertEqual(match["raw_mean_difference"], 0)
        self.assertEqual(match["changed_fraction"], 0)
        self.assertEqual(match["rank"], 1)

    def test_added_mark_is_highlighted_and_comparison_outside_is_gray(self):
        original = picture()
        changed = original.copy()
        cv.rectangle(changed, (5, 5), (28, 28), 0, -1)
        known = np.float64([[1, 0, 8], [0, 1, 0]])
        changed = cv.warpAffine(changed, known, (512, 512), borderValue=235)
        result = self.run_pair(original, changed)["candidates"][0]
        self.assertEqual(result["status"], "aligned")
        artifact = result["artifacts"]["difference"]
        difference = cv.imread(str(self.root / "output" / artifact["path"]))
        self.assertGreater(int(difference[15, 15, 2]), int(difference[15, 15, 1]) + 100)
        np.testing.assert_array_equal(difference[256, 510], [128, 128, 128])
        self.assertGreater(result["changed_fraction"], .001)

    def test_photometric_adjustment_preserves_raw_difference(self):
        original = picture()
        changed = np.clip(original.astype(float) * .8 + 8, 0, 255).astype(np.uint8)
        result = self.run_pair(original, changed)["candidates"][0]
        self.assertEqual(result["status"], "aligned")
        self.assertGreater(result["raw_mean_difference"], 20)
        self.assertLess(result["normalized_mean_difference"], 6)

    def test_blank_image_is_held_without_difference(self):
        result = self.run_pair(picture(), np.full((512, 512), 235, np.uint8))["candidates"][0]
        self.assertEqual(result["status"], "held")
        self.assertEqual(result["artifacts"], {})
        self.assertIsNone(result["candidate_image_to_query_image"])

    def test_small_local_match_is_held(self):
        original = picture()
        changed = np.full_like(original, 235)
        changed[150:220, 150:220] = original[150:220, 150:220]
        result = self.run_pair(original, changed)["candidates"][0]
        self.assertEqual(result["status"], "held")

    def test_unrelated_image_is_held(self):
        result = self.run_pair(picture(), picture(100))["candidates"][0]
        self.assertEqual(result["status"], "held")

    def test_invalid_hash_leaves_no_output(self):
        source = self.source(picture(), "query")
        source["sha256"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "hash"):
            analyze({"query": source, "candidates": [self.source(picture(), "other")], "output_dir": str(self.root / "output")})
        self.assertFalse((self.root / "output").exists())

    def test_wrong_dimension_is_rejected(self):
        source = self.source(picture(), "query")
        source["width"] = 100
        with self.assertRaisesRegex(ValueError, "寸法"):
            analyze({"query": source, "candidates": [self.source(picture(), "other")], "output_dir": str(self.root / "output")})

    def test_existing_output_and_duplicate_candidates_are_rejected(self):
        source, other = self.source(picture(), "query"), self.source(picture(1), "other")
        with self.assertRaises(ValueError):
            analyze({"query": source, "candidates": [other, other], "output_dir": str(self.root / "output")})
        with self.assertRaises(ValueError):
            analyze({"query": source, "candidates": [other], "output_dir": str(self.root)})


if __name__ == "__main__":
    unittest.main()
