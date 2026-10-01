import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Clock3,
  Compass,
  MapPin,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';

function LandingPage() {
  const features = [
    {
      icon: BrainCircuit,
      title: 'Smart Cataloging',
      description: 'AI-powered OCR and metadata enrichment turn cover photos into clean, searchable book records in seconds.',
      accent: 'from-violet-500 to-indigo-600',
    },
    {
      icon: Search,
      title: 'Instant Search',
      description: 'Find titles, authors, genres, ISBNs, and subjects with filters for shelf location and availability.',
      accent: 'from-cyan-500 to-sky-600',
    },
    {
      icon: Star,
      title: 'Personalized Picks',
      description: 'Students get book suggestions built from reading patterns, interests, and feedback for better discovery.',
      accent: 'from-amber-400 to-orange-500',
    },
    {
      icon: Clock3,
      title: 'Borrow & Reserve',
      description: 'Track requests, due dates, due soon notices, and approvals from one streamlined library workflow.',
      accent: 'from-emerald-500 to-teal-600',
    },
    {
      icon: Compass,
      title: 'Online Discovery',
      description: 'Search beyond the local shelves and pull in trusted external sources for expanded book research.',
      accent: 'from-fuchsia-500 to-pink-600',
    },
    {
      icon: MapPin,
      title: 'Library Map',
      description: 'See shelf sections and location markers quickly so students can go directly to the right book.',
      accent: 'from-rose-500 to-red-500',
    },
  ];

  const stats = [
    { value: '10k+', label: 'Books indexed' },
    { value: '94%', label: 'Faster discovery' },
    { value: '24/7', label: 'Smart access' },
  ];

  const steps = [
    { number: 1, title: 'Browse', description: 'Search the catalog, filter by section, and preview availability in seconds.' },
    { number: 2, title: 'Choose', description: 'Compare recommendations, shelf location, and book details before borrowing.' },
    { number: 3, title: 'Enjoy', description: 'Borrow, reserve, and keep learning with a smoother library experience.' },
  ];

  return (
    <div className="landing-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand-wrap">
            <span className="brand-mark">L</span>
            <span>LibraLearn</span>
          </Link>

          <nav className="nav-links">
            <Link to="/search">Search</Link>
            <Link to="/recommendations">Recommendations</Link>
            <Link to="/library-map">Map</Link>
            <Link to="/login">Login</Link>
          </nav>

          <Link to="/register" className="btn btn-primary btn-sm hidden-mobile">
            Join now
          </Link>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-bg hero-glow-1" />
          <div className="hero-bg hero-glow-2" />

          <div className="hero-content">
            <div className="hero-copy">
              <span className="eyebrow">
                <Sparkles size={16} />
                Good Shepherded Academy Library
              </span>

              <h1>Discover smarter reading for every student.</h1>
              <p>
                Explore a modern digital library experience with AI-assisted cataloging, instant search,
                and personalized recommendations built for learning.
              </p>

              <div className="cta-row">
                <Link to="/search" className="btn btn-primary btn-lg">
                  <Search size={18} />
                  Search Library
                </Link>
                <Link to="/login" className="btn btn-secondary btn-lg">
                  Librarian Login
                </Link>
              </div>

              <div className="mini-stats">
                {stats.map((item) => (
                  <div key={item.label} className="mini-stat">
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-panel glass-card">
              <div className="panel-header">
                <span className="dot dot-purple" />
                <span className="dot dot-sky" />
                <span className="dot dot-green" />
              </div>

              <div className="book-card-main">
                <div className="book-visual">
                  <BookOpen size={32} />
                </div>
                <div>
                  <p className="panel-kicker">Today’s focus</p>
                  <h3>AI reads the shelf for you.</h3>
                </div>
              </div>

              <div className="search-chip-row">
                <span>History</span>
                <span>Science</span>
                <span>Fiction</span>
              </div>

              <div className="insight-grid">
                <div className="insight-box">
                  <TrendingUp size={18} />
                  <div>
                    <strong>1,284</strong>
                    <span>Book matches</span>
                  </div>
                </div>
                <div className="insight-box">
                  <Users size={18} />
                  <div>
                    <strong>820</strong>
                    <span>Active readers</span>
                  </div>
                </div>
              </div>

              <div className="recommendation-box">
                <div className="recommendation-tag">Top match</div>
                <h4>The Alchemist</h4>
                <p>Recommended based on your reading interests and recent borrow history.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-section">
          <div className="section-heading">
            <span className="eyebrow muted">Why students use it</span>
            <h2>Everything a modern library needs.</h2>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card glass-card card-hover">
                <div className={`feature-icon bg-gradient ${feature.accent}`}>
                  <feature.icon size={22} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="flow-section">
          <div className="section-heading center">
            <span className="eyebrow muted">How it works</span>
            <h2>Simple steps, better learning.</h2>
          </div>

          <div className="step-grid">
            {steps.map((step) => (
              <div key={step.number} className="step-card glass-card">
                <div className="step-badge">0{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-card">
            <div>
              <span className="eyebrow light">Ready to explore?</span>
              <h2>Bring your library into the future.</h2>
            </div>

            <div className="cta-actions">
              <Link to="/register" className="btn btn-light btn-lg">
                Register as Student
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="btn btn-ghost-light btn-lg">
                Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand-wrap footer-brand">
              <span className="brand-mark">L</span>
              <span>LibraLearn</span>
            </Link>
            <p>Your smarter digital library companion for Good Shepherded Academy.</p>
          </div>

          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to="/search">Search Library</Link></li>
              <li><Link to="/recommendations">Recommendations</Link></li>
              <li><Link to="/online-search">Online Search</Link></li>
            </ul>
          </div>

          <div>
            <h4>Library</h4>
            <ul>
              <li><Link to="/librarian/dashboard">Dashboard</Link></li>
              <li><Link to="/librarian/books">Manage Books</Link></li>
              <li><Link to="/librarian/reports">Reports</Link></li>
            </ul>
          </div>

          <div>
            <h4>Contact</h4>
            <ul>
              <li>Good Shepherded Academy</li>
              <li>library@gsa.edu</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2025 LibraLearn. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
