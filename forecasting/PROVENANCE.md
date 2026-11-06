# Forecasting reference and adaptation

Requested reference: [Shreyansh055/Time-Series-Forecasting_055](https://github.com/Shreyansh055/Time-Series-Forecasting_055), inspected at commit `875079dd666ad174bbfb12f13e78dd71610e33fd`.

The repository consists of Jupyter research notebooks. `Model Selection.ipynb`
compares autoregressive orders using AIC and checks stationarity with ADF;
`MA Model.ipynb` fits a moving-average model and evaluates time-ordered predictions.
`code.ipynb` explores an LSTM on monthly production, while other notebooks analyze
financial volatility and investments.

LibraLearn's worker is a new implementation of the AR/MA comparison and chronological
evaluation workflow, using the maintained `statsmodels.tsa.arima.model.ARIMA` API.
The original notebook files and their example datasets are not application dependencies.
Library counts replace the example stock/production series. The app does not report
the illustrative accuracy numbers from the repository README as library accuracy.

Adaptations:

- AR, MA, ARMA, differenced models, and a last-month baseline are compared.
- The last three complete months are evaluated using rolling origins. Each fit
  sees earlier observations only. All candidates use the same validation dates.
- MAE selects the model; RMSE and training AIC break ties. AIC is from the last
  validation training fit and should be interpreted alongside the error metrics.
- The selected model is refitted on all observed complete months and forecasts
  three months directly. Failed/nonconvergent candidates are excluded.
- Demand forecasts are clipped to zero and rounded to one decimal place. MAPE
  excludes zero actuals and reports the number of months used.
- The Python worker receives only counts via stdin and returns JSON. Laravel
  retains authentication, database queries, calendar labels, caching, and copy planning.
- Current aggregate demand predictions use this worker; per-title copy estimates
  retain the weighted-average/linear-trend baseline and are labeled accordingly.

Primary API documentation: [ARIMA](https://www.statsmodels.org/stable/generated/statsmodels.tsa.arima.model.ARIMA.html).

## Local runtime

An isolated `.forecast-venv` and project-local Python are installed for this workspace.
For another machine with Python 3.12 installed:

```powershell
python -m venv .forecast-venv
.forecast-venv\Scripts\python.exe -m pip install -r forecasting/requirements.lock.txt
.forecast-venv\Scripts\python.exe -m unittest discover -s forecasting -p "test_*.py"
```

On Linux use `.forecast-venv/bin/python`. Laravel chooses the appropriate local path.
Optional backend `LIBRARY_FORECAST_PYTHON` sets a different Python executable.
`LIBRARY_FORECAST_ENABLED=false` disables the Python model comparison. If Python
is unavailable or fitting fails, the response explicitly reports baseline fallback.

The worker requires eight complete months after the first recorded request. Select
12 or more months on Analytics & Predictions to include that history. No Gemini key
or separate Python web server is needed. Dependency and notebook downloads are only
needed during setup; normal forecasts run locally.
