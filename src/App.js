import React, { useState, useEffect } from 'react';
import { DollarSign, Users, FileText, LogOut, Plus, Trash2, Home, TrendingUp, Activity, AlertCircle, X, Check, Paperclip, Send, Calendar, ArrowLeft, Upload, Download, MessageSquare, Camera, History, User, Mail, Phone, CreditCard, CheckCircle, Clock, XCircle, Bell } from 'lucide-react';

// IMPORTANT: Replace with your Google Sheets Web App URL
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzN5S5EzI9JEcKuyr5VpAtk9Cnyn8oCNyDqPLZcc4eXr3KBPmuE4xvpegXkBIqc9ls/exec';

const LoanManagementSystem = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profileTab, setProfileTab] = useState('details');
  const [borrowers, setBorrowers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  // Loan calculation functions
  const calculateMonthlyPayment = (principal, rate, term, type) => {
    const schedule = [];
    const monthlyRate = rate / 100;
    
    if (type === 'interest-only') {
      const monthlyInterest = (principal * rate) / 100;
      for (let i = 1; i <= term; i++) {
        const isLastMonth = i === term;
        schedule.push({
          month: i,
          payment: isLastMonth ? principal + monthlyInterest : monthlyInterest,
          principal: isLastMonth ? principal : 0,
          interest: monthlyInterest,
          balance: isLastMonth ? 0 : principal,
          dueDate: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          status: 'pending'
        });
      }
    } else if (type === 'amortized') {
      const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
      let balance = principal;
      
      for (let i = 1; i <= term; i++) {
        const interest = balance * monthlyRate;
        const principalPaid = monthlyPayment - interest;
        balance -= principalPaid;
        
        schedule.push({
          month: i,
          payment: monthlyPayment,
          principal: principalPaid,
          interest: interest,
          balance: Math.max(0, balance),
          dueDate: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          status: 'pending'
        });
      }
    } else if (type === 'staggered') {
      const principalPerMonth = principal / term;
      let balance = principal;
      
      for (let i = 1; i <= term; i++) {
        const interest = (balance * rate) / 100;
        const payment = principalPerMonth + interest;
        balance -= principalPerMonth;
        
        schedule.push({
          month: i,
          payment: payment,
          principal: principalPerMonth,
          interest: interest,
          balance: Math.max(0, balance),
          dueDate: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          status: 'pending'
        });
      }
    }
    
    return schedule;
  };

  // Fetch data from Google Sheets
  const loadData = async () => {
    setLoading(true);
    try {
      const [borrowersRes, loansRes, paymentsRes, messagesRes, applicationsRes] = await Promise.all([
        fetch(`${GOOGLE_SHEETS_URL}?action=getBorrowers`).then(r => r.json()).catch(() => []),
        fetch(`${GOOGLE_SHEETS_URL}?action=getLoans`).then(r => r.json()).catch(() => []),
        fetch(`${GOOGLE_SHEETS_URL}?action=getPayments`).then(r => r.json()).catch(() => []),
        fetch(`${GOOGLE_SHEETS_URL}?action=getMessages`).then(r => r.json()).catch(() => []),
        fetch(`${GOOGLE_SHEETS_URL}?action=getApplications`).then(r => r.json()).catch(() => [])
      ]);
      
      setBorrowers(borrowersRes || []);
      setLoans(loansRes || []);
      setPayments(paymentsRes || []);
      setMessages(messagesRes || []);
      setApplications(applicationsRes || []);
      
      // Update selected borrower if it exists
      if (selectedBorrower) {
        const updated = borrowersRes.find(b => b.id === selectedBorrower.id);
        if (updated) setSelectedBorrower(updated);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Keep selectedBorrower in sync when borrower is logged in
  useEffect(() => {
    if (currentUser && currentUser.type === 'borrower' && borrowers.length > 0) {
      const updated = borrowers.find(b => b.id === currentUser.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedBorrower)) {
        setSelectedBorrower(updated);
      }
    }
  }, [borrowers, currentUser]);

  // Auto-refresh messages every 5 seconds when on messages tab (but not while typing)
  useEffect(() => {
    if (selectedBorrower && profileTab === 'messages') {
      const interval = setInterval(() => {
        if (!isTyping) {
          console.log('Auto-refreshing messages...');
          loadData();
        } else {
          console.log('Skipping refresh - user is typing');
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedBorrower, profileTab, isTyping]);

  // Calculate statistics
  const getStats = () => {
    const totalLoaned = loans.reduce((sum, l) => sum + parseFloat(l.principal || 0), 0);
    const totalPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    // Calculate total amount to be paid (including all interest)
    let totalToBePaid = 0;
    loans.forEach(loan => {
      try {
        const schedule = typeof loan.schedule === 'string' ? JSON.parse(loan.schedule) : loan.schedule;
        if (Array.isArray(schedule)) {
          totalToBePaid += schedule.reduce((sum, s) => sum + parseFloat(s.payment || 0), 0);
        }
      } catch (e) {
        // If can't parse schedule, just use principal
        totalToBePaid += parseFloat(loan.principal || 0);
      }
    });
    
    const outstanding = totalToBePaid - totalPaid;
    const collectionRate = totalToBePaid > 0 ? (totalPaid / totalToBePaid) * 100 : 0;
    
    const paidPayments = payments.filter(p => p.status === 'completed').length;
    const totalPaymentsDue = loans.reduce((sum, l) => sum + parseInt(l.term || 0), 0);
    const onTimeRate = totalPaymentsDue > 0 ? (paidPayments / totalPaymentsDue) * 100 : 0;
    
    return { 
      totalLoaned, 
      totalPaid, 
      outstanding, 
      collectionRate, 
      activeBorrowers: borrowers.length, 
      activeLoans: loans.filter(l => l.status === 'active').length,
      onTimeRate,
      totalPayments: paidPayments,
      pendingApplications: applications.filter(a => a.status === 'pending').length
    };
  };

  // Update borrower photo
  const updateBorrowerPhoto = async (borrowerId, photoData) => {
    try {
      const response = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateBorrower',
          data: {
            id: borrowerId,
            photo: photoData
          }
        })
      });
      
      const result = await response.json();
      console.log('Photo update result:', result);
      
      await loadData();
      alert('✅ Photo updated successfully!');
    } catch (error) {
      console.error('Error updating photo:', error);
      alert('Error updating photo: ' + error.message);
    }
  };

  // Mark payment as paid
  const markPaymentAsPaid = async (loanId, month, amount, proof) => {
    try {
      const payment = {
        id: `PAY${Date.now()}`,
        loanId: loanId,
        borrowerId: selectedBorrower.id,
        amount: amount,
        month: month,
        paymentDate: new Date().toISOString(),
        proof: proof || '',
        status: 'completed'
      };
      
      const response = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addPayment',
          data: payment
        })
      });
      
      const result = await response.json();
      console.log('Payment result:', result);
      
      await loadData();
      alert('✅ Payment marked as paid!');
      return true;
    } catch (error) {
      console.error('Payment error:', error);
      alert('Error: ' + error.message);
      return false;
    }
  };

  // Send message
  const sendMessage = async (messageText, attachment) => {
    try {
      console.log('=== SEND MESSAGE FUNCTION START ===');
      console.log('1. Input validation...');
      
      if (!messageText.trim() && !attachment) {
        alert('Please type a message or attach a file');
        return false;
      }

      if (!currentUser) {
        console.error('ERROR: No current user');
        alert('Error: User not logged in');
        return false;
      }

      if (!selectedBorrower) {
        console.error('ERROR: No selected borrower');
        console.error('currentUser:', currentUser);
        alert('Error: Borrower not selected');
        return false;
      }

      console.log('2. Creating message object...');
      const message = {
        id: `MSG${Date.now()}`,
        senderid: currentUser.id,
        receiverid: currentUser.type === 'admin' ? selectedBorrower.id : 'admin',
        message: messageText,
        image: attachment || '',
        timestamp: new Date().toISOString(),
        read: false
      };
      
      console.log('3. Message object created:', {
        id: message.id,
        senderid: message.senderid,
        receiverid: message.receiverid,
        hasMessage: !!message.message,
        hasImage: !!message.image,
        imageLength: message.image ? message.image.length : 0
      });
      
      console.log('4. Sending to Google Sheets...');
      console.log('URL:', GOOGLE_SHEETS_URL);
      
      const requestBody = {
        action: 'sendMessage',
        data: message
      };
      console.log('Request body:', JSON.stringify(requestBody).substring(0, 200) + '...');
      
      const response = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      console.log('5. Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      const result = await response.json();
      console.log('6. Result parsed:', result);
      
      if (result.success) {
        console.log('7. SUCCESS! Reloading data...');
        await loadData();
        console.log('8. Data reloaded. Message sent successfully!');
        return true;
      } else {
        console.error('7. FAILED:', result);
        alert('Failed to send message: ' + (result.error || 'Unknown error'));
        return false;
      }
    } catch (error) {
      console.error('=== ERROR IN SEND MESSAGE ===');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      alert('Error sending message: ' + error.message);
      return false;
    }
  };

  // Submit loan application
  const submitLoanApplication = async (applicationData) => {
    try {
      const application = {
        id: `APP${Date.now()}`,
        borrowerId: currentUser.id,
        borrowerName: currentUser.name,
        amount: applicationData.amount,
        purpose: applicationData.purpose,
        term: applicationData.term,
        income: applicationData.income,
        employment: applicationData.employment,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      const response = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'submitApplication',
          data: application
        })
      });
      
      const result = await response.json();
      
      await loadData();
      return result.success;
    } catch (error) {
      console.error('Application error:', error);
      return false;
    }
  };

  // Approve loan application
  const approveLoanApplication = async (application, rate, type) => {
    try {
      const borrowerId = application.borrowerid;
      const loanId = `LN${Date.now().toString().slice(-4)}`;

      // Calculate schedule
      const schedule = calculateMonthlyPayment(
        parseFloat(application.amount),
        parseFloat(rate),
        parseInt(application.term),
        type
      );

      // Add Loan
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addLoan',
          data: {
            id: loanId,
            borrowerId: borrowerId,
            type: type,
            principal: parseFloat(application.amount),
            rate: parseFloat(rate),
            term: parseInt(application.term),
            startDate: new Date().toISOString().split('T')[0],
            status: 'active',
            schedule: JSON.stringify(schedule)
          }
        })
      });

      // Update application status
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateApplication',
          data: {
            id: application.id,
            status: 'approved'
          }
        })
      });

      await loadData();
      alert('✅ Loan application approved!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
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
          // Set both currentUser and selectedBorrower for borrower login
          const borrowerUser = { ...borrower, type: 'borrower' };
          setCurrentUser(borrowerUser);
          setSelectedBorrower(borrower);
          setCurrentView('borrower-profile');
          console.log('Borrower logged in:', borrowerUser);
          console.log('Selected borrower set:', borrower);
        } else {
          alert('Invalid credentials. Please check your Borrower ID.');
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
              placeholder={userType === 'admin' ? 'Enter password' : 'Enter Borrower ID (e.g., BRW001)'}
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
  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 hover:shadow-xl transition-all transform hover:-translate-y-1" style={{ borderColor: color }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend && <p className="text-sm font-semibold text-green-600 mt-2 flex items-center gap-1">
            <TrendingUp size={14} /> {trend}
          </p>}
        </div>
        <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: `${color}20` }}>
          <Icon size={32} style={{ color: color }} />
        </div>
      </div>
    </div>
  );

  // Application Approval Component
  const ApplicationItem = ({ app, onApprove }) => {
    const [rate, setRate] = useState('5');
    const [type, setType] = useState('interest-only');

    return (
      <div className="border-2 border-yellow-200 bg-yellow-50 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h4 className="font-bold text-xl text-gray-900">{app.borrowername}</h4>
            <p className="text-sm text-gray-600">Borrower ID: {app.borrowerid}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">₱{parseFloat(app.amount).toLocaleString()}</p>
            <p className="text-sm text-gray-600 mt-1">Term: {app.term} months</p>
            <div className="mt-3 p-3 bg-white rounded-lg">
              <p className="text-sm font-semibold text-gray-700">Purpose:</p>
              <p className="text-gray-900">{app.purpose}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Monthly Income:</p>
                <p className="text-gray-900">₱{parseFloat(app.income).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Employment:</p>
                <p className="text-gray-900">{app.employment}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Applied: {new Date(app.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-white rounded-lg">
          <h5 className="font-bold text-gray-900 mb-3">Approve Loan:</h5>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Interest Rate (%)</label>
              <input 
                type="number" 
                step="0.1"
                value={rate} 
                onChange={(e) => setRate(e.target.value)} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Type</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="interest-only">Interest Only</option>
                <option value="amortized">Amortized</option>
                <option value="staggered">Staggered</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => onApprove(app, rate, type)}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-all shadow-lg"
          >
            Approve Application
          </button>
        </div>
      </div>
    );
  };

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

        const schedule = calculateMonthlyPayment(
          parseFloat(formData.principal),
          parseFloat(formData.rate),
          parseInt(formData.term),
          formData.type
        );

        await fetch(GOOGLE_SHEETS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'addBorrower',
            data: { 
              id: borrowerId, 
              name: formData.name, 
              contact: formData.contact, 
              address: '', 
              email: formData.email,
              photo: ''
            }
          })
        });

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
              schedule: JSON.stringify(schedule)
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
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={24} className="text-blue-600" />
          Add New Borrower
        </h3>
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
              <option value="24">24 Months</option>
            </select>
            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600">
              <option value="interest-only">Interest Only</option>
              <option value="amortized">Amortized</option>
              <option value="staggered">Staggered</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:bg-gray-400 shadow-lg flex items-center justify-center gap-2">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Adding...
              </>
            ) : (
              <>
                <Plus size={20} />
                Add Borrower
              </>
            )}
          </button>
        </form>
      </div>
    );
  };

  // Loan Application Form
  const LoanApplicationForm = ({ onSuccess }) => {
    const [formData, setFormData] = useState({
      amount: '', purpose: '', term: '3', income: '', employment: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.amount || !formData.purpose || !formData.income || !formData.employment) {
        alert('Please fill in all required fields');
        return;
      }

      setSubmitting(true);
      const success = await submitLoanApplication(formData);
      if (success) {
        alert('✅ Loan application submitted successfully! Please wait for admin approval.');
        setFormData({ amount: '', purpose: '', term: '3', income: '', employment: '' });
        if (onSuccess) onSuccess();
      } else {
        alert('❌ Failed to submit application. Please try again.');
      }
      setSubmitting(false);
    };

    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={28} className="text-blue-600" />
          Apply for New Loan
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Amount *</label>
              <input 
                type="number" 
                placeholder="Enter amount" 
                value={formData.amount} 
                onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose *</label>
              <textarea 
                placeholder="Describe the purpose of this loan" 
                value={formData.purpose} 
                onChange={(e) => setFormData({...formData, purpose: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" 
                rows="3"
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Term</label>
              <select 
                value={formData.term} 
                onChange={(e) => setFormData({...formData, term: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">12 Months</option>
                <option value="24">24 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Income *</label>
              <input 
                type="number" 
                placeholder="Enter monthly income" 
                value={formData.income} 
                onChange={(e) => setFormData({...formData, income: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Employment Status *</label>
              <input 
                type="text" 
                placeholder="e.g., Full-time, Self-employed" 
                value={formData.employment} 
                onChange={(e) => setFormData({...formData, employment: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" 
                required 
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={submitting} 
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:bg-gray-400 shadow-lg flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send size={20} />
                Submit Application
              </>
            )}
          </button>
        </form>
      </div>
    );
  };

  // Borrower Profile View
  const BorrowerProfileView = () => {
    const borrower = selectedBorrower;
    
    // Safety check
    if (!borrower) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      );
    }
    
    const borrowerLoans = loans.filter(l => l.borrowerid === borrower.id);
    const loan = borrowerLoans[0];
    const borrowerPayments = payments.filter(p => p.borrowerid === borrower.id);
    const borrowerMessages = messages.filter(m => 
      (m.senderid === borrower.id && m.receiverid === 'admin') ||
      (m.senderid === 'admin' && m.receiverid === borrower.id)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const borrowerApplications = applications.filter(a => a.borrowerid === borrower.id);

    const [newMessage, setNewMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [attachmentName, setAttachmentName] = useState('');
    const [paymentProofs, setPaymentProofs] = useState({});
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);

    let schedule = [];
    if (loan && loan.schedule) {
      try {
        schedule = typeof loan.schedule === 'string' ? JSON.parse(loan.schedule) : loan.schedule;
      } catch (e) {
        schedule = calculateMonthlyPayment(loan.principal, loan.rate, loan.term, loan.type);
      }
    }

    const paidMonths = borrowerPayments
      .filter(p => p.status === 'completed')  // Only completed payments
      .map(p => parseInt(p.month));

    const handlePhotoUpload = async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5000000) {
          alert('File too large. Please upload an image smaller than 5MB');
          return;
        }
        setUploadingPhoto(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          await updateBorrowerPhoto(borrower.id, reader.result);
          setUploadingPhoto(false);
        };
        reader.readAsDataURL(file);
      }
    };

    const handleFileUpload = (e, isMessage = true, monthNum = null) => {
      const file = e.target.files[0];
      console.log('=== FILE UPLOAD DEBUG ===');
      console.log('File selected:', file ? file.name : 'NO FILE');
      console.log('File size:', file ? file.size : 0);
      console.log('Is message:', isMessage);
      console.log('========================');
      
      if (file) {
        if (file.size > 5000000) {
          alert('File too large. Please upload a file smaller than 5MB');
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('File read complete. Base64 length:', reader.result ? reader.result.length : 0);
          if (isMessage) {
            setAttachment(reader.result);
            setAttachmentName(file.name);
            console.log('Attachment set for message:', file.name);
          } else {
            setPaymentProofs({...paymentProofs, [monthNum]: reader.result});
            console.log('Payment proof set for month:', monthNum);
          }
        };
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          alert('Error reading file');
        };
        reader.readAsDataURL(file);
      }
    };

    const handleSendMessage = async () => {
      console.log('=== SEND MESSAGE DEBUG ===');
      console.log('newMessage:', newMessage);
      console.log('attachment:', attachment ? `YES (${attachment.substring(0, 50)}...)` : 'NO');
      console.log('attachmentName:', attachmentName);
      console.log('currentUser:', currentUser);
      console.log('selectedBorrower:', selectedBorrower);
      console.log('========================');
      
      if (!newMessage.trim() && !attachment) {
        alert('Please type a message or attach a file');
        return;
      }
      
      setSendingMessage(true);
      const success = await sendMessage(newMessage, attachment);
      if (success) {
        setNewMessage('');
        setAttachment(null);
        setAttachmentName('');
        console.log('Message sent successfully, state cleared');
      } else {
        console.log('Message send failed');
      }
      setSendingMessage(false);
    };

    const handleMarkAsPaid = async (month, amount) => {
      const proof = paymentProofs[month];
      if (!proof) {
        alert('Please upload payment proof first');
        return;
      }
      
      const success = await markPaymentAsPaid(loan.id, month, amount, proof);
      if (success) {
        setPaymentProofs({...paymentProofs, [month]: null});
      }
    };

    const totalPaid = borrowerPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    // Calculate total to be paid (including all interest from schedule)
    let totalLoan = 0;
    if (loan && schedule && Array.isArray(schedule)) {
      totalLoan = schedule.reduce((sum, s) => sum + parseFloat(s.payment || 0), 0);
    } else if (loan) {
      totalLoan = parseFloat(loan.principal);
    }
    
    const progress = totalLoan > 0 ? (totalPaid / totalLoan) * 100 : 0;

    // Get next due date
    const nextDue = schedule.find(s => !paidMonths.includes(s.month));

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <button 
              onClick={() => {
                setSelectedBorrower(null);
                setProfileTab('details');
                if (currentUser.type === 'borrower') {
                  setCurrentUser(null);
                  setCurrentView('login');
                } else {
                  setCurrentView('dashboard');
                }
              }} 
              className="mb-4 flex items-center text-white hover:text-blue-100 transition-all"
            >
              <ArrowLeft size={20} className="mr-2" />
              Back
            </button>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {borrower.photo ? (
                    <img src={borrower.photo} alt={borrower.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold border-4 border-white shadow-lg">
                      {borrower.name.charAt(0)}
                    </div>
                  )}
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-all shadow-lg"
                      title="Upload photo"
                    >
                      {uploadingPhoto ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Camera size={16} className="text-white" />
                      )}
                    </label>
                  </>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{borrower.name}</h1>
                  <p className="text-blue-100 text-lg">ID: {borrower.id}</p>
                  {loan && (
                    <p className="text-blue-100 mt-1">
                      ₱{parseFloat(loan.principal).toLocaleString()} @ {loan.rate}% • {loan.term} months
                    </p>
                  )}
                </div>
              </div>
              {currentUser.type === 'borrower' && (
                <button onClick={() => { setCurrentUser(null); setCurrentView('login'); }} className="px-6 py-3 bg-white/20 backdrop-blur-lg text-white rounded-lg hover:bg-white/30 transition-all flex items-center gap-2 shadow-lg">
                  <LogOut size={18} /> Logout
                </button>
              )}
            </div>

            {/* Progress Bar & Next Due */}
            <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="text-sm font-semibold">Payment Progress</span>
                  {nextDue && (
                    <p className="text-xs text-blue-100 mt-1 flex items-center gap-1">
                      <Clock size={14} />
                      Next due: {new Date(nextDue.dueDate).toLocaleDateString()} - ₱{nextDue.payment.toFixed(2)}
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold">{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-blue-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span>Paid: ₱{totalPaid.toLocaleString()}</span>
                <span>Remaining: ₱{(totalLoan - totalPaid).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-2">
              {[
                { id: 'details', label: 'Details', icon: User },
                { id: 'payments', label: 'Payments', icon: CreditCard },
                { id: 'history', label: 'History', icon: History },
                { id: 'messages', label: 'Messages', icon: MessageSquare, badge: borrowerMessages.filter(m => !m.read && m.receiverid === currentUser.id).length },
                ...(currentUser.type === 'borrower' ? [{ id: 'apply', label: 'Apply Loan', icon: FileText }] : [])
              ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setProfileTab(tab.id)} 
                  className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${profileTab === tab.id ? 'bg-white text-blue-600 rounded-t-lg shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                >
                  <tab.icon size={18} /> 
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Details Tab */}
          {profileTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User size={24} className="text-blue-600" />
                  Contact Information
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone size={20} className="text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{borrower.contact || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail size={20} className="text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold text-gray-900">{borrower.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar size={20} className="text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Member Since</p>
                      <p className="font-semibold text-gray-900">
                        {borrower.createddate ? new Date(borrower.createddate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {loan && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign size={24} className="text-green-600" />
                    Loan Summary
                  </h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Loan Amount</span>
                      <span className="font-bold text-2xl text-gray-900">₱{parseFloat(loan.principal).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Interest Rate</span>
                      <span className="font-bold text-xl text-gray-900">{loan.rate}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Term</span>
                      <span className="font-bold text-xl text-gray-900">{loan.term} months</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Type</span>
                      <span className="font-bold text-gray-900 capitalize">{loan.type?.replace('-', ' ')}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-green-700 font-semibold">Total Paid</span>
                      <span className="font-bold text-2xl text-green-600">₱{totalPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <span className="text-orange-700 font-semibold">Outstanding</span>
                      <span className="font-bold text-2xl text-orange-600">₱{(totalLoan - totalPaid).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payments Tab */}
          {profileTab === 'payments' && loan && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <CreditCard size={28} className="text-blue-600" />
                Payment Schedule
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                {schedule.map((payment, idx) => {
                  const isPaid = paidMonths.includes(payment.month);
                  const paymentRecord = borrowerPayments.find(p => parseInt(p.month) === payment.month);
                  const hasProof = paymentProofs[payment.month];
                  const isOverdue = new Date(payment.dueDate) < new Date() && !isPaid;
                  
                  return (
                    <div key={idx} className={`border-2 rounded-xl p-6 transition-all ${isPaid ? 'bg-green-50 border-green-300 shadow-md' : isOverdue ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:shadow-md'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${isPaid ? 'bg-green-500' : isOverdue ? 'bg-red-500' : 'bg-gray-300'}`}>
                            {isPaid ? (
                              <CheckCircle size={28} className="text-white" />
                            ) : isOverdue ? (
                              <AlertCircle size={28} className="text-white" />
                            ) : (
                              <span className="text-white font-bold text-xl">{payment.month}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg">Payment #{payment.month}</p>
                            <p className={`text-sm flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                              <Calendar size={14} />
                              Due: {new Date(payment.dueDate).toLocaleDateString()}
                              {isOverdue && <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded">OVERDUE</span>}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">₱{payment.payment.toFixed(2)}</p>
                            {payment.month === schedule.length && (
                              <p className="text-xs text-purple-600 font-semibold mt-1">
                                Includes principal: ₱{parseFloat(loan.principal).toFixed(2)}
                              </p>
                            )}
                            {isPaid && paymentRecord && (
                              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <Check size={12} />
                                Paid on {new Date(paymentRecord.paymentdate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          {isPaid ? (
                            <div>
                              <span className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold text-lg shadow-lg flex items-center gap-2">
                                <CheckCircle size={20} /> PAID
                              </span>
                              {paymentRecord && paymentRecord.proof && (
                                <button
                                  onClick={() => window.open(paymentRecord.proof, '_blank')}
                                  className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <FileText size={14} />
                                  View Proof
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {/* BORROWER: Can upload proof */}
                              {currentUser.type === 'borrower' && (
                                <>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload(e, false, payment.month)}
                                    className="hidden"
                                    id={`proof-${payment.month}`}
                                  />
                                  <label
                                    htmlFor={`proof-${payment.month}`}
                                    className={`px-6 py-3 rounded-lg font-semibold cursor-pointer transition-all flex items-center gap-2 ${
                                      hasProof ? 'bg-green-100 text-green-700 border-2 border-green-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                    }`}
                                  >
                                    <Upload size={18} />
                                    {hasProof ? 'Proof Uploaded ✓' : 'Upload Proof'}
                                  </label>
                                  
                                  {hasProof && (
                                    <button
                                      onClick={async () => {
                                        const proof = paymentProofs[payment.month];
                                        if (!proof) return;
                                        
                                        try {
                                          const pendingPayment = {
                                            id: `PAY${Date.now()}`,
                                            loanId: loan.id,
                                            borrowerId: borrower.id,
                                            amount: payment.payment,
                                            month: payment.month,
                                            paymentDate: new Date().toISOString(),
                                            proof: proof,
                                            status: 'pending'
                                          };
                                          
                                          await fetch(GOOGLE_SHEETS_URL, {
                                            method: 'POST',
                                            body: JSON.stringify({
                                              action: 'addPayment',
                                              data: pendingPayment
                                            })
                                          });
                                          
                                          await loadData();
                                          setPaymentProofs({...paymentProofs, [payment.month]: null});
                                          alert('✅ Payment proof submitted! Waiting for admin approval.');
                                        } catch (error) {
                                          alert('Error: ' + error.message);
                                        }
                                      }}
                                      className="px-6 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-all shadow-lg"
                                    >
                                      Submit for Approval
                                    </button>
                                  )}
                                  
                                  {!hasProof && (
                                    <span className={`px-6 py-3 rounded-lg font-bold border-2 text-center ${isOverdue ? 'bg-red-100 text-red-700 border-red-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>
                                      {isOverdue ? 'OVERDUE' : 'PENDING'}
                                    </span>
                                  )}
                                </>
                              )}
                              
                              {/* ADMIN: Can only view, not upload */}
                              {currentUser.type === 'admin' && (
                                <span className={`px-6 py-3 rounded-lg font-bold border-2 text-center ${isOverdue ? 'bg-red-100 text-red-700 border-red-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>
                                  {isOverdue ? 'OVERDUE' : 'AWAITING BORROWER'}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Show pending payments submitted by borrower */}
                          {!isPaid && borrowerPayments.filter(p => parseInt(p.month) === payment.month && p.status === 'pending').map(pendingPayment => (
                            <div key={pendingPayment.id} className="mt-2 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg w-full">
                              <p className="text-sm font-bold text-orange-700 flex items-center gap-2">
                                <Clock size={16} />
                                {currentUser.type === 'admin' ? 'Awaiting Your Approval' : 'Pending Admin Approval'}
                              </p>
                              <p className="text-xs text-orange-600 mt-1">
                                Submitted: {new Date(pendingPayment.paymentdate).toLocaleDateString()}
                              </p>
                              {pendingPayment.proof && (
                                <button
                                  onClick={() => window.open(pendingPayment.proof, '_blank')}
                                  className="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                                >
                                  <FileText size={16} />
                                  {currentUser.type === 'admin' ? 'View Proof to Verify' : 'View Submitted Proof'}
                                </button>
                              )}
                              {currentUser.type === 'admin' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await fetch(GOOGLE_SHEETS_URL, {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          action: 'updatePaymentStatus',
                                          data: {
                                            id: pendingPayment.id,
                                            status: 'completed'
                                          }
                                        })
                                      });
                                      
                                      await loadData();
                                      alert('✅ Payment approved and marked as paid!');
                                    } catch (error) {
                                      alert('Error: ' + error.message);
                                    }
                                  }}
                                  className="mt-2 w-full px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                  <CheckCircle size={20} />
                                  Approve & Mark as Paid
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History Tab */}
          {profileTab === 'history' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <History size={28} className="text-purple-600" />
                Payment History
              </h2>
              
              {borrowerPayments.length === 0 ? (
                <div className="text-center py-12">
                  <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 text-lg">No payment history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {borrowerPayments.sort((a, b) => new Date(b.paymentdate) - new Date(a.paymentdate)).map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle size={24} className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Month {payment.month} Payment</p>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(payment.paymentdate).toLocaleDateString()} at {new Date(payment.paymentdate).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">₱{parseFloat(payment.amount).toFixed(2)}</p>
                        {payment.proof && (
                          <button
                            onClick={() => window.open(payment.proof, '_blank')}
                            className="mt-1 text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <FileText size={14} />
                            View Proof
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages Tab */}
          {profileTab === 'messages' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <MessageSquare size={28} className="text-blue-600" />
                Messages
              </h2>
              
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-4">
                {borrowerMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600 text-lg">No messages yet. Start a conversation!</p>
                  </div>
                ) : (
                  borrowerMessages.map(msg => {
                    const isSentByMe = msg.senderid === currentUser.id;
                    return (
                      <div key={msg.id} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} mb-4`}>
                        <div className={`max-w-md p-4 rounded-2xl shadow-md ${isSentByMe ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'}`}>
                          {msg.image && (
                            <div className="mb-3">
                              {msg.image.startsWith('data:image') ? (
                                <img src={msg.image} alt="Attachment" className="max-w-full rounded-lg mb-2 max-h-64 object-contain" />
                              ) : (
                                <a href={msg.image} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 ${isSentByMe ? 'text-blue-100' : 'text-blue-600'} hover:underline font-semibold`}>
                                  <Paperclip size={16} />
                                  View Attachment
                                </a>
                              )}
                            </div>
                          )}
                          {msg.message && <p className="break-words text-lg">{msg.message}</p>}
                          <p className={`text-xs mt-2 ${isSentByMe ? 'text-blue-100' : 'text-gray-500'}`}>
                            {new Date(msg.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input */}
              <div className="border-t pt-4">
                {/* Show attachment preview if file is attached */}
                {attachmentName && (
                  <div className="mb-3 flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Paperclip size={16} />
                      <span className="font-semibold">{attachmentName}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setAttachment(null);
                        setAttachmentName('');
                        console.log('Attachment removed');
                      }} 
                      className="text-red-500 hover:text-red-700 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => handleFileUpload(e, true)}
                    className="hidden"
                    id="message-attachment"
                  />
                  <label
                    htmlFor="message-attachment"
                    className={`cursor-pointer p-4 border-2 rounded-xl transition-all ${
                      attachmentName 
                        ? 'bg-green-50 border-green-400 hover:bg-green-100' 
                        : 'border-gray-300 hover:bg-gray-50 hover:border-blue-400'
                    }`}
                    title="Attach file"
                  >
                    <Paperclip size={24} className={attachmentName ? 'text-green-600' : 'text-gray-600'} />
                  </label>
                  
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    placeholder={attachmentName ? "Add a message (optional)..." : "Type your message..."}
                    className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !sendingMessage && (newMessage.trim() || attachment)) {
                        setIsTyping(false);
                        handleSendMessage();
                      }
                    }}
                  />
                  
                  <button
                    onClick={handleSendMessage}
                    disabled={(!newMessage.trim() && !attachment) || sendingMessage}
                    className={`px-8 py-4 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg ${
                      (newMessage.trim() || attachment) && !sendingMessage
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {sendingMessage ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Apply Loan Tab (Borrower Only) */}
          {profileTab === 'apply' && currentUser.type === 'borrower' && (
            <div>
              <LoanApplicationForm onSuccess={loadData} />
              
              {/* Application Status */}
              {borrowerApplications.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Your Applications</h3>
                  <div className="space-y-3">
                    {borrowerApplications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(app => (
                      <div key={app.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <p className="font-bold text-gray-900">₱{parseFloat(app.amount).toLocaleString()}</p>
                          <p className="text-sm text-gray-600">{app.purpose}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Submitted: {new Date(app.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-4 py-2 rounded-lg font-bold ${
                          app.status === 'approved' ? 'bg-green-100 text-green-700' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {app.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Admin Dashboard
  const AdminDashboard = () => {
    const stats = getStats();

    if (selectedBorrower) {
      return <BorrowerProfileView />;
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 text-white shadow-2xl">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center shadow-lg">
                  <DollarSign size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                  <p className="text-sm text-blue-100">Loan Management System</p>
                </div>
              </div>
              <button onClick={() => { setCurrentUser(null); setCurrentView('login'); }} className="px-6 py-3 bg-white/20 backdrop-blur-lg text-white rounded-lg hover:bg-white/30 transition-all flex items-center gap-2 shadow-lg">
                <LogOut size={20} /> Logout
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Home },
                { id: 'borrowers', label: 'Borrowers', icon: Users },
                { id: 'applications', label: 'Applications', icon: Bell, badge: stats.pendingApplications }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-blue-600 rounded-t-lg shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                  <tab.icon size={18} /> 
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 text-lg">Loading data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Overview</h2>
                  
                  {/* Statistics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard 
                      title="Total Loaned" 
                      value={`₱${stats.totalLoaned.toLocaleString()}`} 
                      icon={DollarSign} 
                      color="#3B82F6"
                      subtitle="Total amount disbursed"
                    />
                    <StatCard 
                      title="Total Collected" 
                      value={`₱${stats.totalPaid.toLocaleString()}`} 
                      icon={TrendingUp} 
                      color="#10B981" 
                      trend={`${stats.collectionRate.toFixed(1)}% rate`}
                      subtitle={`${stats.totalPayments} payments`}
                    />
                    <StatCard 
                      title="Outstanding" 
                      value={`₱${stats.outstanding.toLocaleString()}`} 
                      icon={AlertCircle} 
                      color="#F59E0B"
                      subtitle="Amount due"
                    />
                    <StatCard 
                      title="Active Borrowers" 
                      value={stats.activeBorrowers} 
                      icon={Users} 
                      color="#8B5CF6"
                      subtitle={`${stats.activeLoans} active loans`}
                    />
                  </div>

                  {/* Recent Activity */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText size={24} className="text-blue-600" />
                        Recent Loans
                      </h3>
                      <div className="space-y-3">
                        {loans.slice(-5).reverse().map(loan => {
                          const borrower = borrowers.find(b => b.id === loan.borrowerid);
                          return (
                            <div key={loan.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:shadow-md transition-all">
                              <div>
                                <p className="font-bold text-gray-900">{borrower?.name || 'Unknown'}</p>
                                <p className="text-sm text-gray-600 capitalize">{loan.type?.replace('-', ' ')}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900">₱{parseFloat(loan.principal || 0).toLocaleString()}</p>
                                <p className="text-sm text-gray-600">{loan.rate}% • {loan.term}mo</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <CheckCircle size={24} className="text-green-600" />
                        Recent Payments
                      </h3>
                      <div className="space-y-3">
                        {payments.slice(-5).reverse().map(payment => {
                          const borrower = borrowers.find(b => b.id === payment.borrowerid);
                          return (
                            <div key={payment.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                  <Check size={20} className="text-white" />
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{borrower?.name || 'Unknown'}</p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(payment.paymentdate).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <p className="font-bold text-green-600 text-lg">₱{parseFloat(payment.amount || 0).toFixed(2)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'borrowers' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Manage Borrowers</h2>
                  <AddBorrowerForm onSuccess={loadData} />

                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-between">
                      <span>All Borrowers ({borrowers.length})</span>
                    </h3>
                    
                    {borrowers.length === 0 ? (
                      <div className="text-center py-12">
                        <Users size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-600 text-lg">No borrowers yet. Add one above!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {borrowers.map(borrower => {
                          const borrowerLoans = loans.filter(l => l.borrowerid === borrower.id);
                          const loan = borrowerLoans[0];
                          const borrowerPayments = payments.filter(p => p.borrowerid === borrower.id);
                          const totalBorrowed = borrowerLoans.reduce((sum, l) => sum + parseFloat(l.principal || 0), 0);
                          const totalPaid = borrowerPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                          const progress = totalBorrowed > 0 ? (totalPaid / totalBorrowed) * 100 : 0;

                          return (
                            <div key={borrower.id} className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all cursor-pointer hover:border-blue-400" onClick={() => setSelectedBorrower(borrower)}>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                  {borrower.photo ? (
                                    <img src={borrower.photo} alt={borrower.name} className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-lg" />
                                  ) : (
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                                      {borrower.name.charAt(0)}
                                    </div>
                                  )}
                                  <div>
                                    <h3 className="font-bold text-gray-900 text-xl">{borrower.name}</h3>
                                    {loan && <p className="text-gray-600">₱{parseFloat(loan.principal || 0).toLocaleString()} @ {loan.rate}%</p>}
                                    <p className="text-sm text-gray-500">ID: {borrower.id}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600">Progress</p>
                                    <p className="text-2xl font-bold text-blue-600">{progress.toFixed(1)}%</p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBorrower(borrower);
                                    }}
                                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold shadow-lg"
                                  >
                                    View Profile
                                  </button>
                                </div>
                              </div>
                              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'applications' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Loan Applications</h2>
                  
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      Pending Applications ({applications.filter(a => a.status === 'pending').length})
                    </h3>
                    
                    {applications.filter(a => a.status === 'pending').length === 0 ? (
                      <div className="text-center py-12">
                        <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-600 text-lg">No pending applications</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {applications.filter(a => a.status === 'pending').map(app => (
                          <ApplicationItem 
                            key={app.id} 
                            app={app} 
                            onApprove={approveLoanApplication} 
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* All Applications */}
                  <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">All Applications</h3>
                    <div className="space-y-3">
                      {applications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(app => (
                        <div key={app.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <p className="font-bold text-gray-900">{app.borrowername}</p>
                            <p className="text-sm text-gray-600">₱{parseFloat(app.amount).toLocaleString()} • {app.term} months</p>
                            <p className="text-xs text-gray-500">{new Date(app.timestamp).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-4 py-2 rounded-lg font-bold ${
                            app.status === 'approved' ? 'bg-green-100 text-green-700' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {app.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
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
  if (currentView === 'borrower-profile') return <BorrowerProfileView />;
  return <AdminDashboard />;
};

export default LoanManagementSystem;
