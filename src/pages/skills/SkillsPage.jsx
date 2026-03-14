import { useState, useEffect } from 'react';
import { operatorApi } from '../../api/operatorApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getErrorMessage } from '../../utils/helpers';
import { Wrench, Plus, X, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SkillsPage() {
  const [loading, setLoading] = useState(true);
  const [mySkills, setMySkills] = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [editing, setEditing] = useState(false);
  const [operatorName, setOperatorName] = useState('');
  const [skillSet, setSkillSet] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSkills = async () => {
    try {
      const [myRes, allRes] = await Promise.allSettled([
        operatorApi.getMySkills(),
        operatorApi.getAllSkills(),
      ]);
      if (myRes.status === 'fulfilled') {
        const data = myRes.value.data.data || myRes.value.data;
        setMySkills(data);
        setOperatorName(data?.operator_name || '');
        setSkillSet(data?.skill_set || []);
      }
      if (allRes.status === 'fulfilled') {
        const data = allRes.value.data.data || allRes.value.data || [];
        setAllSkills(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      // Skills might not be set yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const addSkill = () => {
    if (newSkill.trim() && !skillSet.includes(newSkill.trim())) {
      setSkillSet((prev) => [...prev, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => {
    setSkillSet((prev) => prev.filter((s) => s !== skill));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const handleSave = async () => {
    if (!operatorName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (skillSet.length === 0) {
      toast.error('Please add at least one skill');
      return;
    }

    setSaving(true);
    try {
      await operatorApi.updateSkills({
        operator_name: operatorName,
        skill_set: skillSet,
      });
      toast.success('Skills updated successfully!');
      setEditing(false);
      fetchSkills();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading skills..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Skills</h1>
          <p className="page-subtitle">Manage your skill set and view team skills</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={fetchSkills}>
            <RefreshCw size={16} /> Refresh
          </button>
          {!editing && (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              <Wrench size={16} /> {mySkills ? 'Edit Skills' : 'Add Skills'}
            </button>
          )}
        </div>
      </div>

      {/* My Skills Card */}
      <div className="card mb-6">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>
          {editing ? 'Edit Your Skills' : 'Your Skills'}
        </h2>

        {editing ? (
          <div>
            <div className="form-group">
              <label htmlFor="skill-name">Your Name</label>
              <input
                id="skill-name"
                type="text"
                placeholder="Enter your name"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Skills</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <input
                  type="text"
                  placeholder="Type a skill and press Enter"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" type="button" onClick={addSkill}>
                  <Plus size={16} /> Add
                </button>
              </div>

              <div className="tags-container">
                {skillSet.map((skill) => (
                  <span key={skill} className="tag">
                    {skill}
                    <button className="tag-remove" onClick={() => removeSkill(skill)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {skillSet.length === 0 && (
                <p className="form-hint">No skills added yet. Type a skill and press Enter or click Add.</p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Skills'}
              </button>
              <button className="btn btn-secondary" onClick={() => {
                setEditing(false);
                setOperatorName(mySkills?.operator_name || '');
                setSkillSet(mySkills?.skill_set || []);
              }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {mySkills ? (
              <div>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Name: </span>
                  <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {mySkills.operator_name}
                  </span>
                </div>
                <div className="tags-container">
                  {(mySkills.skill_set || []).map((skill) => (
                    <span key={skill} className="tag">{skill}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <Wrench size={40} className="empty-state-icon" />
                <h3 className="empty-state-title">No skills set yet</h3>
                <p className="empty-state-text">Click "Add Skills" to define your skill set.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* All Operators' Skills */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>Team Skills</h2>
        {allSkills.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No team skill data available.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {allSkills.map((op, idx) => (
              <div key={idx} style={{
                padding: 'var(--space-4)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--color-accent-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                  }}>
                    {(op.operator_name || 'O')[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {op.operator_name}
                  </span>
                </div>
                <div className="tags-container">
                  {(op.skill_set || []).map((skill) => (
                    <span key={skill} className="tag">{skill}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
