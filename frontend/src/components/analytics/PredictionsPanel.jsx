import { useState } from 'react';
import { TrendingUp, SlidersHorizontal } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import PredictionChart from './PredictionChart';

const CONFIDENCE_VARIANTS = { low: 'info', medium: 'warning', high: 'success' };

export function PredictionsPanel({ predictions, monthly }) {
  const [horizon, setHorizon] = useState(3);
  const forecast = predictions?.months?.slice(0, horizon) || [];
  const history = monthly.complete.slice(-6);
  const rows = [
    ...history.map((month) => ({ month: month.month, label: month.label, requests: month.demand, predicted: false })),
    ...forecast.map((month) => ({ ...month, predicted: true })),
  ];

  return (
    <Card className="insights-predictions p-5">
      <div className="insights-section-heading mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-[var(--text)]">
          <TrendingUp className="h-5 w-5 text-primary-600" /> Demand predictions
        </h3>
        {predictions?.available && (
          <div className="insights-forecast-controls flex items-center gap-3">
            <Badge variant={CONFIDENCE_VARIANTS[predictions.confidence]}>{predictions.confidence} confidence</Badge>
            <label className="text-sm text-[var(--text-muted)]">
              Show
              <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))} className="ml-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)]">
                {[1, 2, 3].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'month' : 'months'}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      {!predictions?.available ? (
        <p className="text-sm text-[var(--text-muted)]">{predictions?.reason || 'Keep recording borrowing requests to build enough history for predictions.'}</p>
      ) : (
        <>
          <p className="mb-5 text-sm text-[var(--text-muted)]">
            About <strong className="text-[var(--text)]">{Math.round(forecast.reduce((total, month) => total + month.requests, 0))} requests</strong> across the next {horizon} {horizon === 1 ? 'forecast month' : 'forecast months'}, starting with the current month.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
            <Badge variant={predictions.engine === 'statsmodels' ? 'purple' : 'info'}>{predictions.selected_model}</Badge>
            <a href={predictions.source_repository} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Forecasting reference</a>
          </div>
          {predictions.fallback_reason && <p className="mb-4 text-sm text-[var(--text-muted)]">{predictions.fallback_reason}</p>}
          <PredictionChart rows={rows} />
          <div className="insights-forecast-months mt-5 grid gap-3 sm:grid-cols-3">
            {forecast.map((month) => (
              <div key={month.month} className="rounded-lg bg-[var(--surface-2)] p-3">
                <p className="text-sm text-[var(--text-muted)]">{month.label}</p>
                <p className="mt-1 text-xl font-semibold text-[var(--text)]">{month.requests} <span className="text-xs font-normal">requests</span></p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Based on {predictions.history_months} complete months of recorded history.
            {predictions.backtest.months_tested > 0
              ? ` Forecast checks against ${predictions.backtest.months_tested} recent months missed actual demand by ${predictions.backtest.mean_absolute_error} requests per month on average.`
              : ' More history is needed to check forecast accuracy against previous months.'}
          </p>
          {predictions.model_comparison?.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">Model comparison on the same previous months</h4>
              <table className="w-full text-left text-sm text-[var(--text-muted)]">
                <caption className="mb-2 text-left text-xs">Lower MAE and RMSE indicate smaller forecast errors. MAPE excludes months with zero demand. AIC is reported from each model’s last validation training fit.</caption>
                <thead><tr className="border-b border-[var(--border)]">
                  <th className="p-2">Model</th><th className="p-2">MAE</th><th className="p-2">RMSE</th><th className="p-2">MAPE</th><th className="p-2">AIC</th>
                </tr></thead>
                <tbody>{predictions.model_comparison.map((model) => (
                  <tr key={model.model} className={`border-b border-[var(--border)] ${model.model === predictions.selected_model ? 'bg-[var(--surface-2)] font-medium' : ''}`}>
                    <td className="p-2">{model.model}{model.model === predictions.selected_model ? ' (selected)' : ''}</td>
                    <td className="p-2">{model.mean_absolute_error}</td>
                    <td className="p-2">{model.root_mean_squared_error}</td>
                    <td className="p-2">{model.mean_absolute_percentage_error === null ? '—' : `${model.mean_absolute_percentage_error}%`}</td>
                    <td className="p-2">{model.aic ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--text-faint)]">{predictions.notes}</p>
        </>
      )}
    </Card>
  );
}

export function CopyPlanner({ books, capacity }) {
  const [selectedId, setSelectedId] = useState(() => String(books[0]?.book_id || ''));
  const [extraCopies, setExtraCopies] = useState(0);
  const [loanDays, setLoanDays] = useState(capacity.loan_days);
  const book = books.find((item) => String(item.book_id) === selectedId) || books[0];
  const perCopy = 30 / (loanDays + capacity.turnaround_days) * capacity.target_utilization;
  const copies = (book?.current_copies || 0) + extraCopies;
  const forecast = book?.forecast_next_month || 0;
  const served = copies * perCopy;
  const shortage = Math.max(0, Math.ceil(forecast - served));
  const needed = Math.max(0, Math.ceil(forecast / perCopy) - copies);

  return (
    <Card className="insights-planner p-5">
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-[var(--text)]"><SlidersHorizontal className="h-5 w-5 text-primary-600" /> Copy planning simulator</h3>
      <p className="mb-4 text-sm text-[var(--text-muted)]">Try adding copies or changing the loan duration for a title. These are planning estimates; saving library policy happens in Settings.</p>
      {!book ? <p className="text-sm text-[var(--text-muted)]">Books with borrowing activity will appear here once records are available.</p> : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-[var(--text-muted)]">Book
              <select value={String(book.book_id)} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
                {books.map((item) => <option key={item.book_id} value={item.book_id}>{item.title}</option>)}
              </select>
            </label>
            <label className="text-sm text-[var(--text-muted)]">Extra copies: {extraCopies}
              <input type="range" min="0" max="10" value={extraCopies} onChange={(event) => setExtraCopies(Number(event.target.value))} className="mt-3 block w-full accent-teal-700" />
            </label>
            <label className="text-sm text-[var(--text-muted)]">Loan duration: {loanDays} {loanDays === 1 ? 'day' : 'days'}
              <input type="range" min="1" max={Math.max(30, capacity.loan_days)} value={loanDays} onChange={(event) => setLoanDays(Number(event.target.value))} className="mt-3 block w-full accent-teal-700" />
            </label>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Predicted demand', `${forecast} requests`],
              ['Planned capacity', `${served.toFixed(1)} loans/month`],
              ['Possible unmet demand', `${shortage} requests`],
              ['Further copies needed', needed],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[var(--surface-2)] p-3">
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--text)]">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-faint)]">
            {book.current_copies} existing usable copies; {capacity.turnaround_days}-day turnaround; {Math.round(capacity.target_utilization * 100)}% planned utilization. Demand includes reservations and may count repeat requests. Confidence for this title: {book.confidence}.
            {' '}Per-title planning uses the weighted-average and linear-trend baseline.
          </p>
        </>
      )}
    </Card>
  );
}
