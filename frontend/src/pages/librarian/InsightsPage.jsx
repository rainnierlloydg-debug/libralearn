import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BookCopy, BrainCircuit, ChevronDown, ChevronUp, Info,
  ListChecks, RefreshCw, TrendingDown, TrendingUp, Minus, BookOpen,
} from 'lucide-react';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';

const MONTH_OPTIONS = [3, 6, 12];

const PRIORITY_VARIANT = { high: 'danger', medium: 'warning', low: 'info', none: 'info' };
const CONFIDENCE_VARIANT = { high: 'success', medium: 'warning', low: 'info' };

function TrendIcon({ trend }) {
  if (trend === 'rising') return <TrendingUp className="h-4 w-4 text-green-600" aria-label="Rising" />;
  if (trend === 'falling') return <TrendingDown className="h-4 w-4 text-red-600" aria-label="Falling" />;
  if (trend === 'steady') return <Minus className="h-4 w-4 text-[var(--text-faint)]" aria-label="Steady" />;
  return <span className="text-xs text-[var(--text-faint)]">n/a</span>;
}

function StatCard({ label, value, hint }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[var(--text)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--text-faint)]">{hint}</p>}
    </Card>
  );
}

/** Grouped bars: requests vs completed loans per month. */
function MonthlyChart({ monthly }) {
  const months = [...monthly.complete, { ...monthly.current, partial: true }];
  const max = Math.max(1, ...months.map((m) => m.demand));

  return (
    <div>
      <div className="flex h-48 items-end gap-2 sm:gap-4" role="img" aria-label="Monthly requests and loans">
        {months.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className={`w-1/2 max-w-6 rounded-t bg-primary-500 ${m.partial ? 'opacity-40' : ''}`}
                style={{ height: `${(m.demand / max) * 100}%` }}
                title={`${m.label}: ${m.demand} requests`}
              />
              <div
                className={`w-1/2 max-w-6 rounded-t bg-teal-500 ${m.partial ? 'opacity-40' : ''}`}
                style={{ height: `${(m.loans / max) * 100}%` }}
                title={`${m.label}: ${m.loans} loans`}
              />
            </div>
            <span className="mt-2 w-full truncate text-center text-[11px] text-[var(--text-muted)]">
              {m.label.replace(' (to date)', '')}{m.partial ? '*' : ''}
            </span>
            <span className="text-[11px] font-medium text-[var(--text)]">{m.demand}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-500" /> Requests (borrow + reserve)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Completed loans</span>
        <span>* month in progress</span>
      </div>
    </div>
  );
}

function Sparkline({ values }) {
  const list = Object.values(values || {});
  const max = Math.max(1, ...list);
  return (
    <div className="flex h-6 items-end gap-0.5" aria-hidden="true">
      {list.map((v, i) => (
        <span key={i} className="w-1.5 rounded-sm bg-primary-400" style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} />
      ))}
    </div>
  );
}

