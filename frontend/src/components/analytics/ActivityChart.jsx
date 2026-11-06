import AnalyticsLineChart from './AnalyticsLineChart';

const SERIES = [
  { key: 'demand', label: 'Requests', tone: 'indigo' },
  { key: 'loans', label: 'Loans fulfilled', tone: 'teal' },
];

export default function ActivityChart({ periods, weekly = false }) {
  return <AnalyticsLineChart rows={periods} series={SERIES} label={`${weekly ? 'Weekly' : 'Monthly'} requests and fulfilled loans`} note={`${weekly ? 'Weekly' : 'Monthly'} totals · Requests include reservations`} weekly={weekly} />;
}
