import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';

export default function HomePage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    // In a real app, this would check session/token
    const checkAuth = async () => {
      // Try the auth check endpoint
      try {
        const res = await fetch('/api/auth/check', {
          headers: {
            'Authorization': 'admin:test' // simplified
          }
        });
        const data = await res.json();
        if (data.valid) {
          setLoggedIn(true);
        }
      } catch (e) {
        // Not authenticated, show login
      }
    };

    checkAuth();
  }, []);

  if (!loggedIn) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <div style={{ background: 'white', padding: 40, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2>Sage Logistics - Inventory Management</h2>
          <p>Please log in to access the management dashboard.</p>
          
          <div style={{ marginTop: 20, padding: 20, borderRadius: 8, background: '#e8f4fd' }}>
            <h3>Admin Login</h3>
            <input 
              type="text" 
              placeholder="Username" 
              style={{ width: '100%', padding: 10, marginBottom: 10, border: '1px solid #ddd', borderRadius: 4 }}
            />
            <input 
              type="password" 
              placeholder="Password" 
              style={{ width: '100%', padding: 10, marginBottom: 10, border: '1px solid #ddd', borderRadius: 4 }}
            />
            <button 
              onClick={() => router.push('/dashboard')}
              style={{ 
                width: '100%', padding: 12, background: '#0057b8', color: 'white', border: 'none', borderRadius: 4, marginTop: 10
              }}
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null; // Will redirect to dashboard
}