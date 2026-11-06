import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Filter, X, Plus, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import api from '../../utils/api';
import RecommendationCard from '../../components/book/RecommendationCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import Select from '../../components/ui/Select';

function RecommendationsPage() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (selectedGenre) params.append('genre', selectedGenre);
      if (selectedSubject) params.append('subject', selectedSubject);
      const response = await api.get(`/recommendations?${params.toString()}`);
      if (response.data.success) {
        setRecommendations(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGenre, selectedSubject]);

  const fetchInterests = useCallback(async () => {
    try {
      const [genresRes, subjectsRes] = await Promise.all([
        api.get('/books/genres'),
        api.get('/books/subjects'),
      ]);
      if (genresRes.data.success) setGenres(genresRes.data.data);
      if (subjectsRes.data.success) setSubjects(subjectsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch interests:', err);
    }
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchRecommendations();
      fetchInterests();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRecommendations, fetchInterests]);

  const hasFilters = selectedGenre || selectedSubject;

  return (
    <div className="recommendations-page space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Recommended For You</h1>
          <p className="text-[var(--text-muted)]">Books selected based on your reading interests</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/search" className="btn btn-secondary w-full md:w-auto"><BookOpen className="w-4 h-4" aria-hidden="true" />Browse All Books</Link>
          <Link to="/profile" className="btn btn-primary w-full md:w-auto">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Update Interests
          </Link>
        </div>
      </div>

      {/* Current interests */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-[var(--text)]">Your Interests</h3>
          <Link to="/profile" className="btn btn-secondary btn-sm">Edit interests</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.interests?.map((interest) => (
            <Badge key={interest.id} variant={interest.type === 'genre' ? 'primary' : 'accent'} className="text-sm">
              {interest.name}
            </Badge>
          ))}
          {(!user?.interests || user.interests.length === 0) && (
            <span className="text-sm text-[var(--text-muted)]">No interests selected yet</span>
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-[var(--text)]">Filter Recommendations</h3>
          <Button variant="secondary" size="sm" onClick={() => setFilterOpen(!filterOpen)} aria-expanded={filterOpen} aria-controls="recommendation-filters">
            <Filter className="w-4 h-4 mr-1" />
            {filterOpen ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
        {filterOpen && (
          <div id="recommendation-filters" className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t border-[var(--border)] animate-slide-up">
            <div className="flex-1 min-w-[200px]">
              <Select
                label="Genre"
                options={[{ value: '', label: 'All Genres' }, ...genres.map(g => ({ value: g.name, label: g.name }))]}
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select
                label="Subject"
                options={[{ value: '', label: 'All Subjects' }, ...subjects.map(s => ({ value: s.name, label: s.name }))]}
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              />
            </div>
            {hasFilters && (
              <Button variant="secondary" onClick={() => { setSelectedGenre(''); setSelectedSubject(''); }}>
                <X className="w-4 h-4" aria-hidden="true" />
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </Card>

      <p className="text-sm text-[var(--text-muted)]" role="status">
        {loading ? 'Finding books for you...' : `${recommendations.length} recommended ${recommendations.length === 1 ? 'book' : 'books'}`}
      </p>

      {/* Recommendations grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : recommendations.length === 0 ? (
        <Card className="p-6 sm:p-12 text-center">
          <Sparkles className="w-16 h-16 mx-auto text-[var(--text-faint)] mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">No recommendations yet</h3>
          <p className="text-[var(--text-muted)] mb-6">
            {hasFilters
              ? 'No books match your current filters. Try adjusting them.'
              : 'Select your reading interests in your profile to get personalized recommendations.'
            }
          </p>
          {hasFilters && (
            <Button variant="secondary" onClick={() => { setSelectedGenre(''); setSelectedSubject(''); }}>
              Clear Filters
            </Button>
          )}
          {!hasFilters && (
            <Link to="/profile" className="btn btn-primary">
              <Plus className="w-4 h-4" />
              Update Interests
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((book) => (
            <RecommendationCard key={book.id} book={book} relevanceReason={book.why_recommended} />
          ))}
        </div>
      )}
    </div>
  );
}

export default RecommendationsPage;
