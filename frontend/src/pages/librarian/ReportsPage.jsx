import { useState, useEffect } from 'react';
import { Download, Calendar, Filter, BookOpen, Users, TrendingUp, BarChart, Clock, Bookmark, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('books');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const tabs = [
    { id: 'books', label: 'Book Report', icon: BookOpen },
    { id: 'borrowing', label: 'Borrowing Report', icon: TrendingUp },
    { id: 'students', label: 'Student Activity', icon: Users },
    { id: 'ai', label: 'AI Cataloging', icon: Sparkles },
  ];

  useEffect(() => {
    fetchReport();
  }, [activeTab, dateRange.from, dateRange.to]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
      });
      let endpoint = '';
      switch (activeTab) {
        case 'books': endpoint = '/reports/books'; break;
        case 'borrowing': endpoint = '/reports/borrowing'; break;
        case 'students': endpoint = '/reports/student-activity'; break;
        case 'ai': endpoint = '/reports/ai-cataloging'; break;
      }
      const response = await api.get(`${endpoint}?${params.toString()}`);
      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type) => {
    try {
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
      });
      let endpoint = '';
      switch (activeTab) {
        case 'books': endpoint = '/reports/books/export'; break;
        case 'borrowing': endpoint = '/reports/borrowing/export'; break;
        case 'students': endpoint = '/reports/student-activity/export'; break;
        case 'ai': endpoint = '/reports/ai-cataloging/export'; break;
      }
      const response = await api.get(`${endpoint}?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${dateRange.from}_to_${dateRange.to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Reports & Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const renderBookReport = () => {
    const { books, summary } = reportData || {};
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Total Books</p>
            <p className="text-3xl font-bold text-[var(--text)]">{summary?.total || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Available</p>
            <p className="text-3xl font-bold text-green-600">
              {summary?.by_status?.find(s => s.status === 'available')?.count || 0}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Borrowed</p>
            <p className="text-3xl font-bold text-blue-600">
              {summary?.by_status?.find(s => s.status === 'borrowed')?.count || 0}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Overdue</p>
            <p className="text-3xl font-bold text-red-600">
              {summary?.by_status?.find(s => s.status === 'overdue')?.count || 0}
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">Books by Genre</h3>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              <div className="space-y-3">
                {summary?.by_genre?.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text)]">{item.genre}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[var(--border)] rounded overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded"
                          style={{ width: `${(item.count / (summary.by_genre[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-[var(--text)] w-12 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">Books by Subject</h3>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              <div className="space-y-3">
                {summary?.by_subject?.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text)]">{item.subject}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[var(--border)] rounded overflow-hidden">
                        <div
                          className="h-full bg-accent-500 rounded"
                          style={{ width: `${(item.count / (summary.by_subject[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-[var(--text)] w-12 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Books by Status</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {summary?.by_status?.map((item) => (
                <div key={item.status} className="text-center p-3 bg-[var(--surface-2)] rounded-lg">
                  <p className="text-2xl font-bold text-[var(--text)]">{item.count}</p>
                  <p className="text-sm text-[var(--text-muted)] capitalize">{item.status.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderBorrowingReport = () => {
    const { transactions, summary } = reportData || {};
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Total Transactions</p>
            <p className="text-3xl font-bold text-[var(--text)]">{summary?.total_transactions || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Currently Borrowed</p>
            <p className="text-3xl font-bold text-blue-600">
              {summary?.current_borrowed?.length || 0}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Overdue</p>
            <p className="text-3xl font-bold text-red-600">
              {summary?.overdue_transactions?.length || 0}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Most Borrowed</p>
            <p className="text-3xl font-bold text-[var(--text)]">
              {summary?.most_borrowed?.[0]?.borrow_count || 0}
            </p>
          </Card>
        </div>

        <Card>
          <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Most Borrowed Books</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {summary?.most_borrowed?.slice(0, 10).map((book, i) => (
                <div key={book.id} className="flex items-center gap-4 p-3 bg-[var(--surface-2)] rounded-lg">
                  <span className="w-8 text-center font-bold text-[var(--text-muted)]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{book.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{book.author}</p>
                  </div>
                  <Badge variant="primary">{book.borrow_count} borrows</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">Overdue Transactions</h3>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {summary?.overdue_transactions?.length > 0 ? (
                <div className="space-y-2">
                  {summary.overdue_transactions.slice(0, 10).map((t) => (
                    <div key={t.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-lg">
                      <p className="font-medium text-sm">{t.book.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t.student.name} • Due: {t.due_date ? formatDate(t.due_date) : 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-[var(--text-muted)] py-4">No overdue transactions</p>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">Transactions by Status</h3>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {summary?.by_status?.map((item) => (
                  <div key={item.status} className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
                    <span className="capitalize">{item.status.replace('_', ' ')}</span>
                    <Badge variant="primary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderStudentActivityReport = () => {
    const { active_students, top_interests, most_saved, recommendation_interactions } = reportData || {};
    return (
      <div className="space-y-6">
        <Card>
          <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Active Students</h3>
            <span className="text-sm text-[var(--text-muted)]">{active_students?.length || 0} students</span>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            {active_students?.length > 0 ? (
              <div className="space-y-2">
                {active_students.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 hover:bg-[var(--surface-2)] rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm font-medium text-[var(--text-muted)]">
                        {s.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{s.school_id} • {s.grade_level} {s.section}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--text-muted)]">
                      <p>Borrowed: {s._count?.borrowedBooks || 0}</p>
                      <p>Reserved: {s._count?.reservations || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[var(--text-muted)] py-4">No active students in this period</p>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">Top Interests</h3>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {top_interests?.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Badge variant={item.type === 'genre' ? 'primary' : 'accent'}>{item.name}</Badge>
                    <span className="text-sm font-medium">{item._count?.student_count || 0} students</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">Most Saved Books</h3>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {most_saved?.slice(0, 10).map((book, i) => (
                  <div key={book.id} className="flex items-center gap-3 p-2 hover:bg-[var(--surface-2)] rounded">
                    <span className="w-6 text-center font-bold text-[var(--text-muted)]">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{book.title}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{book.author}</p>
                    </div>
                    <Badge variant="accent">{book.save_count} saves</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Recommendation Interactions</h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-4">
              {recommendation_interactions?.map((item) => (
                <div key={item.feedback} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-2)] rounded-lg">
                  <Badge variant={item.feedback === 'like' ? 'success' : 'warning'}>{item.feedback}</Badge>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderAiCatalogingReport = () => {
    const { jobs, summary } = reportData || {};
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Total Processed</p>
            <p className="text-3xl font-bold text-[var(--text)]">{summary?.total_processed || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Successful</p>
            <p className="text-3xl font-bold text-green-600">{summary?.successful_identification || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Needs Review</p>
            <p className="text-3xl font-bold text-yellow-600">{summary?.requiring_manual_correction || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Avg Confidence</p>
            <p className="text-3xl font-bold text-[var(--text)]">{summary?.avg_confidence?.toFixed(1) || 0}%</p>
          </Card>
        </div>

        <Card>
          <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Jobs by Status</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {summary?.by_status?.map((item) => (
                <div key={item.status} className="text-center p-3 bg-[var(--surface-2)] rounded-lg">
                  <p className="text-2xl font-bold text-[var(--text)]">{item.count}</p>
                  <p className="text-sm text-[var(--text-muted)] capitalize">{item.status.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Recent Jobs</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {jobs?.slice(0, 20).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
                  <div className="flex items-center gap-3">
                    {job.uploaded_image && (
                      <img src={`/storage/${job.uploaded_image}`} alt="" className="w-12 h-16 object-cover rounded" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{job.final_metadata?.title || job.extracted_metadata?.title || 'Not detected'}</p>
                      <p className="text-xs text-[var(--text-muted)]">By {job.reviewed_by} • {formatDate(job.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={job.status === 'confirmed' ? 'success' : job.status === 'needs_review' ? 'warning' : job.status === 'draft' ? 'purple' : 'danger'}>
                      {job.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm font-medium text-[var(--text-muted)]">{job.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="admin-reports-page space-y-6">
      <div className="admin-report-toolbar flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Reports & Analytics</h1>
          <p className="text-[var(--text-muted)]">View and export library reports and statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="admin-report-date-controls flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
              className="input w-auto"
            />
            <span className="text-[var(--text-muted)]">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
              className="input w-auto"
            />
          </div>
          <Button variant="secondary" onClick={() => handleExport('csv')}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-shell border-b-[var(--border)]">
        <nav className="flex gap-1 overflow-x-auto pb-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'books' && renderBookReport()}
      {activeTab === 'borrowing' && renderBorrowingReport()}
      {activeTab === 'students' && renderStudentActivityReport()}
      {activeTab === 'ai' && renderAiCatalogingReport()}
    </div>
  );
}

function Sparkles() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L18 21l-2.286-6.857L3 12l5.714-2.143L6 3z" />
    </svg>
  );
}

export default ReportsPage;
