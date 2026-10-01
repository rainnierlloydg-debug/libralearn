import { useState, useEffect } from 'react';
import { MapPin, BookOpen, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import BookCard from '../../components/book/BookCard';
import { formatDate } from '../../utils/helpers';

function LibraryMapPage() {
  const { user } = useAuth();
  const [mapData, setMapData] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionBooks, setSectionBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSectionPanel, setShowSectionPanel] = useState(false);
  const [bookFromUrl, setBookFromUrl] = useState(null);

  useEffect(() => {
    fetchMapData();
  }, []);

  useEffect(() => {
    // Check if we came from a book detail page
    const urlParams = new URLSearchParams(window.location.search);
    const bookSection = urlParams.get('section');
    const bookShelf = urlParams.get('shelf');
    if (bookSection) {
      setBookFromUrl({ section: bookSection, shelf: bookShelf });
      setSelectedSection(bookSection);
    }
  }, []);

  const fetchMapData = async () => {
    try {
      const response = await api.get('/library-locations/map');
      if (response.data.success) {
        setMapData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch map data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSectionBooks = async (sectionName) => {
    try {
      const response = await api.get(`/library-locations/section/${sectionName}/books`);
      if (response.data.success) {
        setSectionBooks(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch section books:', err);
    }
  };

  const handleSectionClick = (section) => {
    setSelectedSection(section.section_name);
    setShowSectionPanel(true);
    fetchSectionBooks(section.section_name);
  };

  const handleClosePanel = () => {
    setSelectedSection(null);
    setShowSectionPanel(false);
    setSectionBooks([]);
  };

  const getShelfColor = (index) => {
    const colors = [
      'from-primary-500 to-primary-600',
      'from-accent-500 to-accent-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-blue-500 to-blue-600',
      'from-pink-500 to-pink-600',
      'from-orange-500 to-orange-600',
      'from-teal-500 to-teal-600',
    ];
    return colors[index % colors.length];
  };

  const sectionIcons = {
    Fiction: BookOpen,
    Science: BookOpen,
    Mathematics: BookOpen,
    English: BookOpen,
    Filipino: BookOpen,
    History: BookOpen,
    Reference: BookOpen,
    Others: BookOpen,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Library Map</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-8 bg-[var(--surface-2)] rounded mb-4" />
              <div className="h-4 bg-[var(--surface-2)] rounded w-3/4" />
              <div className="h-4 bg-[var(--surface-2)] rounded w-1/2 mt-2" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Library Map</h1>
          <p className="text-[var(--text-muted)]">Navigate the GSA library sections and find your books</p>
        </div>
        {selectedSection && (
          <Button variant="secondary" onClick={handleClosePanel} className="w-full md:w-auto">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Map
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-4 h-full">
            <h3 className="font-semibold text-[var(--text)] mb-4">Library Sections</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {mapData.map((section, index) => {
                const isSelected = selectedSection === section.section_name;
                const Icon = sectionIcons[section.section_name] || BookOpen;
                return (
                  <button
                    key={section.section_name}
                    onClick={() => handleSectionClick(section)}
                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500'
                        : 'hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${getShelfColor(index)}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text)] truncate">{section.section_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {section.shelves?.length || 0} shelves • {section.book_count} books
                      </p>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 text-primary-500" />}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Map visualization */}
        <div className="lg:col-span-3">
          {showSectionPanel && selectedSection ? (
            <div className="space-y-4 animate-slide-up">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br bg-primary-500/20 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text)]">{selectedSection}</h3>
                      <p className="text-sm text-[var(--text-muted)]">
                        {sectionBooks.length} books in this section
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={handleClosePanel}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                </div>
              </Card>

              {sectionBooks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionBooks.map((book) => (
                    <BookCard key={book.id} book={book} variant="grid" showActions={true} />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
                  <h4 className="text-lg font-medium text-[var(--text)] mb-1">No books in this section</h4>
                  <p className="text-[var(--text-muted)]">Books will appear here when added to this section.</p>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-4 h-[600px] overflow-hidden">
              <div className="h-full relative">
                {/* SVG Map */}
                <svg viewBox="0 0 1000 1100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  {/* Entrance */}
                  <rect x="350" y="10" width="300" height="60" rx="10" fill="#E0E7FF" stroke="#4F46E5" strokeWidth="2" />
                  <text x="500" y="52" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#4F46E5" fontFamily="system-ui">ENTRANCE</text>

                  {/* Sections grid */}
                  {mapData.map((section, sectionIndex) => {
                    const shelves = section.shelves || [];
                    const shelfCount = shelves.length;
                    const col = sectionIndex % 2;
                    const row = Math.floor(sectionIndex / 2);
                    const baseX = 50 + col * 450;
                    const baseY = 100 + row * 220;
                    const sectionColors = {
                      Fiction: '#E0E7FF',
                      Science: '#DBEAFE',
                      Mathematics: '#FEF3C7',
                      English: '#FCE7F3',
                      Filipino: '#FED7AA',
                      History: '#EDE9FE',
                      Reference: '#F3F4F6',
                      Others: '#F1F5F9',
                    };
                    const bgColor = sectionColors[section.section_name] || '#E0E7FF';
                    const borderColors = {
                      Fiction: '#4F46E5',
                      Science: '#2563EB',
                      Mathematics: '#D97706',
                      English: '#DB2777',
                      Filipino: '#EA580C',
                      History: '#7C3AED',
                      Reference: '#6B7280',
                      Others: '#64748B',
                    };
                    const borderColor = borderColors[section.section_name] || '#4F46E5';

                    return (
                      <g key={section.section_name} onClick={() => handleSectionClick(section)} style={{ cursor: 'pointer' }}>
                        <rect 
                          x={baseX} 
                          y={baseY} 
                          width={400} 
                          height={200} 
                          rx="12" 
                          fill={bgColor} 
                          stroke={borderColor} 
                          strokeWidth="2"
                          filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                        />
                        <text x={baseX + 20} y={baseY + 30} fontSize="16" fontWeight="bold" fill={borderColor} fontFamily="system-ui">
                          {section.section_name.toUpperCase()}
                        </text>
                        <text x={baseX + 20} y={baseY + 55} fontSize="12" fill={borderColor} fontFamily="system-ui" opacity="0.8">
                          {section.book_count} books • {shelfCount} shelves
                        </text>
                        {/* Shelves visualization */}
                        {shelves.slice(0, 4).map((shelf, shelfIndex) => (
                          <rect
                            key={shelf.id}
                            x={baseX + 20 + shelfIndex * 90}
                            y={baseY + 70}
                            width={80}
                            height={100}
                            rx="6"
                            fill="white"
                            stroke={borderColor}
                            strokeWidth="1"
                            opacity="0.7"
                          />
                        ))}
                        {shelfCount > 4 && (
                          <text x={baseX + 20 + 4 * 90} y={baseY + 120} fontSize="10" fill={borderColor} fontFamily="system-ui" opacity="0.7">
                            +{shelfCount - 4} more
                          </text>
                        )}
                        {/* Click hint */}
                        <text x={baseX + 380} y={baseY + 190} fontSize="10" fill={borderColor} fontFamily="system-ui" opacity="0.5" textAnchor="end">
                          Click to explore →
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default LibraryMapPage;