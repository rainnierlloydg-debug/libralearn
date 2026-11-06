import { useId, useState } from 'react';
import './analytics-charts.css';

const HEIGHT = 272;
const number = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });
const cleanLabel = (label) => label.replace(' (to date)', '');
const pointString = (points) => points.map((point) => point.join(',')).join(' ');
const area = (points) => points.length > 1 ? `M ${points[0][0]},${HEIGHT} L ${pointString(points)} L ${points[points.length - 1][0]},${HEIGHT} Z` : '';

export default function AnalyticsLineChart({ rows, series, label, note, forecast = false, weekly = false }) {
  const gradientId = useId().replace(/:/g, '');
  const [activeIndex, setActiveIndex] = useState(null);
  const peak = Math.max(1, ...rows.flatMap((row) => series.map(({ key }) => Number(row[key]) || 0)));
  const roughStep = peak * 1.15 / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= roughStep) * magnitude);
  const ceiling = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((value) => value * step);
  const splitIndex = rows.findIndex((row) => forecast ? row.predicted : row.partial);
  const x = (index) => (index + 0.5) / rows.length * 1000;
  const y = (value) => (1 - (Number(value) || 0) / ceiling) * HEIGHT;
  const activeRow = rows[activeIndex];
  const hasActivity = rows.some((row) => series.some(({ key }) => Number(row[key]) > 0));

  if (!rows.length) return <p className="analytics-chart-empty">No data to display for this period.</p>;

  return (
    <figure className="analytics-chart" aria-label={label}>
      <figcaption className="analytics-chart-caption">
        <div className="analytics-chart-legends">
          {forecast ? <>
            <span className="analytics-chart-legend"><i className="analytics-chart-swatch" data-tone="indigo" /> Recorded requests</span>
            <span className="analytics-chart-legend"><i className="analytics-chart-swatch is-dashed" data-tone="teal" /> Predicted requests</span>
          </> : series.map(({ key, label: seriesLabel, tone }) => (
            <span key={key} className="analytics-chart-legend"><i className="analytics-chart-swatch" data-tone={tone} />{seriesLabel}<strong>{number.format(rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0))}</strong></span>
          ))}
        </div>
        <span className="analytics-chart-note">{note}</span>
      </figcaption>
      <div className="analytics-chart-scroll" role="region" aria-label={`${label}, scroll horizontally on smaller screens`} tabIndex={0}>
        <div className="analytics-chart-canvas" style={{ minWidth: Math.max(540, rows.length * 74) }}>
          <div className="analytics-chart-axis-title">{forecast ? 'Requests' : 'Count'}</div>
          <div className="analytics-chart-frame">
            <div className="analytics-chart-y-axis" aria-hidden="true">
              {ticks.map((tick) => <span key={tick} style={{ top: `${(1 - tick / ceiling) * 100}%` }}>{number.format(tick)}</span>)}
            </div>
            <div className="analytics-chart-plot">
              {splitIndex >= 0 && <div className="analytics-chart-projection" style={{ left: `${splitIndex / rows.length * 100}%` }} aria-hidden="true"><span>{forecast ? 'Forecast' : 'In progress'}</span></div>}
              <div className="analytics-chart-grid" aria-hidden="true">
                {ticks.map((tick) => <div key={tick} className={tick === 0 ? 'is-baseline' : ''} style={{ top: `${(1 - tick / ceiling) * 100}%` }} />)}
              </div>
              <svg className="analytics-chart-lines" viewBox={`0 0 1000 ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  {['indigo', 'teal'].map((tone) => <linearGradient key={tone} id={`${gradientId}-${tone}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={`var(--chart-${tone})`} stopOpacity="0.2" /><stop offset="100%" stopColor={`var(--chart-${tone})`} stopOpacity="0.01" /></linearGradient>)}
                </defs>
                {series.map(({ key, tone }) => {
                  const points = rows.map((row, index) => [x(index), y(row[key])]);
                  const recorded = splitIndex < 0 ? points : points.slice(0, splitIndex);
                  const continued = splitIndex < 0 ? [] : points.slice(Math.max(0, splitIndex - 1));
                  const continuedTone = forecast ? 'teal' : tone;
                  return <g key={key} strokeLinecap="round" strokeLinejoin="round">
                    <path d={area(recorded)} fill={`url(#${gradientId}-${tone})`} />
                    <path d={area(continued)} fill={`url(#${gradientId}-${continuedTone})`} />
                    <polyline points={pointString(recorded)} fill="none" stroke={`var(--chart-${tone})`} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    <polyline points={pointString(continued)} fill="none" stroke={`var(--chart-${continuedTone})`} strokeWidth="2.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
                  </g>;
                })}
              </svg>
              {activeRow && <div className="analytics-chart-guide" style={{ left: `${(activeIndex + 0.5) / rows.length * 100}%` }} aria-hidden="true" />}
              <div className="analytics-chart-targets" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} onMouseLeave={() => setActiveIndex(null)}>
                {rows.map((row, index) => <button key={row.month || row.label} type="button" className={`analytics-chart-target ${activeIndex === index ? 'is-active' : ''}`}
                  aria-label={`${cleanLabel(row.label)}${row.predicted ? ', predicted' : row.partial ? ', in progress' : ''}: ${series.map(({ key, label: seriesLabel }) => `${number.format(row[key] || 0)} ${seriesLabel.toLowerCase()}`).join(', ')}`}
                  onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} onClick={() => setActiveIndex(index)}>
                  {series.map(({ key, tone }, seriesIndex) => <span key={key} className={`analytics-chart-point ${row.predicted || row.partial ? 'is-hollow' : ''} ${seriesIndex > 0 ? 'is-small' : ''}`} data-tone={forecast && row.predicted ? 'teal' : tone} style={{ top: `${y(row[key]) / HEIGHT * 100}%` }} aria-hidden="true" />)}
                </button>)}
              </div>
              {activeRow && <div className="analytics-chart-tooltip" style={{ left: `${(activeIndex + 0.5) / rows.length * 100}%`, transform: `translateX(${activeIndex < rows.length / 3 ? '0' : activeIndex >= rows.length * 2 / 3 ? '-100%' : '-50%'})` }} aria-hidden="true">
                <strong>{cleanLabel(activeRow.label)}</strong>
                {(activeRow.predicted || activeRow.partial) && <small>{activeRow.predicted ? 'Predicted demand' : 'Period still in progress'}</small>}
                {series.map(({ key, label: seriesLabel, tone }) => <div key={key}><span><i data-tone={forecast && activeRow.predicted ? 'teal' : tone} />{seriesLabel}</span><b>{number.format(activeRow[key] || 0)}</b></div>)}
              </div>}
              {!hasActivity && <p className="analytics-chart-no-data">No requests or loans recorded in this period.</p>}
            </div>
          </div>
          <div className="analytics-chart-x-axis" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} aria-hidden="true">
            {rows.map((row) => <span key={row.month || row.label} className={row.predicted ? 'is-forecast' : ''}>{weekly ? cleanLabel(row.label).split(/\s[-–]\s/).map((part, index) => <span key={index}>{index ? `– ${part}` : part}</span>) : cleanLabel(row.label)}</span>)}
          </div>
        </div>
      </div>
      <p className="analytics-chart-hint">Hover, tap, or focus a point to see the exact figures.</p>
    </figure>
  );
}
