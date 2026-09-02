import { useEffect, useState } from 'react';
import { FiDollarSign, FiSave } from 'react-icons/fi';
import api from '../../../services/api';
import { toDisplayName } from '../../../utils/contributionPlans';

export default function PlansSection() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    api.admin.getAdminPlans()
      .then((res) => {
        if (res?.success) setPlans(res.plans || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateField = (id, field, value) => {
    setPlans((current) => current.map((plan) => (
      plan.id === id ? { ...plan, [field]: value } : plan
    )));
  };

  const savePlan = async (plan) => {
    setSavingId(plan.id);
    try {
      const res = await api.admin.updateAdminPlan(plan.id, {
        price: plan.price,
        description: plan.description,
        is_active: plan.is_active,
      });
      if (res?.success) {
        setPlans((current) => current.map((item) => (
          item.id === plan.id ? res.plan : item
        )));
        setSavedId(plan.id);
        setTimeout(() => setSavedId(null), 1800);
      }
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="adm-loading"><div className="adm-spinner" /> Loading plans...</div>;
  }

  return (
    <div className="adm-card">
      <div className="adm-card-header">
        <h3 className="adm-card-title">Contribution Plan Pricing</h3>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Description</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{toDisplayName(plan.name)}</div>
                  <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>v{plan.version || 1}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiDollarSign size={13} />
                    <input className="adm-input" style={{ width: 96 }} type="number" min="0" step="0.01" value={plan.price} onChange={(event) => updateField(plan.id, 'price', event.target.value)} />
                  </div>
                </td>
                <td style={{ minWidth: 260 }}>
                  <input className="adm-input adm-input-full" value={plan.description || ''} onChange={(event) => updateField(plan.id, 'description', event.target.value)} />
                </td>
                <td>
                  <input type="checkbox" checked={Boolean(plan.is_active)} onChange={(event) => updateField(plan.id, 'is_active', event.target.checked)} />
                </td>
                <td>
                  <button type="button" className="adm-btn adm-btn-primary" onClick={() => savePlan(plan)} disabled={savingId === plan.id}>
                    <FiSave size={13} />
                    {savingId === plan.id ? 'Saving...' : savedId === plan.id ? 'Saved' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
