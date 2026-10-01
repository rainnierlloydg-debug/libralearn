import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, Mail, Lock, User, ChevronRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const GRADE_LEVELS = [
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
  'Grade 11 - STEM', 'Grade 11 - ABM', 'Grade 11 - HUMSS', 'Grade 11 - GAS',
  'Grade 12 - STEM', 'Grade 12 - ABM', 'Grade 12 - HUMSS', 'Grade 12 - GAS',
];

const SECTIONS = [
  'St. Joseph', 'St. Mary', 'St. Peter', 'St. Paul',
  'St. John', 'St. Matthew', 'St. Mark', 'St. Luke',
  'STEM-A', 'STEM-B', 'ABM-A', 'ABM-B', 'HUMSS-A', 'HUMSS-B', 'GAS-A', 'GAS-B',
];

const INTERESTS = [
  // Genres
  { id: 'genre-fiction', name: 'Fiction', type: 'genre' },
  { id: 'genre-fantasy', name: 'Fantasy', type: 'genre' },
  { id: 'genre-sci-fi', name: 'Science Fiction', type: 'genre' },
  { id: 'genre-mystery', name: 'Mystery', type: 'genre' },
  { id: 'genre-romance', name: 'Romance', type: 'genre' },
  { id: 'genre-adventure', name: 'Adventure', type: 'genre' },
  { id: 'genre-horror', name: 'Horror', type: 'genre' },
  { id: 'genre-thriller', name: 'Thriller', type: 'genre' },
  { id: 'genre-biography', name: 'Biography', type: 'genre' },
  { id: 'genre-poetry', name: 'Poetry', type: 'genre' },
  { id: 'genre-historical', name: 'Historical Fiction', type: 'genre' },
  { id: 'genre-graphic', name: 'Graphic Novels', type: 'genre' },
  { id: 'genre-ya', name: 'Young Adult', type: 'genre' },
  { id: 'genre-dystopian', name: 'Dystopian', type: 'genre' },
  // Subjects
  { id: 'subject-math', name: 'Mathematics', type: 'subject' },
  { id: 'subject-science', name: 'Science', type: 'subject' },
  { id: 'subject-english', name: 'English', type: 'subject' },
  { id: 'subject-filipino', name: 'Filipino', type: 'subject' },
  { id: 'subject-history', name: 'History', type: 'subject' },
  { id: 'subject-social', name: 'Social Studies', type: 'subject' },
  { id: 'subject-tech', name: 'Technology', type: 'subject' },
  { id: 'subject-arts', name: 'Arts', type: 'subject' },
  { id: 'subject-pe', name: 'Physical Education', type: 'subject' },
  { id: 'subject-values', name: 'Values Education', type: 'subject' },
];

