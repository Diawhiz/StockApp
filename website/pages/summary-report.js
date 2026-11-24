import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SummaryReportPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    // Fetch data for selected date
    Promise.all([
      fetch(`/api/deliveries?date=${date}`),
      fetch(`/api/expenses`),
      fetch(`/api/vendors`),
    ]).then(async ([dRes, eRes, vRes]) => {
      const [dData, eData, vData] = await Promise.all([
        dRes.json(),
        eRes.json(),
        vRes.json(),
      ]);
      setDeliveries(dData.deliveries || []);
      setExpenses(eData.expenses || []);
      setVendors(vData.vendors || []);
      setLoading(false);
    });
  }, [date]);

  const handleDateChange = (e) => {
    setDate(e.target.value);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Summary Report</h2>
        <p>Loading...</p>
      </div>
    );
  }

  const totalDeliveryValue = deliveries.reduce((sum, d) => sum + (d.price_cents || 0), 0);
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f0f2f5',
      padding: 20
    }}>
      <h1>Summary Report</h1>
      
      {/* Date filter */}
      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.05' }}>
        <label style={{ marginRight: 10, fontWeight: '600' }}>Date:</label>
        <select 
          value={date}
          onChange={handleDateChange}
          style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
        >
          <option value="">All Dates</option>
          <option value={new Date().toISOString().split('T')[0]}>Today</option>
          <option value={(new Date(Date.now() - 86400000)).toISOString().split('T')[0]}>Yesterday</option>
        </select>
      </div>
      
      {/* Summary cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: 16, 
        marginBottom: 20
      }}>
        <div style={{ 
          background: '#e8f4fd', 
          padding: 16, 
          borderRadius: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0057b8' }}>
            {deliveries.length}
          </div>
          <div>Deliveries</div>
        </div>
        <div style={{ 
          background: '#d4edda', 
          padding: 16, 
          borderRadius: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#155724' }}>
            {expenses.length}
          </div>
          <div>Expenses</div>
        </div>
        <div style={{ 
          background: '#fff3cd', 
          padding: 16, 
          borderRadius: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#856404' }}>
            {totalDeliveryValue / 100 || 0}
          </div>
          <div>Delivery Value</div>
        </div>
        <div style={{ 
          background: '#f8d7da', 
          padding: 16, 
          borderRadius: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#721c24' }}>
            {totalExpenseAmount / 100 || 0}
          </div>
          <div>Expense Total</div>
        </div>
      </div>
      
      {/* Deliveries section */}
      <div style={{ 
        background: 'white', 
        borderRadius: 8, 
        padding: 20,
        marginTop: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <h3>Deliveries</h3>
        {deliveries.length === 0 ? (
          <p>No deliveries for the selected period.</p>
        ) : (
          <div style={{ 
            maxHeight: 300, 
            overflowY: 'auto',
            marginTop: 10
          }}>
            {deliveries.map((d) => (
              <div key={d.id} style={{ 
                padding: 8, 
                marginBottom: 8, 
                background: '#f8f9fa', 
                borderRadius: 4
              }}>
                <strong>#{d.id.substring(0, 8)}</strong> {d.location} | {d.rider}
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Value: {(d.price_cents / 100 || 0)} NGN | Fee: {(d.fee_cents / 100 || 0)} NGN
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Expenses section */}
      <div style={{ 
        background: 'white', 
        borderRadius: 8, 
        padding: 20,
        marginTop: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <h3>Expenses</h3>
        {expenses.length === 0 ? (
          <p>No expenses recorded.</p>
        ) : (
          <div style={{ 
            maxHeight: 300, 
            overflowY: 'auto',
            marginTop: 10
          }}>
            {expenses.map((e) => (
              <div key={e.id} style={{ 
                padding: 8, 
                marginBottom: 8, 
                background: '#f8f9fa', 
                borderRadius: 4
              }}>
                <strong>{e.description}</strong> - {e.amount / 100 || 0} NGN
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {e.date}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}