import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, User, Cpu, UserPlus } from 'lucide-react';
import './AuthPages.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clearError = () => setError('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');

    // JavaScript validation
    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedUsername) {
      setError('Username is required');
      return;
    }
    if (!trimmedFullName) {
      setError('Full name is required');
      return;
    }
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }
    if (!trimmedPassword) {
      setError('Password is required');
      return;
    }
    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        username: trimmedUsername,
        full_name: trimmedFullName,
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (result.success) {
        if (result.autoLoggedIn) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } else {
        setError(result.message || 'Registration failed');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-pattern" />
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="auth-logo-icon">
                <Cpu size={28} />
              </div>
            </div>
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Register as a new operator</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="reg-username">Username</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <User size={18} />
                </span>
                <input
                  id="reg-username"
                  type="text"
                  placeholder="Enter a username (e.g., operator1)"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearError(); }}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-fullname">Full Name</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <User size={18} />
                </span>
                <input
                  id="reg-fullname"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearError(); }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-email">Email Address</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <Mail size={18} />
                </span>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <Lock size={18} />
                </span>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password (min 6 chars)"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-confirm">Confirm Password</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <Lock size={18} />
                </span>
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner spinner-sm" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
