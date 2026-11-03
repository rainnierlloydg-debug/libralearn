import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

function LoginPage() {
  const { login } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;
  const isStaffLogin = location.pathname === '/librarian/login';

  const [formData, setFormData] = useState({
    login: '',
    password: '',
    remember: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.login.trim()) newErrors.login = 'Email or School ID is required';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await login({ login: formData.login.trim(), password: formData.password, remember: formData.remember }, isStaffLogin ? 'librarian' : 'student');
      if (result.success) {
        const isLibrarian = ['librarian', 'admin'].includes(result.user?.role);
        const defaultDestination = isLibrarian ? '/librarian/dashboard' : '/dashboard';
        const requestedDestinationIsAllowed = from && (isLibrarian
          ? from.startsWith('/librarian/')
          : !from.startsWith('/librarian/'));
        navigate(requestedDestinationIsAllowed ? from : defaultDestination, { replace: true });
      } else {
        error(result.message || 'Login failed');
        if (result.message?.includes('credentials')) {
          setErrors({ password: 'Invalid email/School ID or password' });
        } else {
          setErrors({ general: result.message || 'Unable to sign in. Please try again.' });
        }
      }
    } catch {
      error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout staff={isStaffLogin}>
      <div className="auth-login-content">
        <span className="auth-form-eyebrow">{isStaffLogin ? 'THE LIBRARY WORKSPACE' : 'YOUR NEXT CHAPTER AWAITS'}</span>
        <h1 className="auth-form-title">{isStaffLogin ? 'Hello, librarian.' : 'Welcome back.'}</h1>
        <p className="auth-form-description">{isStaffLogin ? 'Sign in to your staff account to get started.' : 'A good book is waiting. Let’s get you signed in.'}</p>
        <div className="auth-portal-tabs" role="group" aria-label="Choose your sign-in portal">
          <Link to="/login" aria-current={!isStaffLogin ? 'page' : undefined}>Student</Link>
          <Link to="/librarian/login" aria-current={isStaffLogin ? 'page' : undefined}>Librarian / Admin</Link>
        </div>
          <form onSubmit={handleSubmit} className="login-form">
            {errors.general && <p className="login-recovery-help" role="alert">{errors.general}</p>}
            <div className="field-block">
              <label htmlFor="login-identifier" className="login-field-label">Email or School ID</label>
              <input
                id="login-identifier"
                type="text"
                name="login"
                value={formData.login}
                onChange={handleChange}
                placeholder="Enter your email or School ID"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(errors.login)}
                aria-describedby={errors.login ? 'login-identifier-error' : undefined}
                className={errors.login ? 'login-input error' : 'login-input'}
              />
              {errors.login && <span id="login-identifier-error" className="field-error" role="alert">{errors.login}</span>}
            </div>

            <div className="field-block">
              <label htmlFor="login-password" className="login-field-label">Password</label>
              <div className="password-box">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  className={errors.password ? 'login-input error' : 'login-input'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span id="login-password-error" className="field-error" role="alert">{errors.password}</span>}
            </div>

            <div className="login-meta">
              <label className="remember-me">
                <input
                  type="checkbox"
                  name="remember"
                  checked={formData.remember}
                  onChange={handleChange}
                />
                <span>Remember me</span>
              </label>

              <button type="button" className="forgot-link" aria-expanded={showRecoveryHelp} aria-controls="login-recovery-help" onClick={() => setShowRecoveryHelp(!showRecoveryHelp)}>
                Forgot password?
              </button>
            </div>
            {showRecoveryHelp && <p id="login-recovery-help" className="login-recovery-help" role="status">Contact your librarian for help resetting your password. Have your School ID ready.</p>}

            <button type="submit" className="login-submit" disabled={loading} aria-busy={loading}>
              {loading && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {!isStaffLogin && <div className="register-links">
            <p>New to LibraLearn?</p><Link to="/register" className="login-register-button">Create a student account</Link>
          </div>}
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
