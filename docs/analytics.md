# Admin analytics and predictions

Open **Analytics & Predictions** in the admin/librarian sidebar or dashboard,
at `/librarian/insights`. Students cannot access these reports.

The page provides request and fulfilled-loan trends, category demand, most
borrowed titles, copy recommendations, and titles with no requests. Select a
weekly or monthly reporting period. Refresh recalculates the selected period;
otherwise results are cached for the configured interval (30 minutes by default).

## Demand predictions

The chart compares recent recorded demand with up to three projected months.
The first projection covers the month in progress; later projections cover the
following months. Demand counts borrow requests plus reservations, so it can
include more than one request for the same eventual loan.

With eight or more observed months, aggregate predictions use Python statsmodels
AR/MA model comparison adapted from the requested
[forecasting repository](https://github.com/Shreyansh055/Time-Series-Forecasting_055).
Candidates are evaluated on the same three withheld months using rolling fits.
The smallest MAE selects the model, with RMSE and training AIC as tie-breakers;
it is then fitted on all complete history to predict three months directly.
The admin page displays the selected model and measured MAE/RMSE/MAPE/AIC.

Shorter histories or an unavailable Python runtime use the weighted-moving-average
and linear-trend baseline, with a visible explanation. Monthly estimates are
rounded to one decimal place and kept nonnegative. Setup and source details are in
[forecasting provenance](../forecasting/PROVENANCE.md).

Predictions require at least three complete calendar months since the first
recorded request within the selected window. Months padded before that first
request are excluded. Weekly/30-day windows show activity without predictions.

Confidence is a history/volume indicator: high requires 12 months and 100
requests; medium requires 6 months and 20 requests; other available forecasts
are low. These labels are not statistical probabilities. School holidays,
changes to class schedules, and unusual events can affect demand.

When history permits, the service tests predictions against up to three recent
months: train only on earlier months, predict the withheld month, compare with
its recorded requests, then report the mean absolute error in requests/month.
The currently unfinished month is excluded from training and accuracy checks.

## Copy planner

Choose a title with recorded borrowing activity or a copy recommendation, then
adjust extra copies and a hypothetical loan duration. Planned monthly capacity
is `copies * 30 / (loan days + turnaround days) * target utilization`.
The page displays predicted demand, capacity, possible unmet requests, and
further copies suggested. This simulation does not change actual loan rules or
book-copy records. The title forecast and confidence come from its demand analysis.

## API and verification

`GET /api/ai/insights?months=6` returns the new `data.predictions` object:
availability/reason, history length, confidence, monthly projections, total
projected requests, and forecast check results. Existing reports remain in the
same response. Librarian/admin authentication is required.

The calculations run locally through the project Python environment and need no Gemini API key. The optional written
briefing falls back to a rule-based summary when Gemini is unavailable.

Run `npm test`, `npm run lint`, and `npm --prefix frontend run build` to verify.
Tests use isolated sample history; production data is never seeded with fake loans.
