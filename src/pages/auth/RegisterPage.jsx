import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, UserRound, Cpu, UserPlus, LogIn } from 'lucide-react';
import { authApi } from '../../api/authApi';
import './AuthPages.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [routeHint, setRouteHint] = useState(null);

  const clearError = () => setError('');
  const isValidOtp = (value) => /^\d{6}$/.test(value);

  useEffect(() => {
    const st = location.state;
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('email');
    if (st?.prefillEmail) setEmail(st.prefillEmail);
    else if (fromQuery) setEmail(decodeURIComponent(fromQuery));
    if (st?.authHint) setRouteHint(st.authHint);
  }, [location.state, location.search]);

  const goToLogin = (prefill) => {
    navigate('/login', {
      replace: true,
      state: { prefillEmail: prefill || email.trim(), authHint: 'already_registered' },
    });
  };

  const handleSendOtp = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }

    setSendingOtp(true);
    setError('');
    try {
      await authApi.requestRegisterOtp({ name: trimmedName, email: trimmedEmail });
      setOtpSent(true);
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (status === 409) {
        setError(
          msg || 'This email is already registered. Use Sign in below — no need to register again.'
        );
      } else {
        setError(msg || 'Failed to send OTP');
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();
    if (!trimmedName) return setError('Name is required');
    if (!trimmedEmail) return setError('Email is required');
    if (!isValidOtp(trimmedOtp)) return setError('OTP must be a 6-digit number');

    setLoading(true);
    try {
      const result = await register({
        name: trimmedName,
        email: trimmedEmail,
        otp: trimmedOtp,
      });

      if (result.success) {
        navigate('/', { replace: true });
        return;
      }
      if (result.statusCode === 409) {
        setError(
          result.message || 'This email is already in use. Sign in with your existing account.'
        );
        return;
      }
      setError(result.message || 'Registration failed');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showAlreadyRegisteredCta = /already registered|already in use|sign in/i.test(error);

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

          {routeHint === 'no_account' && (
            <div className="auth-hint-banner" role="status">
              No operator account exists for this email yet. Create your account below, then you will be signed in
              automatically.
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="reg-name">Name</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <UserRound size={18} />
                </span>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError();
                  }}
                  autoFocus
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                    setRouteHint(null);
                  }}
                  autoComplete="email"
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={handleSendOtp}
              disabled={sendingOtp}
            >
              {sendingOtp ? 'Sending OTP...' : otpSent ? 'Resend OTP' : 'Send OTP'}
            </button>

            <div className="form-group">
              <label htmlFor="reg-otp">OTP</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <Mail size={18} />
                </span>
                <input
                  id="reg-otp"
                  type="text"
                  placeholder="Enter OTP from email"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    clearError();
                  }}
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            {error && (
              <div className="auth-error-wrap">
                <div className="auth-error">{error}</div>
                {showAlreadyRegisteredCta && (
                  <div className="auth-action-row">
                    <button type="button" className="btn btn-primary btn-full" onClick={() => goToLogin()}>
                      <LogIn size={16} />
                      Sign in instead
                    </button>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner spinner-sm" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Create account &amp; sign in</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" state={{ prefillEmail: email.trim() || undefined }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
