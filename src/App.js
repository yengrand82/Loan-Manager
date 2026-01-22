import React, { useState, useEffect } from 'react';
import { DollarSign, Users, FileText, LogOut, Plus, Trash2, Home, TrendingUp, Activity, AlertCircle } from 'lucide-react';

// IMPORTANT: Replace this with your Google Sheets Web App URL
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyN5S5EzT9JEcKuy/5VpAkk9Cnyn8cQNyDqPLZcc4eXr3KbPmuExvpegXkBIqc91g/exec';

const LoanManagementSystem = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [borrowers, setBorrowers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch data from Google Sheets
  const loadData = async () => {
    setLoading(true);
    try {
      const [borrowersRes, loansRes, paymentsRes] = await Promise.all([
        fetch(`${GOOGLE_SHEETS_URL}?action=getBorrowers`).then(r => r.json()),
        fetch(`${GOOGLE_SHEETS_URL}?action=getLoans`).then(r => r.json()),
        fetch(`${GOOGLE_SHEETS_URL}?action=getPayments`).then(r => r.json())
      ]);
      
      setBorrowers(borrowersRes || []);
      setLoans(loansRes || []);
      setPayments(paymentsRes || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  // Calculate statistics
  const getStats = () => {
    const totalLoaned = loans.reduce((sum, l) => sum + parseFloat(l.principal || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const outstanding = totalLoaned - totalPaid;
    const collectionRate = totalLoaned > 0 ? (totalPaid / totalLoaned) * 100 : 0;
    
    return { totalLoaned, totalPaid, outstanding, collectionRate, activeBorrowers: borrowers.length, activeLoans: loans.length };
  };

  // Login View
  const LoginView = () => {
    const [loginId, setLoginId] = useState('');
    const [userType, setUserType] = useState('admin');

    const handleLogin = () => {
      if (userType === 'admin' && loginId === 'admin') {
        setCurrentUser({ id: 'admin', type: 'admin', name: 'Administrator' });
        setCurrentView('dashboard');
      } else {
        const borrower = borrowers.find(b => b.id === loginId);
        if (borrower) {
          setCurrentUser({ ...borrower, type: 'borrower' });
          setCurrentView('dashboard');
        } else {
          alert('Invalid credentials');
        }
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-600 to-purple-600">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-600 mb-4 shadow-lg">
              <DollarSign size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Loan Manager</h1>
            <p className="text-gray-600">Personal Loan Management System</p>
          </div>

          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUserType('admin')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  userType === 'admin' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => setUserType('borrower')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  userType === 'borrower' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Borrower
              </button>
            </div>

            <input
              type={userType === 'admin' ? 'password' : 'text'}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder={userType === 'admin' ? 'Enter password' : 'Enter Borrower ID'}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            Login
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Admin: <span className="font-semibold">admin / admin</span>
          </p>
        </div>
      </div>
    );
  };

  // Statistics Card
  const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 hover:shadow-md transition-all" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && <p className="text-sm text-green-600 mt-1">{trend}</p>}
        </div>
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon size={28} style={{ color: color }} />
        </div>
      </div>
    </div>
  );

  // Add Borrower Form
  const AddBorrowerForm = ({ onSuccess }) => {
    const [formData, setFormData] = useState({
      name: '', email: '', contact: '', principal: '', rate: '', term: '3', type: 'interest-only'
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.name || !formData.principal || !formData.rate) {
        alert('Please fill in Name, Amount, and Interest Rate');
        return;
      }

      setSaving(true);
      try {
        const borrowerId = `BRW${Date.now().toString().slice(-3)}`;
        const loanId = `LN${Date.now().toString().slice(-4)}`;

        // Add Borrower
        await fetch(GOOGLE_SHEETS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'addBorrower',
            data: { id: borrowerId, name: formData.name, contact: formData.contact, address: '', email: formData.email }
          })
        });

        // Add Loan
        await fetch(GOOGLE_SHEETS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'addLoan',
            data: {
              id: loanId,
              borrowerId: borrowerId,
              type: formData.type,
              principal: parseFloat(formData.principal),
              rate: parseFloat(formData.rate),
              term: parseInt(formData.term),
              startDate: new Date().toISOString().split('T')[0],
              status: 'active',
              schedule: []
            }
          })
        });

        alert('✅ Borrower added successfully!');
        setFormData({ name: '', email: '', contact: '', principal: '', rate: '', term: '3', type: 'interest-only' });
        if (onSuccess) onSuccess();
      } catch (error) {
        alert('Error: ' + error.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Borrower</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input type="text" placeholder="Full Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" required />
            <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" />
            <input type="tel" placeholder="Phone" value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" />
            <input type="number" placeholder="Loan Amount *" value={formData.principal} onChange={(e) => setFormData({...formData, principal: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" required />
            <input type="number" step="0.1" placeholder="Interest Rate (%) *" value={formData.rate} onChange={(e) => setFormData({...formData, rate: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" required />
            <select value={formData.term} onChange={(e) => setFormData({...formData, term: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600">
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months</option>
            </select>
            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600">
              <option value="interest-only">Interest Only</option>
              <option value="amortized">Amortized</option>
              <option value="staggered">Staggered</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:bg-gray-400 shadow-lg">
            {saving ? 'Adding...' : 'Add Borrower'}
          </button>
        </form>
      </div>
    );
  };

  // Admin Dashboard
  const AdminDashboard = () => {
    const stats = getStats();

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center">
                <DollarSign size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-blue-100">Loan Management System</p>
              </div>
            </div>
            <button onClick={() => { setCurrentUser(null); setCurrentView('login'); }} className="px-4 py-2 bg-white/20 backdrop-blur-lg text-white rounded-lg hover:bg-white/30 transition-all flex items-center gap-2">
              <LogOut size={18} /> Logout
            </button>
          </div>

          {/* Tabs */}
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Home },
                { id: 'borrowers', label: 'Borrowers', icon: Users }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-blue-600 rounded-t-lg shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                  <tab.icon size={18} /> {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard title="Total Loaned" value={`₱${stats.totalLoaned.toLocaleString()}`} icon={DollarSign} color="#3B82F6" />
                    <StatCard title="Total Collected" value={`₱${stats.totalPaid.toLocaleString()}`} icon={TrendingUp} color="#10B981" trend={`${stats.collectionRate.toFixed(1)}%`} />
                    <StatCard title="Outstanding" value={`₱${stats.outstanding.toLocaleString()}`} icon={AlertCircle} color="#F59E0B" />
                    <StatCard title="Active Borrowers" value={stats.activeBorrowers} icon={Users} color="#8B5CF6" />
                    <StatCard title="Active Loans" value={stats.activeLoans} icon={FileText} color="#EC4899" />
                    <StatCard title="Collection Rate" value={`${stats.collectionRate.toFixed(1)}%`} icon={Activity} color="#06B6D4" />
                  </div>
                </div>
              )}

              {activeTab === 'borrowers' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Manage Borrowers</h2>
                  <AddBorrowerForm onSuccess={loadData} />

                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">All Borrowers ({borrowers.length})</h3>
                    {borrowers.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">No borrowers yet. Add one above!</p>
                    ) : (
                      <div className="space-y-4">
                        {borrowers.map(borrower => {
                          const borrowerLoans = loans.filter(l => l.borrowerid === borrower.id);
                          const loan = borrowerLoans[0];
                          const borrowerPayments = payments.filter(p => p.borrowerid === borrower.id);
                          const totalBorrowed = borrowerLoans.reduce((sum, l) => sum + parseFloat(l.principal || 0), 0);
                          const totalPaid = borrowerPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                          const progress = totalBorrowed > 0 ? (totalPaid / totalBorrowed) * 100 : 0;

                          return (
                            <div key={borrower.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                    {borrower.name.charAt(0)}
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-gray-900 text-lg">{borrower.name}</h3>
                                    {loan && <p className="text-gray-600">₱{parseFloat(loan.principal || 0).toLocaleString()} @ {loan.rate}%</p>}
                                    <p className="text-sm text-gray-500">Code: {borrower.id}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600">Progress</p>
                                    <p className="text-lg font-bold text-blue-600">{progress.toFixed(1)}%</p>
                                  </div>
                                  <button onClick={() => alert('Delete feature coming soon!')} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Main Render
  if (currentView === 'login') return <LoginView />;
  return <AdminDashboard />;
};

export default LoanManagementSystem;