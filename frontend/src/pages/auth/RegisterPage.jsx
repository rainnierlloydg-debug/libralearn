import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../utils/api';

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
  const [interests, setInterests] = useState([]);
  const [interestsError, setInterestsError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/auth/registration-interests').then((response) => {
      if (active && response.data.success) {
        setInterests(response.data.data.map((interest) => ({ ...interest, id: interest.slug })));
      }
    }).catch(() => {
      if (active) setInterestsError('Interests could not load. You can still create your account and choose interests later.');
    });
    return () => { active = false; };
  }, []);

  const steps = [
    { number: 1, title: 'Account', desc: 'Basic information' },
    { number: 2, title: 'Student Info', desc: 'Optional grade and section' },
    { number: 3, title: 'Interests', desc: 'Optional preferences' },
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
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type: _type, checked } = e.target;
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
    if (loading) return;
    if (step < 3) {
      handleNext();
      return;
    }
    if (!validateStep(1)) {
      setStep(1);
      return;
    }

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
        success('Registration successful! Please log in to continue.');
        navigate('/login');
      } else {
        if (result.errors) {
          const fieldErrors = Object.fromEntries(Object.entries(result.errors).map(([field, messages]) => [
            field.split('.')[0], Array.isArray(messages) ? messages.join(' ') : messages,
          ]));
          setErrors(fieldErrors);
          if (['name', 'school_id', 'email', 'password'].some((field) => fieldErrors[field])) setStep(1);
          else if (fieldErrors.grade_level || fieldErrors.section) setStep(2);
          error(Object.values(fieldErrors)[0] || result.message || 'Registration failed');
        } else {
          error(result.message || 'Registration failed');
        }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'We could not create your account right now. Please try again.';
      setErrors({ general: message });
      error(message);
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
          <div className="register-fields auth-account-fields">
            <Input
              label="Full Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="Enter your full name"
              autoComplete="name"
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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="register-password-toggle" aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
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
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
          </div>
        );
      case 2:
        return (
          <div className="register-fields auth-student-fields">
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
              Select any genres or subjects you enjoy reading. This step is optional.
            </p>
            {errors.interests && (
              <p className="register-field-error">{errors.interests}</p>
            )}
            {interestsError && <p role="status">{interestsError}</p>}

            <div>
              <h4 className="register-group-title">Genres</h4>
              <div className="register-interest-list">
                {interests.filter(i => i.type === 'genre').map((interest) => (
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
                {interests.filter(i => i.type === 'subject').map((interest) => (
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
    <AuthLayout registration step={step} steps={steps}>
      <div className="auth-register-content">
        <ol className="auth-registration-progress" aria-label="Registration progress">
          {steps.map(item => <li key={item.number} data-current={step === item.number} data-complete={step > item.number} aria-current={step === item.number ? 'step' : undefined}>
            <span>{step > item.number ? <CheckCircle size={14} aria-hidden="true" /> : `0${item.number}`}</span>{item.title}
          </li>)}
        </ol>
        <div className="auth-registration-heading">
          <span className="auth-form-eyebrow">STEP {step} OF {steps.length}{step > 1 && ' · OPTIONAL'}</span>
          <h1 className="auth-form-title">{step === 1 ? 'Start your story.' : step === 2 ? 'Make it yours.' : 'Follow your curiosity.'}</h1>
          <p className="auth-form-description">{step === 1 ? 'Create your student account. Your next discovery starts here.' : step === 2 ? 'Add your grade and section, or leave them for later.' : 'Pick the genres and subjects you love. You can always change these later.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="register-form">
          {errors.general && <p role="alert" className="auth-form-error">{errors.general}</p>}
          {renderStepContent()}
          <div className={`register-actions ${step === 1 ? 'is-first-step' : ''}`}>
            {step > 1 && <Button type="button" variant="secondary" disabled={loading} onClick={handleBack}>Back</Button>}
            {step < 3 ? <Button type="submit">Continue</Button> : <Button type="submit" loading={loading}>Create My Account</Button>}
          </div>
        </form>
        <p className="register-login-link">Already part of the library? <Link to="/login">Sign in</Link></p>
      </div>
    </AuthLayout>
  );
}

export default RegisterPage;