function RecommendationRow({ rec }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t border-[var(--border)] align-top">
        <td className="py-3 pr-3">
          <Link to="/librarian/books" className="font-medium text-[var(--text)] hover:underline">{rec.title}</Link>
          <p className="text-xs text-[var(--text-muted)]">{rec.author}{rec.location ? ` · ${rec.location}` : ''}</p>
        </td>
        <td className="py-3 pr-3 text-center">{rec.current_copies}</td>
        <td className="py-3 pr-3 text-center font-semibold text-[var(--text)]">+{rec.additional_copies}</td>
        <td className="py-3 pr-3 text-center">{rec.forecast_next_month}</td>
        <td className="py-3 pr-3"><div className="flex justify-center"><TrendIcon trend={rec.trend} /></div></td>
        <td className="py-3 pr-3"><Badge variant={PRIORITY_VARIANT[rec.priority]}>{rec.priority}</Badge></td>
        <td className="py-3 pr-3"><Badge variant={CONFIDENCE_VARIANT[rec.confidence]}>{rec.confidence}</Badge></td>
        <td className="py-3 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            aria-expanded={open}
          >
            Why {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="pb-3">
            <ul className="list-disc space-y-1 rounded-lg bg-[var(--surface-2)] px-8 py-3 text-sm text-[var(--text-muted)]">
              {rec.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function CategoryBars({ rows }) {
  if (!rows?.length) return <p className="text-sm text-[var(--text-muted)]">No activity yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.demand));
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-[var(--text)]">{row.name}</span>
            <span className="flex flex-shrink-0 items-center gap-2 text-xs text-[var(--text-muted)]">
              {row.demand} · {row.share}%
              {row.change !== null && (
                <span className={row.change > 0 ? 'text-green-600' : row.change < 0 ? 'text-red-600' : ''}>
                  {row.change > 0 ? '+' : ''}{row.change}% vs prior month
                </span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
            <div className="h-full rounded bg-primary-500" style={{ width: `${(row.demand / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function InsightsPage() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryTab, setCategoryTab] = useState('genre');

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setBriefingLoading(true);
    setError('');
    try {
      const res = refresh
        ? await api.post('/ai/insights/refresh', { months })
        : await api.get('/ai/insights', { params: { months } });
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Insights could not load right now. Please try again.');
    } finally {
      setLoading(false);
    }

    try {
      const res = await api.get('/ai/insights/briefing', { params: { months } });
      setBriefing(res.data.data);
    } catch {
      setBriefing(null);
    } finally {
      setBriefingLoading(false);
    }
  }, [months]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-heading font-bold text-[var(--text)]">
            <BrainCircuit className="h-6 w-6 text-primary-600" aria-hidden="true" /> AI Insights
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Which books students use most, how demand is moving, and which titles need more copies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5" role="group" aria-label="Period">
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`rounded-md px-3 py-1.5 text-sm ${months === m ? 'bg-primary-600 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
                aria-pressed={months === m}
              >
                {m} mo
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="flex items-center gap-3 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" /> {error}
        </Card>
      )}

      {/* Briefing */}
      <Card className="p-5">
        {briefingLoading ? (
          <div className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
        ) : briefing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--text)]">{briefing.headline}</h2>
              <Badge variant={briefing.source === 'ai' ? 'purple' : 'info'}>
                {briefing.source === 'ai' ? 'AI briefing' : 'Rule-based briefing'}
              </Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]"><Info className="h-3.5 w-3.5" /> Highlights</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
                  {briefing.highlights?.map((h) => <li key={h}>{h}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]"><ListChecks className="h-3.5 w-3.5" /> Suggested actions</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
                  {briefing.actions?.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">The briefing is unavailable. The numbers below still work.</p>
        )}
      </Card>

      {loading || !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Requests" value={data.summary.total_demand} hint={`Last ${data.window.months} full months`} />
            <StatCard label="Completed loans" value={data.summary.total_loans} hint={`${data.summary.turned_away} turned away`} />
            <StatCard
              label={`Forecast, ${data.window.forecast_label}`}
              value={data.summary.next_month_forecast}
              hint={`Trend: ${data.summary.trend}`}
            />
            <StatCard label="Titles needing copies" value={data.summary.books_needing_copies} hint={`${data.summary.books_in_demand} titles requested`} />
          </div>

          <Card className="p-5">
            <h3 className="mb-4 font-semibold text-[var(--text)]">Monthly activity</h3>
            <MonthlyChart monthly={data.monthly} />
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <BookCopy className="h-5 w-5 text-primary-600" aria-hidden="true" />
              <h3 className="font-semibold text-[var(--text)]">Copy recommendations</h3>
            </div>
            {data.copy_recommendations.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Current copies cover the forecast. No purchase needed right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm text-[var(--text-muted)]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-faint)]">
                      <th className="pb-2 pr-3 font-medium">Book</th>
                      <th className="pb-2 pr-3 text-center font-medium">Copies now</th>
                      <th className="pb-2 pr-3 text-center font-medium">Add</th>
                      <th className="pb-2 pr-3 text-center font-medium">Forecast</th>
                      <th className="pb-2 pr-3 text-center font-medium">Trend</th>
                      <th className="pb-2 pr-3 font-medium">Priority</th>
                      <th className="pb-2 pr-3 font-medium">Confidence</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.copy_recommendations.map((rec) => <RecommendationRow key={rec.book_id} rec={rec} />)}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary-600" aria-hidden="true" />
                <h3 className="font-semibold text-[var(--text)]">Most borrowed books</h3>
              </div>
              {data.top_books.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No completed loans in this period.</p>
              ) : (
                <ol className="space-y-3">
                  {data.top_books.map((book, i) => (
                    <li key={book.book_id} className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm font-semibold text-[var(--text-faint)]">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text)]">{book.title}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{book.genre || 'No genre'} · {book.window_loans} loans</p>
                      </div>
                      <Sparkline values={book.monthly_loans} />
                      <TrendIcon trend={book.trend} />
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-[var(--text)]">Demand by category</h3>
                <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-xs">
                  {['genre', 'subject'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCategoryTab(tab)}
                      className={`rounded-md px-2.5 py-1 capitalize ${categoryTab === tab ? 'bg-primary-600 text-white' : 'text-[var(--text-muted)]'}`}
                      aria-pressed={categoryTab === tab}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <CategoryBars rows={data.categories[categoryTab]} />
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-1 font-semibold text-[var(--text)]">Books with no requests</h3>
            <p className="mb-4 text-sm text-[var(--text-muted)]">Candidates for a display, a class reading list, or a condition check.</p>
            {data.underused.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Every older title had at least one request.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.underused.map((b) => (
                  <li key={b.book_id} className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm">
                    <span className="font-medium text-[var(--text)]">{b.title}</span>
                    <span className="text-[var(--text-muted)]"> · {b.location || b.genre || b.author}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 text-sm text-[var(--text-muted)]">
            <h3 className="mb-2 font-semibold text-[var(--text)]">How the forecast works</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{data.method.demand}</li>
              <li>{data.method.forecast}</li>
              <li>{data.method.capacity}</li>
              <li>
                {data.method.copies_source === 'book_copies'
                  ? 'Copy counts come from accession records.'
                  : 'Copy counts assume one copy per book record until accession numbers are added.'}
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

export default InsightsPage;
