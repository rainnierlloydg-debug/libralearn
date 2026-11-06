"""Library-demand AR/MA model comparison, informed by the linked research notebooks.

This is a new implementation using the current statsmodels ARIMA API.
Read one JSON request from stdin; return one JSON response on stdout.
Only monthly counts are received. No names, credentials, or database access.
"""
import json
import math
import sys
import warnings

import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller

ORDERS = [(0, 0, 0), (1, 0, 0), (0, 0, 1), (1, 0, 1), (0, 1, 0), (1, 1, 0), (0, 1, 1)]
MIN_HISTORY = 8


def bounded(values):
    numbers = [float(value) for value in values]
    if not all(math.isfinite(value) for value in numbers):
        raise ValueError("Model returned nonfinite values")
    return [round(max(0.0, value), 1) for value in numbers]


def metrics(results):
    errors = [row["actual"] - row["predicted"] for row in results]
    percentages = [abs(row["actual"] - row["predicted"]) / row["actual"] * 100
                   for row in results if row["actual"] > 0]
    return {
        "mean_absolute_error": round(sum(abs(error) for error in errors) / len(errors), 2),
        "root_mean_squared_error": round(math.sqrt(sum(error * error for error in errors) / len(errors)), 2),
        "mean_absolute_percentage_error": round(sum(percentages) / len(percentages), 2) if percentages else None,
        "percentage_months_tested": len(percentages),
    }


def fitted(series, order):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = ARIMA(np.asarray(series, dtype=float), order=order).fit(method_kwargs={"maxiter": 100})
    if not model.mle_retvals.get("converged", True):
        raise ValueError("Model did not converge")
    return model


def evaluate(series, order):
    checks = []
    aic = None
    for index in range(len(series) - 3, len(series)):
        training = series[:index]
        if order is None:
            predicted = bounded([training[-1]])[0]
        else:
            model = fitted(training, order)
            predicted = bounded(model.forecast(steps=1))[0]
            aic = float(model.aic) if math.isfinite(model.aic) else None
        checks.append({"index": index, "predicted": predicted, "actual": series[index],
                       "absolute_error": round(abs(series[index] - predicted), 1)})
    return {"model": "Last-month baseline" if order is None else f"ARIMA{order}",
            "order": list(order) if order is not None else None,
            "aic": round(aic, 2) if aic is not None else None,
            "results": checks, **metrics(checks)}


def forecast(payload):
    series = payload.get("series")
    horizon = payload.get("horizon", 3)
    if not isinstance(series, list) or not MIN_HISTORY <= len(series) <= 120:
        raise ValueError("ARIMA needs between 8 and 120 monthly observations")
    if not isinstance(horizon, int) or isinstance(horizon, bool) or not 1 <= horizon <= 12:
        raise ValueError("Invalid forecast horizon")
    if any(isinstance(value, bool) or not isinstance(value, (int, float))
           or not math.isfinite(value) or value < 0 for value in series):
        raise ValueError("Counts must be finite, nonnegative numbers")

    # A baseline makes the model-selection result assessable on the same months.
    candidates = [evaluate(series, None)]
    if max(series) != min(series):
        for order in ORDERS:
            try:
                candidates.append(evaluate(series, order))
            except (ValueError, np.linalg.LinAlgError, ZeroDivisionError):
                continue
    ranked = sorted(candidates, key=lambda row: (
        row["mean_absolute_error"], row["root_mean_squared_error"],
        row["aic"] if row["aic"] is not None else float("inf")))
    chosen = None
    projections = None
    for candidate in ranked:
        try:
            projections = bounded([series[-1]] * horizon) if candidate["order"] is None else bounded(
                fitted(series, tuple(candidate["order"])).forecast(steps=horizon))
            chosen = candidate
            break
        except (ValueError, np.linalg.LinAlgError, ZeroDivisionError):
            continue
    if chosen is None:
        raise ValueError("No stable forecast could be fitted")

    adf_pvalue = None
    if len(series) >= 12 and max(series) != min(series):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                adf_pvalue = round(float(adfuller(series, maxlag=min(3, len(series) // 4 - 1), autolag="AIC")[1]), 4)
        except ValueError:
            pass

    return {
        "engine": "statsmodels", "selected_model": chosen["model"], "order": chosen["order"],
        "forecasts": projections,
        "backtest": {"months_tested": len(chosen["results"]), "results": chosen["results"],
                     **metrics(chosen["results"])},
        "model_comparison": [{key: value for key, value in row.items() if key != "results"} for row in ranked],
        "diagnostics": {"observations": len(series), "adf_pvalue": adf_pvalue},
        "selection": "Lowest rolling validation MAE, then RMSE, then training AIC. Final fit uses all complete months.",
    }


if __name__ == "__main__":
    try:
        print(json.dumps(forecast(json.load(sys.stdin)), allow_nan=False))
    except Exception:
        # Detailed exceptions may contain local paths; keep the protocol predictable.
        print(json.dumps({"error": "Forecasting failed; check monthly history and the Python dependencies."}))
        sys.exit(1)
