import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, Check } from 'lucide-react';
import './auth.css';

export default function AuthLayout({ children, registration = false, staff = false, step = 1, steps = [] }) {
  return (
    <main className="auth-experience">
      <div className={`auth-stage ${registration ? 'auth-stage-register' : ''}`}>
        <aside className="auth-story">
          <Link to="/" className="auth-brand"><span><BookOpen size={21} aria-hidden="true" /></span>LibraLearn<span className="auth-brand-period">.</span></Link>
          <div className="auth-story-copy">
            <p className="auth-eyebrow">GOOD SHEPHERDED ACADEMY</p>
            <h2>{staff ? <>More discovery.<br />Better connections.</> : registration ? <>Your next chapter<br />starts here.</> : <>A little curiosity.<br />A world of possibility.</>}</h2>
            <p>{staff ? 'Bring your library together. Manage the collection and help every student find their next read.' : 'Find a book that stays with you. Discover new perspectives, follow your interests, and make room for a little wonder.'}</p>
          </div>
          {registration ? (
            <ol className="auth-story-steps" aria-label="Registration steps">
              {steps.map(item => <li key={item.number} data-current={item.number === step} data-complete={item.number < step} aria-current={item.number === step ? 'step' : undefined}>
                <span>{item.number < step ? <Check size={16} aria-hidden="true" /> : `0${item.number}`}</span>
                <div><strong>{item.title}</strong><small>{item.desc}</small></div>
              </li>)}
            </ol>
          ) : (
            <div className="auth-book-scene" aria-hidden="true">
              <div className="auth-scene-orbit" />
              <div className="auth-book-spine auth-spine-one">CURIOSITY</div>
              <div className="auth-book-spine auth-spine-two">DISCOVERY</div>
              <div className="auth-art-book"><span>THE LIBRALEARN EXPERIENCE</span><BookOpen size={32} /><strong>Find your<br /><em>next idea.</em></strong><div className="auth-book-art-lines" /><small>A new perspective on every page.</small></div>
              <span className="auth-scene-note"><Sparkles size={15} />Made for curious minds</span>
            </div>
          )}
          <div className="auth-story-footer"><span className="auth-small-dot" />Your school. Your library. Your next chapter.</div>
        </aside>
        <section className="auth-form-pane" aria-label={registration ? 'Student registration' : staff ? 'Librarian sign in' : 'Student sign in'}>
          <div className="auth-form-topline">
            <Link to="/" className="auth-mobile-brand"><BookOpen size={20} aria-hidden="true" />LibraLearn.</Link>
            <span className="auth-access-label">{registration ? 'STUDENT REGISTRATION' : staff ? 'LIBRARY STAFF' : 'STUDENT ACCESS'}</span>
            <Link to="/" className="auth-home-link">Back to home</Link>
          </div>
          <div className="auth-form-body">{children}</div>
          <p className="auth-form-footnote">Good Shepherded Academy Library</p>
        </section>
      </div>
    </main>
  );
}
