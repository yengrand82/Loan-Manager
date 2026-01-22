import React, { useState, useEffect } from 'react';
import { DollarSign, Users, FileText, LogOut, Plus, Trash2, Home, TrendingUp, Activity, AlertCircle, X, Check, Paperclip, Send, Calendar, ArrowLeft, Upload, Download, MessageSquare } from 'lucide-react';

// IMPORTANT: Replace with your Google Sheets Web App URL
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzN5S5EzI9JEcKuyr5VpAtk9Cnyn8oCNyDqPLZcc4eXr3KBPmuE4xvpegXkBIqc9ls/exec';

const LoanManagementSystem = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [borrowers, setBorrowers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState(null);

  // Loan calculation functions
  const calculateMonthlyPayment = (principal, rate, term, type) => {
    const schedule = [];
    const monthlyRate = rate / 100;
    
    if (type === 'interest-only') {
      const monthlyInterest = (principal * rate) / 100;
      for (let i = 1; i <= term; i++) {
        schedule.push({
          month: i,
          payment: i === term ? principal + monthlyInterest : monthlyInterest,
          principal: i === term ? principal : 0,
          interest: monthlyInterest,
          balance: i === term ? 0 : principal,
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
      const [borrowersRes, loansRes, paymentsRes, messagesRes] = await Promise.all([
        fetch(`${GOOGLE_SHEETS_URL}?action=getBorrowers`).then(r => r.json()),
        fetch(`${GOOGLE_SHEETS_URL}?action=getLoans`).then(r => r.json()),
        fetch(`${GOOGLE_SHEETS_URL}?action=getPayments`).then(r => r.json()),
        fetch(`${GOOGLE_SHEETS_URL}?action=getMessages`).then(r => r.json())
      ]);
      
      setBorrowers(borrowersRes || []);
      setLoans(loansRes || []);
      setPayments(paymentsRes || []);
      setMessages(messagesRes || []);
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
      
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addPayment',
          data: payment
        })
      });
      
      await loadData();
      alert('✅ Payment marked as paid!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  // Send message
  const sendMessage = async (messageText, attachment) => {
    try {
      const message = {
        id: `MSG${Date.now()}`,
        senderid: currentUser.id,
        receiverid: currentUser.type === 'admin' ? selectedBorrower.id : 'admin',
        message: messageText,
        image: attachment || '',
        timestamp: new Date().toISOString(),
        read: false
      };
      
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'sendMessage',
          data: message
        })
      });
      
      await loadData();
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
          setCurrentUser({ ...borrower, type: 'borrower' });
          setSelectedBorrower(borrower);
          setCurrentView('borrower-profile');
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

        // Calculate schedule
        const schedule = calculateMonthlyPayment(
          parseFloat(formData.principal),
          parseFloat(formData.rate),
          parseInt(formData.term),
          formData.type
        );

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

  // Borrower Profile View
  const BorrowerProfileView = () => {
    const borrower = selectedBorrower;
    const borrowerLoans = loans.filter(l => l.borrowerid === borrower.id);
    const loan = borrowerLoans[0];
    const borrowerPayments = payments.filter(p => p.borrowerid === borrower.id);
    const borrowerMessages = messages.filter(m => 
      (m.senderid === borrower.id && m.receiverid === 'admin') ||
      (m.senderid === 'admin' && m.receiverid === borrower.id)
    );

    const [newMessage, setNewMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [showPaymentProof, setShowPaymentProof] = useState(null);
    const [uploadingProof, setUploadingProof] = useState(false);

    let schedule = [];
    if (loan && loan.schedule) {
      try {
        schedule = typeof loan.schedule === 'string' ? JSON.parse(loan.schedule) : loan.schedule;
      } catch (e) {
        schedule = calculateMonthlyPayment(loan.principal, loan.rate, loan.term, loan.type);
      }
    }

    const paidMonths = borrowerPayments.map(p => parseInt(p.month));

    const handleFileUpload = (e, isMessage = true) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMessage) {
            setAttachment(reader.result);
          } else {
            setShowPaymentProof(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const handleSendMessage = async () => {
      if (!newMessage.trim() && !attachment) return;
      
      await sendMessage(newMessage, attachment);
      setNewMessage('');
      setAttachment(null);
    };

    const handleMarkAsPaid = async (month, amount) => {
      if (!showPaymentProof) {
        alert('Please upload payment proof first');
        return;
      }
      
      setUploadingProof(true);
      await markPaymentAsPaid(loan.id, month, amount, showPaymentProof);
      setShowPaymentProof(null);
      setUploadingProof(false);
    };

    const totalPaid = borrowerPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalLoan = loan ? parseFloat(loan.principal) : 0;
    const progress = totalLoan > 0 ? (totalPaid / totalLoan) * 100 : 0;

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button 
              onClick={() => {
                setSelectedBorrower(null);
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
              <div>
                <h1 className="text-3xl font-bold">{borrower.name}</h1>
                <p className="text-blue-100">ID: {borrower.id}</p>
              </div>
              {currentUser.type === 'borrower' && (
                <button onClick={() => { setCurrentUser(null); setCurrentView('login'); }} className="px-4 py-2 bg-white/20 backdrop-blur-lg text-white rounded-lg hover:bg-white/30 transition-all flex items-center gap-2">
                  <LogOut size={18} /> Logout
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Profile & Loan Details */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile & Loan Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Contact</p>
                <p className="text-lg font-semibold text-gray-900">{borrower.contact}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="text-lg font-semibold text-gray-900">{borrower.email || 'N/A'}</p>
              </div>
              
              {loan && (
                <>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Loan Amount</p>
                    <p className="text-2xl font-bold text-gray-900">₱{parseFloat(loan.principal).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Interest Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{loan.rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Term</p>
                    <p className="text-lg font-semibold text-gray-900">{loan.term} months</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Loan Type</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{loan.type?.replace('-', ' ')}</p>
                  </div>
                </>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Payment Progress</span>
                <span className="text-sm font-bold text-blue-600">{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>Paid: ₱{totalPaid.toLocaleString()}</span>
                <span>Total: ₱{totalLoan.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Monthly Payments */}
          {loan && schedule.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Monthly Payments</h2>
              
              <div className="space-y-3">
                {schedule.map((payment, idx) => {
                  const isPaid = paidMonths.includes(payment.month);
                  const paymentRecord = borrowerPayments.find(p => parseInt(p.month) === payment.month);
                  
                  return (
                    <div key={idx} className={`border rounded-lg p-4 transition-all ${isPaid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPaid ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {isPaid ? <Check size={20} className="text-white" /> : <span className="text-white font-bold">{payment.month}</span>}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">Month {payment.month}</p>
                            <p className="text-sm text-gray-600">Due: {new Date(payment.dueDate).toLocaleDateString()}</p>
                            <p className="text-lg font-semibold text-gray-900">₱{payment.payment.toFixed(2)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {isPaid ? (
                            <div className="text-right">
                              <span className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold flex items-center gap-2">
                                <Check size={16} /> Paid
                              </span>
                              {paymentRecord && paymentRecord.paymentdate && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {new Date(paymentRecord.paymentdate).toLocaleDateString()}
                                </p>
                              )}
                              {paymentRecord && paymentRecord.proof && (
                                <button
                                  onClick={() => window.open(paymentRecord.proof, '_blank')}
                                  className="text-xs text-blue-600 hover:underline mt-1"
                                >
                                  View Proof
                                </button>
                              )}
                            </div>
                          ) : currentUser.type === 'admin' ? (
                            <div>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => handleFileUpload(e, false)}
                                className="hidden"
                                id={`proof-${payment.month}`}
                              />
                              <label
                                htmlFor={`proof-${payment.month}`}
                                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-semibold cursor-pointer hover:bg-blue-200 transition-all flex items-center gap-2"
                              >
                                <Upload size={16} /> Upload Proof
                              </label>
                              {showPaymentProof && (
                                <button
                                  onClick={() => handleMarkAsPaid(payment.month, payment.payment)}
                                  disabled={uploadingProof}
                                  className="mt-2 w-full px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:bg-gray-400"
                                >
                                  {uploadingProof ? 'Marking...' : 'Mark as Paid'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg font-semibold">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare size={24} />
              Messages
            </h2>
            
            <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
              {borrowerMessages.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No messages yet. Start a conversation!</p>
              ) : (
                borrowerMessages.map(msg => {
                  const isSentByMe = msg.senderid === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md p-4 rounded-lg ${isSentByMe ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                        {msg.image && (
                          <div className="mb-2">
                            <a href={msg.image} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 ${isSentByMe ? 'text-blue-100' : 'text-blue-600'} hover:underline`}>
                              <Paperclip size={16} />
                              Attachment
                            </a>
                          </div>
                        )}
                        <p className="break-words">{msg.message}</p>
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
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => handleFileUpload(e, true)}
                className="hidden"
                id="message-attachment"
              />
              <label
                htmlFor="message-attachment"
                className="cursor-pointer p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
              >
                <Paperclip size={20} className="text-gray-600" />
              </label>
              
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              
              <button
                onClick={handleSendMessage}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-all flex items-center gap-2"
              >
                <Send size={18} />
                Send
              </button>
            </div>
            
            {attachment && (
              <div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                <Paperclip size={16} />
                File attached
                <button onClick={() => setAttachment(null)} className="text-red-500 hover:underline">Remove</button>
              </div>
            )}
          </div>
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
                            <div key={borrower.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer" onClick={() => setSelectedBorrower(borrower)}>
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBorrower(borrower);
                                    }}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold"
                                  >
                                    View Profile
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
  if (currentView === 'borrower-profile') return <BorrowerProfileView />;
  return <AdminDashboard />;
};

export default LoanManagementSystem;
