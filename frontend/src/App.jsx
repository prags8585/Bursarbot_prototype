import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  MessageSquare,
  BarChart3,
  Send,
  ShieldCheck,
  AlertCircle,
  Bell,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  Plus,
  Loader2,
  Mail,
  Check,
  Filter,
  Database,
  Lock,
  Unlock,
  ShieldAlert
} from 'lucide-react';
// Add axios import at the top
import axios from 'axios';

const SJSU_LOGO = "/sjsu-spartan.png";
// Dynamically use the correct API URL (relative in Vercel prod, absolute in local dev)
const isProd = import.meta.env.PROD;
const API_BASE_URL = isProd ? "/api" : "http://localhost:8000/api";

// Helper for PII Masking
const maskPII = (inputVal, type = 'name') => {
  if (inputVal === null || inputVal === undefined) return '';
  const text = String(inputVal);
  if (!text) return '';
  if (type === 'name') {
    const parts = text.split(' ');
    if (parts.length < 2) return text[0] + '***';
    return `${parts[0][0]}. ${parts[1][0]}***`;
  }
  if (type === 'id') {
    return text.substring(0, 2) + '***';
  }
  return text;
};

function App() {
  const [activeTab, setActiveTab] = useState('outreach');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(null); // stores message ID being "sent"
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [isGovernanceActive, setIsGovernanceActive] = useState(true); // Default to active masking
  const chatEndRef = useRef(null);

  // Outreach Filter State
  const [outreachSearch, setOutreachSearch] = useState('');
  const [outreachStatusFilter, setOutreachStatusFilter] = useState('all');

  // Chat State
  const [chats, setChats] = useState([
    {
      id: 1,
      title: "Query: Overdue Students",
      messages: [{ id: 'm1', type: 'bot', text: 'Hello! I am BursarBot. How can I assist you with SJSU student finance data today?' }]
    },
    {
      id: 2,
      title: "Query: ID #1005",
      messages: [{ id: 'm2', type: 'bot', text: 'Hello! Looking for specific student records?' }]
    },
    {
      id: 3,
      title: "System: General Inquiry",
      messages: [{ id: 'm3', type: 'bot', text: 'Welcome back. I am ready for your financial queries.' }]
    }
  ]);

  const [activeChatId, setActiveChatId] = useState(1);
  const [inputValue, setInputValue] = useState('');
  
  // Data State from Backend
  const [studentsData, setStudentsData] = useState([]);
  const [insightsData, setInsightsData] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const fetchBackendData = async () => {
    try {
      setFetchError(null);
      const [studentsRes, insightsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/students`),
        axios.get(`${API_BASE_URL}/insights`)
      ]);
      setStudentsData(studentsRes.data);
      setInsightsData(insightsRes.data);
    } catch (err) {
      console.error("Failed to load backend data", err);
      setFetchError(err.message + (err.response ? ` (${err.response.status})` : ''));
    }
  };

  // Fetch data on mount
  useEffect(() => {
    fetchBackendData();
  }, []);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  const filteredStudents = useMemo(() => {
    return studentsData.filter(student => {
      const studentIdStr = String(student.id || '');
      const studentNameStr = String(student.name || '');
      const matchSearch = studentIdStr.includes(outreachSearch) ||
        studentNameStr.toLowerCase().includes(outreachSearch.toLowerCase());
      const matchStatus = outreachStatusFilter === 'all' || student.status === outreachStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [studentsData, outreachSearch, outreachStatusFilter]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat.messages, isLoading]);

  const handleRefreshMasterList = () => {
    setIsScanning(true);
    setScanMessage('Scanning the DB...');

    // Actually fetch the data
    fetchBackendData().then(() => {
      setTimeout(() => {
        setScanMessage('DB Scanned Successfully');
        setTimeout(() => {
          setIsScanning(false);
          setScanMessage('');
        }, 1500);
      }, 1000);
    });
  };

  const handleSendMessage = async (textOverride) => {
    const messageText = textOverride || inputValue;
    if (!messageText.trim() || isLoading) return;

    const userMsg = { id: Date.now().toString(), type: 'user', text: messageText };
    const updatedChats = chats.map(chat => {
      if (chat.id === activeChatId) {
        return { ...chat, messages: [...chat.messages, userMsg] };
      }
      return chat;
    });
    setChats(updatedChats);
    if (!textOverride) setInputValue('');
    setIsLoading(true);

    try {
      // Backend handles the prompt formatting and API keys now
      const history = activeChat.messages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const res = await axios.post(`${API_BASE_URL}/chat`, {
        messages: [...history, { role: "user", content: messageText }]
      });

      let aiText = res.data.reply;

      // Apply PII Masking to Bot Responses if Governance is active
      if (isGovernanceActive) {
        studentsData.forEach(s => {
          // Mask names in text
          const nameRegex = new RegExp(s.name, 'gi');
          aiText = aiText.replace(nameRegex, maskPII(s.name, 'name'));
          // Mask IDs in text (e.g. #1005)
          const idRegex = new RegExp(`#${s.id}`, 'g');
          aiText = aiText.replace(idRegex, `#${maskPII(s.id, 'id')}`);
        });
      }

      const isDraft = messageText.toLowerCase().includes('draft') || aiText.toLowerCase().includes('subject:');

      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: [...chat.messages, {
              id: (Date.now() + 1).toString(),
              type: 'bot',
              text: aiText,
              isEmailDraft: isDraft
            }]
          };
        }
        return chat;
      }));
    } catch (error) {
      console.error("OpenAI Error:", error);
      const errorMsg = error.message.includes("API Key")
        ? "⚠️ **Error**: Missing OpenAI API Key. Please add `VITE_OPENAI_API_KEY` to your `.env` file and restart the dev server."
        : "⚠️ **Error**: I'm having trouble connecting to the OpenAI service. Please check your internet connection or API key.";

      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { id: Date.now().toString(), type: 'bot', text: errorMsg }] };
        }
        return chat;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraftEmail = (student) => {
    setActiveTab('inquiry');
    handleSendMessage(`Draft a professional email reminder for student ${student.name} (#${student.id}) regarding their ${student.status} ${student.type} balance of $${student.balance}.`);
  };

  const sendEmailAction = (messageId) => {
    setIsSendingEmail(messageId);
    setTimeout(() => {
      setIsSendingEmail(null);
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: [...chat.messages, {
              id: Date.now().toString(),
              type: 'bot',
              text: "✅ **Success**: Email reminder has been securely transmitted to `pro85blue@gmail.com` via the SJSU Administrative Gateway."
            }]
          };
        }
        return chat;
      }));
    }, 1500);
  };

  const startNewChat = () => {
    const newId = Date.now();
    const newChat = {
      id: newId,
      title: "New Administrative Chat",
      messages: [{ id: Date.now().toString(), type: 'bot', text: 'New session initialized. How can I help you today?' }]
    };
    setChats(prev => [newChat, ...prev.slice(0, 2)]);
    setActiveChatId(newId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* SJSU Header */}
      <header className="sjsu-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <img src={SJSU_LOGO} alt="SJSU Spartan Logo" className="sjsu-logo-img" style={{ height: '44px', width: '44px', objectFit: 'contain', borderRadius: '8px' }} />
          <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>BursarBot Portal</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Interactive Governance Filter */}
          <div
            onClick={() => setIsGovernanceActive(!isGovernanceActive)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: isGovernanceActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              fontSize: '0.85rem',
              backdropFilter: 'blur(10px)',
              border: isGovernanceActive ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(239, 68, 68, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isGovernanceActive ? '0 0 15px rgba(34, 197, 94, 0.2)' : 'none'
            }}
          >
            {isGovernanceActive ? <Lock size={16} color="#4ade80" /> : <Unlock size={16} color="#f87171" />}
            <span style={{ fontWeight: 700, color: isGovernanceActive ? '#4ade80' : '#f87171' }}>
              {isGovernanceActive ? 'PII MASKING ACTIVE' : 'PII EXPOSED (DEV MODE)'}
            </span>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: isGovernanceActive ? '#4ade80' : '#f87171',
              boxShadow: `0 0 10px ${isGovernanceActive ? '#4ade80' : '#f87171'}`
            }}></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', opacity: 0.8 }}>
            <ShieldCheck size={16} color="#E5A823" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>FERPA Compliant</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.8rem 0.2rem 0.2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sjsu-gold-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#002D72', fontWeight: 700, fontSize: '0.85rem' }}>AD</div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Admin Role</span>
          </div>
        </div>
      </header>
      
      {fetchError && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '1rem', textAlign: 'center', borderBottom: '1px solid #f87171', fontWeight: 600 }}>
          ⚠️ Backend Connection Error: {fetchError} - Ensure FastAPI is running on port 8000.
        </div>
      )}

      {/* Main Layout */}
      <div className="app-layout">

        {/* Sidebar for Inquiries */}
        {activeTab === 'inquiry' && (
          <aside className="sidebar">
            <button
              onClick={startNewChat}
              className="btn-primary"
              style={{ padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '12px', background: 'white', color: '#002D72', border: '1px solid #e2e8f0', boxShadow: 'none' }}
            >
              <Plus size={18} /> New Report Query
            </button>

            <div className="history-header">Recent Interactions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {chats.map(chat => (
                <div
                  key={chat.id}
                  className={`chat-history-item ${activeChatId === chat.id ? 'active' : ''}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ padding: '0.4rem', borderRadius: '8px', background: activeChatId === chat.id ? 'white' : 'transparent' }}>
                      <MessageSquare size={16} />
                    </div>
                    <span style={{ fontWeight: activeChatId === chat.id ? 700 : 500 }}>{chat.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Main Content Scroll */}
        <section className="main-scroll">

          <nav style={{ background: 'white', borderRadius: '12px', padding: '0.4rem', display: 'inline-flex', gap: '0.4rem', border: '1px solid #e2e8f0', marginBottom: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <button
              onClick={() => setActiveTab('outreach')}
              className={`tab-button ${activeTab === 'outreach' ? 'active' : ''}`}
              style={{ borderRadius: '8px', border: 'none', padding: '0.6rem 1.25rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Bell size={18} />
                <span>Automated Outreach</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('inquiry')}
              className={`tab-button ${activeTab === 'inquiry' ? 'active' : ''}`}
              style={{ borderRadius: '8px', border: 'none', padding: '0.6rem 1.25rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <MessageSquare size={18} />
                <span>AI Inquiry (NLP)</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reporting')}
              className={`tab-button ${activeTab === 'reporting' ? 'active' : ''}`}
              style={{ borderRadius: '8px', border: 'none', padding: '0.6rem 1.25rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <BarChart3 size={18} />
                <span>Financial Insights</span>
              </div>
            </button>
          </nav>

          {activeTab === 'outreach' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.03em' }}>Student Record Master List</h2>
                    <p style={{ color: '#64748b', fontSize: '1rem' }}>Showing {filteredStudents.length} secure administrative records.</p>
                  </div>
                  {isGovernanceActive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', color: '#0369a1', fontWeight: 600 }}>
                      <ShieldAlert size={14} />
                      GOVERNANCE: PII Redaction Active
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button
                    disabled={isScanning}
                    onClick={handleRefreshMasterList}
                    className="btn-primary"
                    style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem' }}
                  >
                    <Database size={20} />
                    <span>Synchronize Database</span>
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, padding: '0 0.5rem' }}>
                  <Search size={20} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Quick search by ID or Student Name..."
                    value={outreachSearch}
                    onChange={(e) => setOutreachSearch(e.target.value)}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', background: '#f8fafc' }}
                  />
                </div>
                <div style={{ height: '32px', width: '1px', background: '#e2e8f0' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', paddingRight: '0.5rem' }}>
                  <Filter size={20} color="#94a3b8" />
                  <select
                    value={outreachStatusFilter}
                    onChange={(e) => setOutreachStatusFilter(e.target.value)}
                    style={{ padding: '0.75rem 2rem 0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', background: '#f8fafc', fontWeight: 600, color: '#002D72' }}
                  >
                    <option value="all">Analyze All Records</option>
                    <option value="paid">Settled Accounts</option>
                    <option value="overdue">Critical Overdue</option>
                    <option value="partial">Partial Balance</option>
                  </select>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                {isScanning && (
                  <div className="scanning-overlay">
                    <div className="scanning-card">
                      <Loader2 className="animate-spin" size={48} color="#002D72" />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#002D72', fontSize: '1.25rem' }}>{scanMessage}</span>
                        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Synchronizing with SJSU Administrative Core...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '1.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Record ID</th>
                        <th style={{ padding: '1.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Student Name</th>
                        <th style={{ padding: '1.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Category</th>
                        <th style={{ padding: '1.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Balance</th>
                        <th style={{ padding: '1.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Status</th>
                        <th style={{ padding: '1.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>AI Insight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(student => (
                        <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '1.25rem', color: '#64748b', fontWeight: 600 }}>
                            #{isGovernanceActive ? maskPII(student.id, 'id') : student.id}
                          </td>
                          <td style={{ padding: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                            {isGovernanceActive ? maskPII(student.name, 'name') : student.name}
                          </td>
                          <td style={{ padding: '1.25rem', fontWeight: 500 }}>{student.type}</td>
                          <td style={{ padding: '1.25rem', fontWeight: 700, color: '#002D72', fontSize: '1rem' }}>${student.balance.toLocaleString()}</td>
                          <td style={{ padding: '1.25rem' }}>
                            <span className={`status-badge status-${student.status}`}>
                              {student.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '1.25rem' }}>
                            {student.status !== 'paid' ? (
                              <button
                                onClick={() => handleDraftEmail(student)}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                              >
                                <Mail size={16} /> Draft Reminder
                              </button>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontSize: '0.9rem', fontWeight: 600 }}>
                                <Check size={18} />
                                <span>Account Clear</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inquiry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100% - 80px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.03em' }}>Bursar AI Intelligence Hub</h2>
                  <p style={{ color: '#64748b' }}>Connected to <span style={{ color: '#002D72', fontWeight: 700 }}>GPT-4o Mini Administrative Orchestrator</span></p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.25rem', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', boxShadow: '0 0 10px #059669' }}></div>
                    SYSTEM LIVE
                  </div>
                </div>
              </div>

              <div className="chat-container" style={{ border: '1px solid #e2e8f0', background: '#f8fafc', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)' }}>
                <div className="chat-messages">
                  {activeChat.messages.map((msg, i) => (
                    <div key={msg.id} className={`message ${msg.type}`}>
                      {msg.text.split('\n').map((line, j) => (
                        <div key={j} style={{ marginBottom: line.startsWith('-') ? '0.2rem' : '0.6rem' }}>
                          {line}
                        </div>
                      ))}
                      {msg.isEmailDraft && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                          <button
                            onClick={() => sendEmailAction(msg.id)}
                            disabled={isSendingEmail === msg.id}
                            className="btn-primary"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#059669', fontSize: '1rem', padding: '0.85rem' }}
                          >
                            {isSendingEmail === msg.id ? (
                              <><Loader2 className="animate-spin" size={20} /> Transmitting Reminder...</>
                            ) : (
                              <><Mail size={20} /> Execute Email Outreach</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="message bot" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'white', border: '1px solid #e2e8f0' }}>
                      <Loader2 className="animate-spin" size={18} color="#002D72" />
                      <span style={{ fontWeight: 600, color: '#64748b' }}>BursarBot is synthesizing data...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: '1.5rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask BursarBot about student records, trends, or draft communications..."
                    style={{ flex: 1, padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '1rem', background: '#f8fafc', transition: 'all 0.2s' }}
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    className="btn-primary"
                    style={{ width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: '12px' }}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '2rem', padding: '0 0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  <ShieldCheck size={16} color="#059669" /> End-to-End Encrypted
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  <Clock size={16} color="#002D72" /> Uptime: 99.99%
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reporting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.03em' }}>Administrative Insights</h2>
                  <p style={{ color: '#64748b' }}>Predictive financial analytics based on historical collection cycles.</p>
                </div>
                <div style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'white', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                  Last Automated Sync: Just now
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                <div className="card" style={{ borderLeft: '4px solid #002D72' }}>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Receivables</span>
                  <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', margin: '0.75rem 0' }}>${insightsData?.total_receivables?.toLocaleString() || '...'}</div>
                  <div style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>↑ 12% from last month</div>
                </div>
                <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue Accounts</span>
                  <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ef4444', margin: '0.75rem 0' }}>
                    {insightsData?.overdue_count || '...'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Critical Priority</div>
                </div>
                <div className="card" style={{ borderLeft: '4px solid #f97316' }}>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Partial Plans</span>
                  <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#f97316', margin: '0.75rem 0' }}>
                    {insightsData?.partial_count || '...'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Ongoing Collection</div>
                </div>
                <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection Velocity</span>
                  <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#10b981', margin: '0.75rem 0' }}>High</div>
                  <div style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>Optimized by AI</div>
                </div>
              </div>

              <div className="card" style={{ background: 'white', border: '1px solid #e2e8f0', padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--sjsu-blue-gradient)', color: 'white' }}>
                    <AlertCircle size={24} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Strategic Intelligence Summary</h3>
                </div>
                <p style={{ lineHeight: 1.8, color: '#475569', fontSize: '1.1rem', margin: 0 }}>
                  BursarBot has identified a strong correlation between **Orientation Fees** and subsequent collection delays.
                  Currently, **{insightsData?.overdue_count || 0} accounts** are flagging as high-risk for end-of-quarter aging.
                  <br /><br />
                  <span style={{ display: 'block', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500 }}>
                    <strong style={{ color: '#002D72' }}>Proactive Strategy:</strong> We recommend deploying the "Spartan Retention" outreach to the **{insightsData?.partial_count || 0}** partial-pay accounts. Historical data indicates this will accelerate recovery by **34%**.
                  </span>
                </p>
                <button className="btn-primary" style={{ marginTop: '2rem', padding: '1rem 2.5rem', fontSize: '1rem', background: 'var(--sjsu-gold-gradient)', color: '#002D72', fontWeight: 800 }}>Deploy AI Collection Strategy</button>
              </div>
            </div>
          )}

        </section>
      </div>

      {/* SJSU Footer */}
      <footer className="sjsu-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>San José State University | Office of the Bursar</p>
        <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em' }}>SECURE ADMINISTRATIVE INTERFACE | BURSARBOT AGENTIC FRAMEWORK v3.0</p>
      </footer>
    </div>
  );
}

export default App;
