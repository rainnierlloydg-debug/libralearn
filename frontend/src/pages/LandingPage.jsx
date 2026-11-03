import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BrainCircuit, Clock3, Compass, MapPin, Search, Sparkles, Star, Check, Menu, X } from 'lucide-react';
import api from '../utils/api';
import './landing.css';

function LandingPage() {
  const [stats, setStats] = useState({
    total_books: '—',
    active_students: '—',
    total_borrowed: '—',
    genres_available: '—',
  });
  const [featuredBook, setFeaturedBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      const fetchStats = async () => {
        try {
          const response = await api.get('/landing/stats');
          if (response.data.success) {
            const data = response.data.data;
            setStats({
              total_books: data.total_books >= 1000 ? `${(data.total_books / 1000).toFixed(1)}k+` : data.total_books,
              active_students: data.active_students,
              total_borrowed: data.total_borrowed,
              genres_available: data.genres_available,
            });
          }
        } catch {
          // Leave counts unavailable rather than showing sample figures.
        } finally {
          setLoading(false);
        }
      };
      fetchStats();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      const fetchFeaturedBook = async () => {
        try {
          const response = await api.get('/landing/featured-book');
          if (response.data.success && response.data.data) {
            setFeaturedBook(response.data.data);
          }
        } catch {
          // Keep null on error
        }
      };
      fetchFeaturedBook();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    { icon: Search, title: 'Less searching. More finding.', description: 'Find a title, follow an author, or explore a subject. Check availability before you head to the shelves.', label: 'DISCOVER', to: '/search', action: 'Explore the catalog' },
    { icon: Star, title: 'A shelf that feels like you.', description: 'Turn your interests into your next great read with recommendations shaped around your curiosity.', label: 'PERSONALIZE', to: '/recommendations', action: 'Find your next read' },
    { icon: Clock3, title: 'Your reading, all together.', description: 'Keep track of borrowing requests, reservations, and due dates in one place.', label: 'STAY ORGANIZED', to: '/my-books', action: 'Open my books' },
    { icon: Compass, title: 'Go beyond the bookshelf.', description: 'Explore books from Open Library and Google Books, alongside your school collection.', label: 'EXPLORE', to: '/online-search', action: 'Search online' },
  ];
  const displayStats = [
    { value: stats.total_books, label: 'Books to discover' },
    { value: stats.active_students, label: 'Active students' },
    { value: stats.total_borrowed, label: 'Library loans' },
    { value: stats.genres_available, label: 'Genres to explore' },
  ];
  const brand = <><span className="ll-brand-icon"><BookOpen size={21} aria-hidden="true" /></span>LibraLearn<span className="ll-brand-dot">.</span></>;
  return (
    <div className="ll-home" data-theme="light">
      <header className="ll-header">
        <div className="ll-container ll-nav">
          <Link to="/" className="ll-brand" aria-label="LibraLearn home">{brand}</Link>
          <nav className="ll-desktop-nav" aria-label="Main navigation"><a href="#discover">Discover</a><a href="#how-it-works">How it works</a><Link to="/library-map">Library map</Link></nav>
          <div className="ll-nav-actions"><Link to="/login" className="ll-sign-in">Sign in</Link><Link to="/register" className="ll-button ll-button-small">Get started</Link><button type="button" className="ll-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="ll-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
        </div>
        {menuOpen && <nav id="ll-mobile-nav" className="ll-mobile-nav" aria-label="Mobile navigation">{[['/search', 'Browse the library'], ['/recommendations', 'Recommendations'], ['/library-map', 'Library map'], ['/login', 'Student sign in'], ['/librarian/login', 'Librarian sign in']].map(([to, label]) => <Link key={to} to={to} onClick={() => setMenuOpen(false)}>{label}</Link>)}</nav>}
      </header>
      <main>
        <section className="ll-container ll-hero" aria-labelledby="ll-hero-title">
          <div className="ll-hero-copy">
            <span className="ll-eyebrow"><span className="ll-status-dot" />GOOD SHEPHERDED ACADEMY LIBRARY</span>
            <h1 id="ll-hero-title">Big ideas.<br />New worlds.<br /><em>Your next chapter.</em></h1>
            <p>A little curiosity can take you a long way. Find your next favorite book, follow your interests, and make discovery part of your day.</p>
            <div className="ll-hero-actions"><Link to="/search" className="ll-button"><Search size={18} aria-hidden="true" />Explore the library</Link><Link to="/register" className="ll-button ll-button-outline">Create an account</Link></div>
            <div className="ll-hero-note"><span><Check size={13} aria-hidden="true" /></span>Your school library, a little closer.</div>
          </div>
          <div className="ll-hero-art">
            <div className="ll-art-heading"><span>THE CURIOSITY COLLECTION</span><Sparkles size={19} aria-hidden="true" /></div>
            <div className="ll-orbit" aria-hidden="true" />
            <div className="ll-art-caption" aria-hidden="true">A world of possibility,<br />one page at a time.</div>
            <div className="ll-book ll-book-back" aria-hidden="true"><span>STAY CURIOUS</span><strong>Ideas<br />worth<br />exploring.</strong></div>
            <div className="ll-book ll-book-front" aria-hidden="true"><span>THE LIBRALEARN EDITION</span><BookOpen size={30} /><strong>Between<br />the pages,<br /><em>anything<br />is possible.</em></strong><div className="ll-cover-sun" /><small>FOR EVERY CURIOUS MIND</small></div>
            <span className="ll-floating-note"><Sparkles size={16} aria-hidden="true" />A new perspective awaits</span>
            <div className="ll-art-footer"><span>READ. WONDER. REPEAT.</span><span>VOL. 01</span></div>
          </div>
        </section>
        <section className="ll-container ll-stats" aria-label="Library statistics" aria-busy={loading}>{displayStats.map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</section>
        <section id="discover" className="ll-container ll-discover">
          <div className="ll-section-heading"><div><span className="ll-eyebrow">A LIBRARY BUILT AROUND YOU</span><h2>More than books.<br /><em>A place to begin.</em></h2></div><p>From the first search to the last page, everything you need for a better reading journey.</p></div>
          <div className="ll-feature-grid">{features.map(({ icon: Icon, ...feature }, index) => <article className="ll-feature" key={feature.title}><div className="ll-feature-top"><span className="ll-feature-icon"><Icon size={22} aria-hidden="true" /></span><span>0{index + 1} / {feature.label}</span></div><h3>{feature.title}</h3><p>{feature.description}</p><Link to={feature.to} className="ll-feature-link">{feature.action}</Link></article>)}</div>
        </section>
        <section className="ll-container ll-spotlight" aria-labelledby="ll-spotlight-title">
          <div className="ll-spotlight-art" aria-hidden="true"><span>OFF THE SHELF</span><div className="ll-featured-cover"><BookOpen size={30} /><strong>A good book.<br /><em>A new beginning.</em></strong><div className="ll-cover-line" /><small>DISCOVER SOMETHING DIFFERENT</small></div><span className="ll-spotlight-spark">✳</span></div>
          <div className="ll-spotlight-copy"><span className="ll-eyebrow">{featuredBook ? 'FROM OUR COLLECTION' : 'MAKE ROOM FOR DISCOVERY'}</span><h2 id="ll-spotlight-title">{featuredBook ? featuredBook.title : 'Your next favorite is waiting.'}</h2>{featuredBook && <p className="ll-featured-author">by {featuredBook.author}</p>}<p>{featuredBook ? 'Every book opens a different door. Take a closer look at this title from your school library and see where it takes you.' : 'Start with a familiar subject or try something completely new. There is always another perspective waiting on the shelf.'}</p>{featuredBook?.genre && <span className="ll-genre">{featuredBook.genre}</span>}<Link to={featuredBook ? `/books/${featuredBook.id}` : '/search'} className="ll-button ll-button-outline">{featuredBook ? 'Explore this book' : 'Browse the collection'}</Link></div>
        </section>
        <section id="how-it-works" className="ll-container ll-how">
          <div className="ll-section-heading"><div><span className="ll-eyebrow">FROM CURIOUS TO CAPTIVATED</span><h2>A good read is<br /><em>three steps away.</em></h2></div><Link to="/register" className="ll-button ll-button-outline">Start your reading journey</Link></div>
          <ol className="ll-steps">{[['Find your spark', 'Browse the collection or let your interests lead you to something unexpected.'], ['Make it your next read', 'Check the details and availability, then send a borrowing request.'], ['Pick up. Dive in.', 'Follow your request in My Books. Once approved, collect your book from the library.']].map(([title, description], index) => <li key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
        </section>
        <section className="ll-container ll-library-tools"><div><BrainCircuit size={24} aria-hidden="true" /><div><h3>A little smarter behind the scenes.</h3><p>AI-assisted cataloging helps library staff turn book covers into searchable records.</p></div></div><Link to="/librarian/login" className="ll-button ll-button-outline">Librarian sign in</Link></section>
        <section className="ll-container ll-invitation"><span className="ll-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>Stay curious.<br /><em>Keep turning pages.</em></h2><p>Your library is full of possibilities. Make one of them yours.</p><div><Link to="/register" className="ll-button ll-button-lime">Join your library</Link><Link to="/search" className="ll-button ll-button-light-outline">Browse books</Link></div><BookOpen className="ll-invitation-art" size={260} strokeWidth={0.7} aria-hidden="true" /></section>
      </main>
      <footer className="ll-container ll-footer"><div className="ll-footer-top"><div><Link to="/" className="ll-brand">{brand}</Link><p>A little curiosity. A world of possibility.<br />Good Shepherded Academy Library.</p></div><nav aria-label="Explore the library"><h3>Explore</h3><Link to="/search">Book collection</Link><Link to="/recommendations">Recommended reads</Link><Link to="/online-search">Online discovery</Link></nav><nav aria-label="Library access"><h3>Your library</h3><Link to="/library-map"><MapPin size={13} aria-hidden="true" />Library map</Link><Link to="/login">Student sign in</Link><Link to="/librarian/login">Librarian sign in</Link></nav></div><div className="ll-footer-bottom"><span>© {currentYear} LibraLearn. All rights reserved.</span><span>Made for curious minds.</span></div></footer>
    </div>
  );
}

export default LandingPage;
