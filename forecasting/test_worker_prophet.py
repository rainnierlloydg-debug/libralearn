import unittest
import sys
import os

# Add forecasting directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from worker_prophet import forecast, evaluate_prophet, metrics, PROPHET_AVAILABLE


class ProphetForecastTest(unittest.TestCase):
    @unittest.skipIf(not PROPHET_AVAILABLE, "Prophet not installed")
    def test_constant_series_forecast(self):
        """Constant series should forecast the same value."""
        series = [10] * 12
        result = forecast({"series": series, "horizon": 3})
        self.assertEqual([10.0] * 3, result["forecasts"])
        self.assertEqual("Last-month baseline", result["selected_model"])
        self.assertEqual(0.0, result["backtest"]["mean_absolute_error"])

    @unittest.skipIf(not PROPHET_AVAILABLE, "Prophet not installed")
    def test_rising_trend_forecast(self):
        """Rising trend should be captured."""
        series = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
        result = forecast({"series": series, "horizon": 3})
        self.assertEqual(3, len(result["forecasts"]))
        self.assertTrue(all(v >= 0 for v in result["forecasts"]))
        self.assertEqual(3, result["backtest"]["months_tested"])
        # Prophet or baseline should be selected
        self.assertIn(result["selected_model"], ["Prophet", "Last-month baseline"])
        self.assertGreater(len(result["model_comparison"]), 1)

    @unittest.skipIf(not PROPHET_AVAILABLE, "Prophet not installed")
    def test_seasonal_pattern(self):
        """Test with seasonal pattern (e.g., exam months)."""
        # Peak at months 3, 6, 9 (0-indexed: 2, 5, 8)
        series = [5, 5, 15, 5, 5, 15, 5, 5, 15, 5, 5, 15]
        result = forecast({"series": series, "horizon": 3})
        self.assertEqual(3, len(result["forecasts"]))
        # Prophet should detect monthly seasonality
        self.assertIn(result["selected_model"], ["Prophet", "Last-month baseline"])

    def test_invalid_short_history_rejected(self):
        """Series shorter than MIN_HISTORY should raise ValueError."""
        for series in ([1] * 5, [1] * 7 + [-1], [1] * 7 + [float("nan")], [1] * 7 + [True]):
            with self.subTest(series=series):
                with self.assertRaises(ValueError):
                    forecast({"series": series})

    def test_invalid_horizon_rejected(self):
        """Invalid horizon should raise ValueError."""
        series = [1] * 8
        for horizon in (0, 13, -1, "3", True):
            with self.subTest(horizon=horizon):
                with self.assertRaises(ValueError):
                    forecast({"series": series, "horizon": horizon})

    def test_metrics_percentage_error_excludes_zero(self):
        """MAPE should exclude zero actuals."""
        result = metrics([{"actual": 0, "predicted": 5}, {"actual": 10, "predicted": 8}])
        self.assertEqual(20.0, result["mean_absolute_percentage_error"])
        self.assertEqual(1, result["percentage_months_tested"])
        self.assertIsNone(metrics([{"actual": 0, "predicted": 1}])["mean_absolute_percentage_error"])

    @unittest.skipIf(not PROPHET_AVAILABLE, "Prophet not installed")
    def test_evaluate_prophet_backtest_dates(self):
        """Backtest should test on correct indices."""
        series = [8, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20]
        result = evaluate_prophet(series)
        # Should test on last 3 months (indices 9, 10, 11 for 12-month series)
        indices = [row["index"] for row in result["results"]]
        self.assertEqual([9, 10, 11], indices)


if __name__ == "__main__":
    unittest.main()