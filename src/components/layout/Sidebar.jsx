import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  ClipboardList,
  AlertOctagon,
  ShieldAlert,
  Wrench,
  Users,
  ChevronLeft,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/machines', icon: Monitor, label: 'Machine Checklist' },
  { path: '/work-orders', icon: ClipboardList, label: 'Work Orders' },
  { path: '/assignments', icon: Users, label: 'My Assignments' },
  { path: '/rejections', icon: AlertOctagon, label: 'Rejections' },
  { path: '/breakdowns', icon: ShieldAlert, label: 'Breakdowns' },
  { path: '/skills', icon: Wrench, label: 'My Skills' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, closeMobile }) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Cpu size={22} />
          </div>
          {!collapsed && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-title">MES</span>
              <span className="sidebar-logo-subtitle">Operator Panel</span>
            </div>
          )}
        </div>
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
            end={item.path === '/'}
            title={collapsed ? item.label : undefined}
            onClick={() => closeMobile && closeMobile()}
          >
            <item.icon size={20} className="sidebar-link-icon" />
            {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-version">
            <span>v1.0.0</span>
            <span>Operator Module</span>
          </div>
        )}
      </div>
    </aside>
  );
}
