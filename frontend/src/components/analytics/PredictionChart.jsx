import AnalyticsLineChart from './AnalyticsLineChart';

const SERIES = [{ key: 'requests', label: 'Requests', tone: 'indigo' }];

export default function PredictionChart({ rows }) {
  return <AnalyticsLineChart rows={rows} series={SERIES} label="Recorded monthly requests and predicted requests" note="Dashed line shows predicted demand" forecast />;
}
