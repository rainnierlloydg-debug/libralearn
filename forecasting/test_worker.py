import unittest

from worker import evaluate, forecast, metrics


class ForecastWorkerTest(unittest.TestCase):
    def test_constant_counts_remain_constant_and_have_zero_validation_error(self):
        result = forecast({"series": [10] * 12, "horizon": 3})
        self.assertEqual([10.0] * 3, result["forecasts"])
        self.assertEqual("Last-month baseline", result["selected_model"])
        self.assertEqual(0.0, result["backtest"]["mean_absolute_error"])

    def test_baseline_validation_does_not_see_the_withheld_month(self):
        result = evaluate([2, 4, 6, 8, 10, 12, 14, 16], None)
        self.assertEqual([10.0, 12.0, 14.0], [row["predicted"] for row in result["results"]])
        self.assertEqual([12, 14, 16], [row["actual"] for row in result["results"]])
        self.assertEqual(2.0, result["mean_absolute_error"])

    def test_model_selection_compares_models_to_baseline_on_identical_dates(self):
        result = forecast({"series": [8, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20]})
        self.assertTrue(all(value >= 0 for value in result["forecasts"]))
        self.assertEqual(3, len(result["forecasts"]))
        self.assertEqual(3, result["backtest"]["months_tested"])
        self.assertGreater(len(result["model_comparison"]), 1)
        baseline = next(row for row in result["model_comparison"] if row["order"] is None)
        self.assertLessEqual(result["backtest"]["mean_absolute_error"], baseline["mean_absolute_error"])
        self.assertEqual([9, 10, 11], [row["index"] for row in result["backtest"]["results"]])

    def test_percentage_error_excludes_zero_actuals(self):
        result = metrics([{"actual": 0, "predicted": 5}, {"actual": 10, "predicted": 8}])
        self.assertEqual(20.0, result["mean_absolute_percentage_error"])
        self.assertEqual(1, result["percentage_months_tested"])
        self.assertIsNone(metrics([{"actual": 0, "predicted": 1}])["mean_absolute_percentage_error"])

    def test_invalid_or_short_history_is_rejected(self):
        for series in ([1] * 7, [1] * 121, [1] * 7 + [-1], [1] * 7 + [float("nan")], [1] * 7 + [True]):
            with self.subTest(series=series), self.assertRaises(ValueError):
                forecast({"series": series})


if __name__ == "__main__":
    unittest.main()