function RegisterPage() {
  const { register } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    school_id: '',
    email: '',
    password: '',
    confirmPassword: '',
    grade_level: '',
    section: '',
    interests: [],
    profile_image: '',
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const steps = [
    { number: 1, title: 'Account', desc: 'Basic information' },
    { number: 2, title: 'Student Info', desc: 'Grade and section' },
    { number: 3, title: 'Interests', desc: 'Reading preferences' },
  ];

  const validateStep = (currentStep) => {
    const newErrors = {};
    if (currentStep === 1) {
      if (!formData.name.trim()) newErrors.name = 'Full name is required';
      if (!formData.school_id.trim()) newErrors.school_id = 'School ID is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    } else if (currentStep === 2) {
      if (!formData.grade_level) newErrors.grade_level = 'Grade level is required';
      if (!formData.section) newErrors.section = 'Section is required';
    } else if (currentStep === 3) {
      if (formData.interests.length < 3) newErrors.interests = 'Please select at least 3 interests';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'interests') {
      if (checked) {
        setFormData((prev) => ({
          ...prev,
          interests: [...prev.interests, value],
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          interests: prev.interests.filter((id) => id !== value),
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      const result = await register({
        name: formData.name,
        school_id: formData.school_id,
        email: formData.email,
        password: formData.password,
        grade_level: formData.grade_level,
        section: formData.section,
        interests: formData.interests,
        profile_image: formData.profile_image,
      });
      if (result.success) {
        success('Registration successful! Welcome to LibraLearn!');
        navigate('/dashboard');
      } else {
        error(result.message || 'Registration failed');
        if (result.errors) {
          setErrors(result.errors);
        }
      }
    } catch (err) {
      error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    const { password } = formData;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="register-fields">
            <Input
              label="Full Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="Enter your full name"
              autoComplete="name"
              leftIcon={<User className="w-5 h-5" />}
            />
            <Input
              label="School ID"
              name="school_id"
              type="text"
              value={formData.school_id}
              onChange={handleChange}
              error={errors.school_id}
              placeholder="e.g., 2024-0001"
              autoComplete="username"
              leftIcon={<User className="w-5 h-5" />}
            />
            <Input
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="student@gsa.edu"
              autoComplete="email"
              leftIcon={<Mail className="w-5 h-5" />}
            />
            <div className="relative">
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                leftIcon={<Lock className="w-5 h-5" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="register-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="Confirm your password"
              autoComplete="new-password"
              leftIcon={<Lock className="w-5 h-5" />}
            />
            {formData.password && (
              <div>
                <div className="flex gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded transition-colors ${
                        i < getPasswordStrength() ? 'bg-primary-500' : 'bg-(--border)'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-(--text-faint)">
                  {['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][getPasswordStrength() - 1] || 'Very weak'}
                </p>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="register-fields">
            <label className="register-select-field">
              <span>Grade level</span>
              <select
                name="grade_level"
                value={formData.grade_level}
                onChange={handleChange}
                className={`register-select ${errors.grade_level ? 'has-error' : ''}`}
                aria-invalid={errors.grade_level ? 'true' : 'false'}
              >
                <option value="" disabled>Select your grade level</option>
                {GRADE_LEVELS.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
              {errors.grade_level && <span className="register-field-error">{errors.grade_level}</span>}
            </label>

            <label className="register-select-field">
              <span>Section</span>
              <select
                name="section"
                value={formData.section}
                onChange={handleChange}
                className={`register-select ${errors.section ? 'has-error' : ''}`}
                aria-invalid={errors.section ? 'true' : 'false'}
              >
                <option value="" disabled>Select your section</option>
                {SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
              {errors.section && <span className="register-field-error">{errors.section}</span>}
            </label>
          </div>
        );
      case 3:
        return (
          <div className="register-fields">
            <p className="register-interest-intro">
              Select at least 3 genres and subjects you enjoy reading. This helps us recommend books you'll love!
            </p>
            {errors.interests && (
              <p className="register-field-error">{errors.interests}</p>
            )}

            <div>
              <h4 className="register-group-title">Genres</h4>
              <div className="register-interest-list">
                {INTERESTS.filter(i => i.type === 'genre').map((interest) => (
                  <label
                    key={interest.id}
                    className={`register-interest ${
                      formData.interests.includes(interest.id)
                        ? 'is-selected'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="interests"
                      value={interest.id}
                      checked={formData.interests.includes(interest.id)}
                      onChange={handleChange}
                      className="register-interest-check"
                    />
                    <span>{interest.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="register-group-title">Academic Subjects</h4>
              <div className="register-interest-list">
                {INTERESTS.filter(i => i.type === 'subject').map((interest) => (
                  <label
                    key={interest.id}
                    className={`register-interest register-interest-subject ${
                      formData.interests.includes(interest.id)
                        ? 'is-selected'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="interests"
                      value={interest.id}
                      checked={formData.interests.includes(interest.id)}
                      onChange={handleChange}
                      className="register-interest-check"
                    />
                    <span>{interest.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="register-interest-count">
              Selected: <strong>{formData.interests.length}</strong> interests
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="register-page">
      <section className="register-panel" aria-label="Student registration">
        <aside className="register-rail">
          <Link to="/" className="register-brand">
            <span className="register-brand-icon"><BookOpen aria-hidden="true" /></span>
            <span>LibraLearn</span>
          </Link>
          <div className="register-rail-copy">
            <p className="register-eyebrow">GOOD SHEPHERDED ACADEMY</p>
            <h1>Your library, picked for you.</h1>
            <p>Create a student account to find books that fit your classes and interests.</p>
          </div>
          <nav className="register-steps" aria-label="Registration progress">
            {steps.map((s, i) => (
              <div
                key={s.number}
                className={`register-step ${i + 1 === step ? 'is-current' : ''} ${i + 1 < step ? 'is-complete' : ''}`}
                aria-current={i + 1 === step ? 'step' : undefined}
              >
                <span className="register-step-number">
                  {i + 1 < step ? <CheckCircle aria-hidden="true" /> : s.number}
                </span>
                <span className="register-step-copy">
                  <strong>{s.title}</strong>
                  <small>{s.desc}</small>
                </span>
              </div>
            ))}
          </nav>
          <p className="register-rail-note">A few details now. Better book discoveries later.</p>
        </aside>

        <div className="register-content">
          <div className="register-mobile-brand">
            <Link to="/" className="register-brand">
              <span className="register-brand-icon"><BookOpen aria-hidden="true" /></span>
              <span>LibraLearn</span>
            </Link>
            <span>Student registration</span>
          </div>

          <div className="register-heading">
            <span className="register-step-caption">STEP {step} OF {steps.length}</span>
            <h2>{step === 1 ? 'Create your account' : step === 2 ? 'Your student details' : 'What do you like to read?'}</h2>
            <p>{step === 1 ? 'Start with your school account information.' : step === 2 ? 'Tell us where you are in school.' : 'Choose at least three interests for better recommendations.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            {renderStepContent()}

            <div className={`register-actions ${step === 1 ? 'is-first-step' : ''}`}>
              {step > 1 && (
                <Button type="button" variant="secondary" onClick={handleBack}>
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button type="submit" className="w-full md:w-auto" size="lg" loading={loading}>
                  Create Account
                </Button>
              )}
            </div>
          </form>
          <p className="register-login-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default RegisterPage;
