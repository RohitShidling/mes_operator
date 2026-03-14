import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { operatorApi } from '../../api/operatorApi';
import { machineApi } from '../../api/machineApi';
import { workOrderApi } from '../../api/workOrderApi';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getErrorMessage, formatDateTime, calcPercentage } from '../../utils/helpers';
import {
  Monitor,
  ClipboardList,
  AlertOctagon,
  ShieldAlert,
  Wrench,
  Activity,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    machines: [],
    myMachines: [],
    workOrders: [],
    activeBreakdowns: [],
    rejections: [],
  });

  const fetchDashboardData = async () => {
    try {
      const [machinesRes, myMachinesRes, workOrdersRes, breakdownsRes, rejectionsRes] = await Promise.allSettled([
        machineApi.getAll(),
        operatorApi.getMyMachines(),
        workOrderApi.getAll(),
        operatorApi.getActiveBreakdowns(),
        operatorApi.getAllRejections(),
      ]);

      setStats({
        machines: machinesRes.status === 'fulfilled' ? (machinesRes.value.data.data || machinesRes.value.data || []) : [],
        myMachines: myMachinesRes.status === 'fulfilled' ? (myMachinesRes.value.data.data || myMachinesRes.value.data || []) : [],
        workOrders: workOrdersRes.status === 'fulfilled' ? (workOrdersRes.value.data.data || workOrdersRes.value.data || []) : [],
        activeBreakdowns: breakdownsRes.status === 'fulfilled' ? (breakdownsRes.value.data.data || breakdownsRes.value.data || []) : [],
        rejections: rejectionsRes.status === 'fulfilled' ? (rejectionsRes.value.data.data || rejectionsRes.value.data || []) : [],
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    const unsubs = [
      subscribe('machine:update', fetchDashboardData),
      subscribe('machine:status_changed', fetchDashboardData),
      subscribe('breakdown:reported', fetchDashboardData),
      subscribe('breakdown:updated', fetchDashboardData),
      subscribe('rejection:reported', fetchDashboardData),
    ];
    return () => unsubs.forEach((unsub) => unsub?.());
  }, [subscribe]);

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;

  const allMachines = Array.isArray(stats.machines) ? stats.machines : [];
  const runningMachines = allMachines.filter((m) => m.status === 'RUNNING');
  const maintenanceMachines = allMachines.filter((m) => m.status === 'MAINTENANCE');
  const allWorkOrders = Array.isArray(stats.workOrders) ? stats.workOrders : [];
  const activeBreakdowns = Array.isArray(stats.activeBreakdowns) ? stats.activeBreakdowns : [];
  const allRejections = Array.isArray(stats.rejections) ? stats.rejections : [];
  const myMachines = Array.isArray(stats.myMachines) ? stats.myMachines : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your operator activities</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="stat-grid">
        <div className="stat-card" onClick={() => navigate('/machines')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon stat-icon-blue">
            <Monitor size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Machines</span>
            <span className="stat-value">{allMachines.length}</span>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/machines')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon stat-icon-green">
            <Activity size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Running</span>
            <span className="stat-value">{runningMachines.length}</span>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/breakdowns')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon stat-icon-red">
            <ShieldAlert size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Active Breakdowns</span>
            <span className="stat-value">{activeBreakdowns.length}</span>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/work-orders')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon stat-icon-purple">
            <ClipboardList size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Work Orders</span>
            <span className="stat-value">{allWorkOrders.length}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* My Assigned Machines */}
        <div className="card dashboard-section">
          <div className="card-header">
            <h2 className="card-title">My Machines</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/assignments')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {myMachines.length === 0 ? (
            <div className="dashboard-empty">
              <Monitor size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              <p>No machines assigned yet</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {myMachines.slice(0, 5).map((machine, idx) => (
                <div key={machine.machine_id || idx} className="dashboard-list-item" onClick={() => navigate(`/machines/${machine.machine_id}`)}>
                  <div className="dashboard-list-info">
                    <span className="dashboard-list-name">{machine.machine_name}</span>
                    <span className="dashboard-list-id">{machine.machine_id}</span>
                  </div>
                  <StatusBadge status={machine.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Breakdowns */}
        <div className="card dashboard-section">
          <div className="card-header">
            <h2 className="card-title">Active Breakdowns</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/breakdowns')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {activeBreakdowns.length === 0 ? (
            <div className="dashboard-empty">
              <ShieldAlert size={32} style={{ color: 'var(--color-success)', opacity: 0.5 }} />
              <p style={{ color: 'var(--color-success)' }}>No active breakdowns</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {activeBreakdowns.slice(0, 5).map((bd, idx) => (
                <div key={bd.id || idx} className="dashboard-list-item">
                  <div className="dashboard-list-info">
                    <span className="dashboard-list-name">{bd.machine_name || bd.machine_id}</span>
                    <span className="dashboard-list-id">{bd.problem_description?.substring(0, 60)}...</span>
                  </div>
                  <StatusBadge status={bd.severity || bd.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Work Orders */}
        <div className="card dashboard-section">
          <div className="card-header">
            <h2 className="card-title">Work Orders</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/work-orders')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {allWorkOrders.length === 0 ? (
            <div className="dashboard-empty">
              <ClipboardList size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              <p>No work orders available</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {allWorkOrders.slice(0, 5).map((wo, idx) => (
                <div key={wo.work_order_id || idx} className="dashboard-list-item" onClick={() => navigate(`/work-orders/${wo.work_order_id}`)}>
                  <div className="dashboard-list-info">
                    <span className="dashboard-list-name">{wo.work_order_name}</span>
                    <span className="dashboard-list-id">
                      Target: {wo.target} | Progress: {calcPercentage(wo.produced_count || 0, wo.target)}%
                    </span>
                  </div>
                  <StatusBadge status={wo.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Rejections */}
        <div className="card dashboard-section">
          <div className="card-header">
            <h2 className="card-title">Recent Rejections</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/rejections')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {allRejections.length === 0 ? (
            <div className="dashboard-empty">
              <AlertOctagon size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              <p>No rejections reported</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {allRejections.slice(0, 5).map((rej, idx) => (
                <div key={rej.id || idx} className="dashboard-list-item">
                  <div className="dashboard-list-info">
                    <span className="dashboard-list-name">{rej.rejection_reason?.substring(0, 50)}</span>
                    <span className="dashboard-list-id">
                      Machine: {rej.machine_id} | Count: {rej.rejected_count}
                    </span>
                  </div>
                  <span className="badge badge-danger">{rej.rejected_count} pcs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
