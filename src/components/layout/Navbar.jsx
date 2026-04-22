import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { machineApi } from '../../api/machineApi';
import { getInitials, getErrorMessage } from '../../utils/helpers';
import {
  Menu, LogOut, Wifi, WifiOff, User, Sun, Moon, ChevronDown,
  Settings, X, Upload, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Navbar.css';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="navbar-left">
          <button className="btn btn-ghost btn-icon navbar-menu-btn" onClick={onMenuClick}>
            <Menu size={20} />
          </button>
          <div className="navbar-breadcrumb">
            <span className="navbar-greeting">
              Welcome back, <strong>{user?.username || user?.operator_name || 'Operator'}</strong>
            </span>
          </div>
        </div>

        <div className="navbar-right">
          <div className={`navbar-status ${connected ? 'navbar-status-online' : 'navbar-status-offline'}`}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>

          {/* Configure Button */}
          <button
            className="btn btn-secondary btn-sm navbar-configure-btn"
            onClick={() => setShowConfigModal(true)}
            title="Configure Machine"
          >
            <Settings size={16} />
            <span className="navbar-configure-text">Configure</span>
          </button>

          <div className="navbar-divider" />

          {/* Profile Dropdown */}
          <div className="navbar-profile-dropdown" ref={dropdownRef}>
            <button
              className="navbar-profile-trigger"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              id="profile-trigger"
            >
              <div className="navbar-avatar">
                {getInitials(user?.username || user?.operator_name)}
              </div>
              <div className="navbar-user-info">
                <span className="navbar-user-name">{user?.username || user?.operator_name || 'Operator'}</span>
                <span className="navbar-user-role">{user?.email || 'Operator'}</span>
              </div>
              <ChevronDown size={14} className={`navbar-chevron ${dropdownOpen ? 'navbar-chevron-open' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="navbar-dropdown" id="profile-dropdown">
                <div className="navbar-dropdown-header">
                  <div className="navbar-dropdown-avatar">
                    {getInitials(user?.username || user?.operator_name)}
                  </div>
                  <div className="navbar-dropdown-user">
                    <span className="navbar-dropdown-name">{user?.full_name || user?.username || user?.operator_name || 'Operator'}</span>
                    <span className="navbar-dropdown-email">{user?.email || 'operator@company.com'}</span>
                  </div>
                </div>

                <div className="navbar-dropdown-divider" />

                <button className="navbar-dropdown-item" onClick={() => { setDropdownOpen(false); setShowProfileModal(true); }}>
                  <User size={16} />
                  <span>Profile</span>
                </button>

                <button className="navbar-dropdown-item" onClick={() => { toggleTheme(); }}>
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  <div className="navbar-theme-toggle">
                    <div className={`navbar-theme-toggle-track ${theme === 'light' ? 'navbar-theme-toggle-active' : ''}`}>
                      <div className="navbar-theme-toggle-thumb" />
                    </div>
                  </div>
                </button>

                <div className="navbar-dropdown-divider" />

                <button className="navbar-dropdown-item navbar-dropdown-item-danger" onClick={() => { setDropdownOpen(false); logout(); }}>
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Configure Machine Modal */}
      {showConfigModal && (
        <ConfigureMachineModal onClose={() => setShowConfigModal(false)} />
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </>
  );
}

// Profile Modal Component
function ProfileModal({ onClose }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth(); // Fallback data while fetching

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const authApiModule = await import('../../api/authApi').then(m => m.authApi);
        const res = await authApiModule.getProfile();
        const data = res.data?.data?.user || res.data?.data || res.data;
        setProfileData(data);
      } catch (err) {
        setError('Failed to fetch latest profile details.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const displayUser = profileData || user;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-primary)',
            }}>
              <User size={20} />
            </div>
            <h3 className="modal-title">My Profile</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 'var(--space-4)' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
              <div className="spinner spinner-md"></div>
            </div>
          ) : error && !displayUser ? (
            <div className="alert alert-danger">{error}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {getInitials(displayUser?.username || displayUser?.operator_name || 'U')}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--color-text-primary)' }}>{displayUser?.username || displayUser?.operator_name}</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{displayUser?.email}</p>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Role</span>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 500, color: 'var(--color-text-primary)' }}>{displayUser?.role || 'Operator'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>User Type</span>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 500, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{displayUser?.userType || displayUser?.user_type || 'operator'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>User ID</span>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 500, color: 'var(--color-text-primary)' }}>#{displayUser?.id || displayUser?.operator_id}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Configure Machine Modal Component
function ConfigureMachineModal({ onClose }) {
  const [formData, setFormData] = useState({
    machine_name: '',
    ingest_path: '',
    machine_image: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, machine_image: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_name || !formData.ingest_path) {
      toast.error('Please fill in machine name and ingest path');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('machine_name', formData.machine_name);
      
      // Ensure ingest_path always starts with an internal '/'
      let finalPath = formData.ingest_path.trim();
      if (!finalPath.startsWith('/')) {
        finalPath = '/' + finalPath;
      }
      fd.append('ingest_path', finalPath);
      if (formData.machine_image) {
        fd.append('machine_image', formData.machine_image);
      }

      await machineApi.createMachine(fd);
      toast.success('Machine created successfully!');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-primary)',
            }}>
              <Settings size={20} />
            </div>
            <h3 className="modal-title">Configure New Machine</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="config-machine-name">Machine Name *</label>
            <input
              id="config-machine-name"
              type="text"
              placeholder="e.g., CNC Lathe Machine 1"
              value={formData.machine_name}
              onChange={(e) => setFormData((p) => ({ ...p, machine_name: e.target.value }))}
              required
            />
            <span className="form-hint">Give a descriptive name for this machine</span>
          </div>

          <div className="form-group">
            <label htmlFor="config-ingest-path">Ingest Path *</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', paddingLeft: 'var(--space-3)' }}>
              <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>/</span>
              <input
                id="config-ingest-path"
                type="text"
                placeholder="cnc-lathe-1"
                value={formData.ingest_path.replace(/^\//, '')} // Cleanly display path without leading slash
                onChange={(e) => setFormData((p) => ({ ...p, ingest_path: e.target.value }))}
                required
                style={{ border: 'none', background: 'transparent', width: '100%', margin: 0, paddingLeft: 'var(--space-1)' }}
              />
            </div>
            <span className="form-hint">URL path for data ingestion (the '/' is added automatically)</span>
          </div>

          <div className="form-group">
            <label>Machine Image (Optional)</label>
            <div className="file-input-wrapper">
              <div className="file-input-label">
                <Upload size={18} />
                <span>{formData.machine_image ? formData.machine_image.name : 'Choose machine image'}</span>
              </div>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </div>
            {imagePreview && (
              <div style={{ marginTop: 'var(--space-3)', position: 'relative', display: 'inline-block' }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxWidth: '200px',
                    maxHeight: '150px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)' }}
                  onClick={() => { setFormData((p) => ({ ...p, machine_image: null })); setImagePreview(null); }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Plus size={16} />
              {submitting ? 'Creating...' : 'Create Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
