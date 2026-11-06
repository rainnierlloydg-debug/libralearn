"""Library-demand forecasting using Facebook Prophet (inspired by Tanu-N-Prabhu/Python).

This worker uses Facebook Prophet for time series forecasting, which handles
seasonality, trends, and holidays automatically. It's more intuitive than ARIMA
and works well with limited data.

Reads JSON from stdin: {"series": [...], "horizon": 3}
Returns JSON to stdout with forecasts, backtest, and model comparison.
"""
import json
import math
import sys
import warnings

import numpy as np
import pandas as pd

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

MIN_HISTORY = 6  # Prophet needs at least a few points, 6 months recommended


def bounded(values):
    """Ensure forecasts are finite, non-negative, rounded to 1 decimal."""
    numbers = [float(value) for value in values]
    if not all(math.isfinite(value) for value in numbers):
        raise ValueError("Model returned nonfinite values")
    return [round(max(0.0, value), 1) for value in numbers]


def metrics(results):
    """Compute error metrics for backtest results."""
    errors = [row["actual"] - row["predicted"] for row in results]
    percentages = [
        abs(row["actual"] - row["predicted"]) / row["actual"] * 100
        for row in results if row["actual"] > 0
    ]
    return {
        "mean_absolute_error": round(sum(abs(e) for e in errors) / len(errors), 2) if errors else 0,
        "root_mean_squared_error": round(math.sqrt(sum(e * e for e in errors) / len(errors)), 2) if errors else 0,
        "mean_absolute_percentage_error": round(sum(percentages) / len(percentages), 2) if percentages else None,
        "percentage_months_tested": len(percentages),
    }


def evaluate_prophet(series, horizon=3):
    """Evaluate Prophet model with rolling-origin backtest.

    Tests on the last 3 months (or fewer if series is short).
    """
    if len(series) < MIN_HISTORY:
        raise ValueError(f"Need at least {MIN_HISTORY} months of history for Prophet")

    # Create date range (monthly frequency)
    dates = pd.date_range(start='2020-01-01', periods=len(series), freq='MS')
    df = pd.DataFrame({'ds': dates, 'y': series})

    checks = []
    # Test on last 3 months (or all but first 3 if series is short)
    test_start = max(3, len(series) - 3)

    for idx in range(test_start, len(series)):
        train_df = df.iloc[:idx].copy()
        if len(train_df) < 3:
            continue

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = Prophet(
                yearly_seasonality=False,
                weekly_seasonality=False,
                daily_seasonality=False,
                seasonality_mode='additive',
            )
            # Add monthly seasonality since we have monthly data
            model.add_seasonality(name='monthly', period=30.5, fourier_order=3)
            model.fit(train_df)

        # Forecast 1 step ahead
        future = model.make_future_dataframe(periods=1, freq='MS')
        forecast = model.predict(future)
        predicted = forecast.iloc[-1]['yhat']

        checks.append({
            "index": idx,
            "predicted": round(max(0.0, float(predicted)), 1),
            "actual": series[idx],
            "absolute_error": round(abs(series[idx] - max(0.0, float(predicted))), 1),
        })

    if not checks:
        raise ValueError("No valid backtest windows")

    # Final fit on all data for forecasting
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        final_model = Prophet(
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False,
            seasonality_mode='additive',
        )
        final_model.add_seasonality(name='monthly', period=30.5, fourier_order=3)
        final_model.fit(df)

    future = final_model.make_future_dataframe(periods=horizon, freq='MS')
    final_forecast = final_model.predict(future)
    forecasts = bounded(final_forecast.tail(horizon)['yhat'].tolist())

    return {
        "model": "Prophet",
        "order": None,
        "aic": None,
        "results": checks,
        "forecasts": forecasts,
        **metrics(checks),
    }


def forecast(payload):
    """Main entry point: forecast monthly demand using Prophet."""
    series = payload.get("series")
    horizon = payload.get("horizon", 3)

    if not isinstance(series, list) or not MIN_HISTORY <= len(series) <= 120:
        raise ValueError(f"Prophet needs between {MIN_HISTORY} and 120 monthly observations")

    if not isinstance(horizon, int) or isinstance(horizon, bool) or not 1 <= horizon <= 12:
        raise ValueError("Invalid forecast horizon")

    if any(isinstance(v, bool) or not isinstance(v, (int, float))
           or not math.isfinite(v) or v < 0 for v in series):
        raise ValueError("Counts must be finite, nonnegative numbers")

    if not PROPHET_AVAILABLE:
        raise ValueError("Facebook Prophet is not installed. Run: pip install prophet")

    # Also include a simple baseline for comparison
    # Baseline: last-value persistence
    baseline_checks = []
    for idx in range(max(3, len(series) - 3), len(series)):
        predicted = series[idx - 1]
        baseline_checks.append({
            "index": idx,
            "predicted": predicted,
            "actual": series[idx],
            "absolute_error": round(abs(series[idx] - predicted), 1),
        })

    baseline_metrics = metrics(baseline_checks)
    baseline_forecast = bounded([series[-1]] * horizon)

    # Prophet model
    prophet_result = evaluate_prophet(series, horizon)

    # Compare and select best
    candidates = [
        {"model": "Last-month baseline", "order": None, "forecasts": baseline_forecast,
         "aic": None, "results": baseline_checks, **baseline_metrics},
        prophet_result,
    ]

    # Rank by MAE, then RMSE
    ranked = sorted(candidates, key=lambda r: (
        r["mean_absolute_error"], r["root_mean_squared_error"]
    ))

    chosen = ranked[0]
    projections = chosen["forecasts"]

    return {
        "engine": "prophet",
        "selected_model": chosen["model"],
        "order": chosen["order"],
        "forecasts": projections,
        "backtest": {
            "months_tested": len(chosen["results"]),
            "results": chosen["results"],
            **metrics(chosen["results"]),
        },
        "model_comparison": [
            {k: v for k, v in row.items() if k != "results" and k != "forecasts"}
            for row in ranked
        ],
        "diagnostics": {"observations": len(series)},
        "selection": "Lowest rolling validation MAE, then RMSE. Prophet includes monthly seasonality.",
    }


if __name__ == "__main__":
    try:
        result = forecast(json.load(sys.stdin))
        print(json.dumps(result, allow_nan=False))
    except Exception as e:
        print(json.dumps({"error": f"Forecasting failed: {str(e)}"}))
        sys.exit(1)