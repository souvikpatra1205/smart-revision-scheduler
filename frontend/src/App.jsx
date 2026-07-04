import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BellRing,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Moon,
  PieChart,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Sun,
  Target,
  Trash2,
  User,
  UserCircle,
} from 'lucide-react';
import {
  addTopic,
  clearToken,
  completeRevision,
  completeRegistration,
  deleteTopic,
  getCalendar,
  getDashboard,
  getNoteFileBlob,
  getStatistics,
  getStoredToken,
  login,
  loginWithGoogle,
  requestPasswordReset,
  requestRegistrationOtp,
  resetPassword,
  storeToken,
  uploadNoteFiles,
} from './api';

const toLocalIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayIso = () => toLocalIsoDate(new Date());

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T00:00:00`));

const canCompleteRevision = (revisionDate) => revisionDate <= todayIso();

const initialDashboard = {
  topicsLearned: 0,
  revisionsCompleted: 0,
  currentStreak: 0,
  memoryScore: 0,
  today: [],
  tomorrow: [],
  nextWeek: [],
};

const initialStatistics = {
  weeklyActivity: [],
  revisionConsistency: [],
  subjects: [],
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const revisionDays = [1, 3, 7, 14, 30, 60, 90];
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getStoredToken()));
  const [activeView, setActiveView] = useState('dashboard');
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [statistics, setStatistics] = useState(initialStatistics);
  const [calendarItems, setCalendarItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await getDashboard();
      setDashboard(data);
    } catch {
      setDashboard(initialDashboard);
    }

    try {
      const statsData = await getStatistics();
      setStatistics(statsData);
    } catch {
      setStatistics(initialStatistics);
    }

    const start = new Date(2024, 0, 1);
    const end = new Date(2099, 11, 31);
    try {
      const calendarData = await getCalendar(toLocalIsoDate(start), toLocalIsoDate(end));
      setCalendarItems(calendarData);
    } catch {
      setCalendarItems([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isAuthenticated) {
      refresh().catch(() => {
        setLoading(false);
      });
    }
  }, [isAuthenticated]);

  const filteredToday = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return dashboard.today;
    return dashboard.today.filter((item) =>
      `${item.topicName} ${item.subject}`.toLowerCase().includes(search)
    );
  }, [dashboard.today, query]);

  async function handleComplete(id) {
    await completeRevision(id);
    await refresh();
  }

  async function handleDeleteTopic(topicId, topicName) {
    const confirmed = window.confirm(`Delete "${topicName}" and all its revision dates?`);
    if (!confirmed) return;
    await deleteTopic(topicId);
    await refresh();
  }

  async function handleNotify() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const topics = dashboard.today.map((item) => item.topicName).join('\n');
    new Notification('Time to revise!', {
      body: topics ? `Today's topics:\n${topics}\n\n10 minutes only.` : 'No revisions due today.',
    });
  }

  function handleLogout() {
    clearToken();
    setIsAuthenticated(false);
    setDashboard(initialDashboard);
  }

  function openNotes(item) {
    setSelectedNotes(item);
  }

  function closeNotes() {
    setSelectedNotes(null);
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className={darkMode ? 'app-shell theme-dark' : 'app-shell'}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SR</span>
          <span>Smart Revision</span>
        </div>
        <button className={activeView === 'dashboard' ? 'nav-btn active' : 'nav-btn'} onClick={() => setActiveView('dashboard')} title="Dashboard">
          <LayoutDashboard size={18} />
          Dashboard
        </button>
        <button className={activeView === 'add' ? 'nav-btn active' : 'nav-btn'} onClick={() => setActiveView('add')} title="Add topic">
          <Plus size={18} />
          Add Topic
        </button>
        <button className={activeView === 'calendar' ? 'nav-btn active' : 'nav-btn'} onClick={() => setActiveView('calendar')} title="Calendar">
          <CalendarDays size={18} />
          Calendar
        </button>
        <button className={activeView === 'statistics' ? 'nav-btn active' : 'nav-btn'} onClick={() => setActiveView('statistics')} title="Statistics">
          <BarChart3 size={18} />
          Statistics
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Spaced revision planner</p>
            <h1>Smart Revision Scheduler</h1>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search today" />
            </div>
            <button className="icon-btn" onClick={handleNotify} title="Send browser notification">
              <Bell size={18} />
            </button>
            <button className="icon-btn secondary" onClick={() => setDarkMode((value) => !value)} title="Dark mode">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="profile-chip" title="Profile">
              <UserCircle size={19} />
              <span>Student</span>
            </div>
            <button className="icon-btn secondary" onClick={handleLogout} title="Log out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {activeView === 'dashboard' && (
          <Dashboard
            dashboard={dashboard}
            today={filteredToday}
            loading={loading}
            onComplete={handleComplete}
            onDeleteTopic={handleDeleteTopic}
            onOpenNotes={openNotes}
          />
        )}
        {activeView === 'add' && <AddTopic onAdded={refresh} />}
        {activeView === 'calendar' && <CalendarView items={calendarItems} onComplete={handleComplete} onDeleteTopic={handleDeleteTopic} onOpenNotes={openNotes} />}
        {activeView === 'statistics' && <StatisticsView dashboard={dashboard} statistics={statistics} />}
      </main>

      {selectedNotes && <NotesPage item={selectedNotes} onBack={closeNotes} />}

      <button className="fab" onClick={() => setActiveView('add')} title="Quick add topic">
        <Plus size={22} />
        <span>Add Topic</span>
      </button>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [authPage, setAuthPage] = useState('landing');
  const [mode, setMode] = useState('login');
  const [registerStep, setRegisterStep] = useState('details');
  const [resetStep, setResetStep] = useState('email');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    otp: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openAuth(nextMode) {
    setMode(nextMode);
    setAuthPage('auth');
    setMessage('');
  }

  function backToLanding() {
    setAuthPage('landing');
    setMessage('');
  }

  async function handleLogin(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const response = await login(form.email, form.password);
      storeToken(response.token);
      onLogin();
    } catch {
      setMessage('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setMessage('');
    if (!GOOGLE_CLIENT_ID) {
      setMessage('Google login is not configured yet. Add VITE_GOOGLE_CLIENT_ID in frontend/.env.');
      return;
    }

    try {
      const credential = await requestGoogleCredential();
      const response = await loginWithGoogle(credential);
      storeToken(response.token);
      onLogin();
    } catch {
      setMessage('Google login failed. Please try again.');
    }
  }

  async function handleRequestRegistrationOtp(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      setSubmitting(false);
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      setSubmitting(false);
      return;
    }
    try {
      const response = await requestRegistrationOtp(form.email);
      setForm((current) => ({ ...current, password, confirmPassword }));
      setRegisterStep('otp');
      setMessage(response.testOtp ? `Testing OTP: ${response.testOtp}` : 'OTP sent to your email.');
    } catch (error) {
      setMessage(`Could not send OTP: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteRegistration(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const response = await completeRegistration(form);
      storeToken(response.token);
      onLogin();
    } catch {
      setMessage('Invalid OTP or account details.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestPasswordReset(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const response = await requestPasswordReset(form.email);
      setResetStep('otp');
      setMessage(response.testOtp ? `Testing OTP: ${response.testOtp}` : 'Password reset OTP sent to your email.');
    } catch (error) {
      setMessage(`Could not send reset OTP: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const newPassword = form.newPassword.trim();
    const confirmNewPassword = form.confirmNewPassword.trim();
    if (newPassword !== confirmNewPassword) {
      setMessage('New passwords do not match.');
      setSubmitting(false);
      return;
    }
    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters.');
      setSubmitting(false);
      return;
    }
    try {
      await resetPassword({ ...form, newPassword, confirmNewPassword });
      setMode('login');
      setAuthPage('auth');
      setResetStep('email');
      setMessage('Password reset complete. You can login now.');
    } catch {
      setMessage('Invalid OTP or password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authPage === 'auth') {
    return (
      <AuthPage
        mode={mode}
        setMode={setMode}
        registerStep={registerStep}
        setRegisterStep={setRegisterStep}
        resetStep={resetStep}
        form={form}
        updateField={updateField}
        message={message}
        submitting={submitting}
        onBack={backToLanding}
        onLogin={handleLogin}
        onRequestRegistrationOtp={handleRequestRegistrationOtp}
        onCompleteRegistration={handleCompleteRegistration}
        onRequestPasswordReset={handleRequestPasswordReset}
        onResetPassword={handleResetPassword}
        onGoogleLogin={handleGoogleLogin}
      />
    );
  }

  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <a className="landing-brand" href="#home" aria-label="Smart Revision Scheduler home">
          <span className="landing-logo">
            <CalendarCheck size={25} />
          </span>
          <span>Smart <strong>Revision Scheduler</strong></span>
        </a>
        <div className="landing-links">
          <a className="active" href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#auth">Pricing</a>
          <a href="#auth">About Us</a>
        </div>
        <div className="landing-actions">
          <button className="nav-login" type="button" onClick={() => openAuth('login')}>Log In</button>
          <button className="nav-primary" type="button" onClick={() => openAuth('register')}>Get Started</button>
        </div>
      </nav>

      <section id="home" className="landing-hero">
        <div className="hero-copy">
          <span className="hero-pill">Smarter Revision. Better Memory.</span>
          <h1>Study Today, Remember <span>Forever.</span></h1>
          <p>Smart Revision Scheduler helps you remember what you learn using spaced repetition. Add a topic once and we will remind you at the perfect time.</p>
          <div className="hero-actions">
            <button className="hero-primary" type="button" onClick={() => openAuth('register')}>
              Get Started for Free
              <ArrowRight size={20} />
            </button>
            <a className="hero-secondary" href="#how-it-works">
              See How It Works
              <PlayCircle size={20} />
            </a>
          </div>
          <div className="social-proof">
            <div className="avatar-row" aria-hidden="true">
              <span>S</span>
              <span>R</span>
              <span>A</span>
              <span>P</span>
            </div>
            <div>
              <strong>★★★★★</strong>
              <p>Loved by 1000+ students</p>
            </div>
          </div>
        </div>

        <div className="hero-visual" aria-label="Dashboard preview">
          <div className="mockup-card">
            <div className="mockup-topbar">
              <Menu size={21} />
              <strong>Smart <span>Revision Scheduler</span></strong>
              <div className="mockup-user">
                <Bell size={18} />
                <span><User size={14} /></span>
              </div>
            </div>
            <div className="mockup-body">
              <aside className="mockup-menu">
                <b><LayoutDashboard size={16} /> Dashboard</b>
                <span><CalendarCheck size={16} /> Topics</span>
                <span><CalendarDays size={16} /> Calendar</span>
                <span><BarChart3 size={16} /> Statistics</span>
                <span><BellRing size={16} /> Reminders</span>
                <em>Logout</em>
              </aside>
              <section className="mockup-main">
                <div className="mockup-greeting">
                  <h2>Hello, Souvik!</h2>
                  <p>Stay consistent and achieve your goals.</p>
                </div>
                <div className="mockup-grid">
                  <div className="mockup-panel revisions-preview">
                    <div className="mockup-panel-title">
                      <h3>Today's Revisions</h3>
                      <span>5</span>
                    </div>
                    {[
                      ['SQL Injection', 'Cyber Security', 'Day 3'],
                      ['Operating System Deadlock', 'Operating System', 'Day 7'],
                      ['Playfair Cipher', 'Cryptography', 'Day 1'],
                      ['B-Tree in DBMS', 'DBMS', 'Day 14'],
                      ['Java Threads', 'Java', 'Day 3'],
                    ].map(([topic, subject, day], index) => (
                      <div className="mockup-revision" key={topic}>
                        <i className={`dot dot-${index + 1}`} />
                        <div>
                          <strong>{topic}</strong>
                          <small>{subject}</small>
                        </div>
                        <span>{day}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mockup-side">
                    <div className="mockup-panel">
                      <h3>Statistics</h3>
                      <p><span>Topics Learned</span><strong>75</strong></p>
                      <p><span>Revisions Completed</span><strong>140</strong></p>
                      <p><span>Current Streak</span><strong>18 Days</strong></p>
                      <p><span>Success Rate</span><strong>92%</strong></p>
                    </div>
                    <div className="mockup-panel">
                      <h3>Next Revisions</h3>
                      <p><span>Tomorrow</span><strong>2</strong></p>
                      <p><span>Next 7 Days</span><strong>6</strong></p>
                      <p><span>Next 30 Days</span><strong>12</strong></p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="section-heading">
          <h2>Everything you need to revise smarter</h2>
          <p>Powerful features designed to help you learn, revise and remember for the long term.</p>
        </div>
        <div className="feature-grid-landing">
          {[
            [CalendarCheck, 'Spaced Repetition', 'Automatically schedules your revisions at the perfect intervals.'],
            [BellRing, 'Smart Reminders', 'Get notified on time so you never miss a revision again.'],
            [BarChart3, 'Progress Tracking', 'Track your learning progress and build consistent habits.'],
            [CalendarDays, 'Calendar View', 'See all upcoming revisions in a clean calendar.'],
            [PieChart, 'Detailed Statistics', 'Analyze performance with clear memory and streak insights.'],
            [ShieldCheck, 'Secure & Private', 'Your data is safe with verified accounts and private topics.'],
          ].map(([Icon, title, description]) => (
            <article className="feature-card-landing" key={title}>
              <span><Icon size={31} /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="how-section">
        <div className="section-heading">
          <h2>How it works</h2>
          <p>Add one topic, and your Day 1, Day 3, Day 7, Day 14, Day 30, Day 60, and Day 90 plan is created instantly.</p>
        </div>
      </section>
    </main>
  );
}

function AuthPage({
  mode,
  setMode,
  registerStep,
  setRegisterStep,
  resetStep,
  form,
  updateField,
  message,
  submitting,
  onBack,
  onLogin,
  onRequestRegistrationOtp,
  onCompleteRegistration,
  onRequestPasswordReset,
  onResetPassword,
  onGoogleLogin,
}) {
  const isRegister = mode === 'register';
  const title = mode === 'login' ? 'Login' : mode === 'register' ? 'Register' : 'Reset Password';
  const subtitle = mode === 'login'
    ? 'Welcome back! Please login to your account.'
    : mode === 'register'
      ? 'Create your account and start your smart learning journey.'
      : 'Verify your email with OTP and create a new password.';

  function switchMode(nextMode) {
    setMode(nextMode);
  }

  return (
    <main className="auth-screen">
      <section className={`auth-card ${isRegister ? 'register-card' : ''}`}>
        <header className="auth-header">
          <button className="auth-brand" type="button" onClick={onBack}>
            <span className="landing-logo">
              <CalendarCheck size={25} />
            </span>
            <span>
              Smart <strong>Revision Scheduler</strong>
              <small>Study Today, Remember Forever.</small>
            </span>
          </button>
        </header>

        <div className="auth-inner">
          <aside className="auth-illustration">
            <AuthIllustration register={isRegister} />
            <h2>{isRegister ? 'Create Your Account' : 'Welcome Back!'}</h2>
            <p>{isRegister ? 'Join students who are learning and revising smarter every day.' : 'Log in to continue your learning journey and revise smarter.'}</p>
            <div className="auth-benefits">
              {(isRegister
                ? [
                    [CalendarCheck, 'Organize Your Topics', 'Add topics and schedule revisions.'],
                    [BellRing, 'Stay Consistent', 'Get reminders and build habits.'],
                    [ShieldCheck, 'Achieve Your Goals', 'Track progress with confidence.'],
                  ]
                : [
                    [CalendarCheck, 'Spaced Repetition', 'Revise at the perfect time.'],
                    [BarChart3, 'Track Progress', 'Monitor your learning journey.'],
                    [BellRing, 'Smart Reminders', 'Never miss an important revision.'],
                    [ShieldCheck, 'Secure & Private', 'Your data is safe with us.'],
                  ]).map(([Icon, label, text]) => (
                <div className="auth-benefit" key={label}>
                  <span><Icon size={20} /></span>
                  <div>
                    <strong>{label}</strong>
                    <small>{text}</small>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="auth-form-side">
            <div className="auth-title">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>

            {mode === 'login' && (
              <form className="auth-form" onSubmit={onLogin}>
                <AuthField icon={Mail} label="Email Address" type="email" value={form.email} placeholder="Enter your email" onChange={(value) => updateField('email', value)} />
                <AuthField icon={KeyRound} label="Password" type="password" value={form.password} placeholder="Enter your password" onChange={(value) => updateField('password', value)} />
                <div className="auth-row">
                  <label className="check-row"><input type="checkbox" defaultChecked /> Remember me</label>
                  <button className="inline-action" type="button" onClick={() => switchMode('reset')}>Forgot Password?</button>
                </div>
                <button className="auth-submit" type="submit" disabled={submitting}>Login</button>
                <SocialButtons onGoogleLogin={onGoogleLogin} />
                <p className="auth-bottom">Don't have an account? <button type="button" onClick={() => switchMode('register')}>Sign up</button></p>
              </form>
            )}

            {mode === 'register' && registerStep === 'details' && (
              <form className="auth-form" onSubmit={onRequestRegistrationOtp}>
                <AuthField icon={User} label="Full Name" value={form.name} placeholder="Enter your full name" onChange={(value) => updateField('name', value)} />
                <AuthField icon={Mail} label="Email Address" type="email" value={form.email} placeholder="Enter your email" onChange={(value) => updateField('email', value)} />
                <AuthField icon={KeyRound} label="Password" type="password" value={form.password} placeholder="Create a password" onChange={(value) => updateField('password', value)} hint="At least 8 characters with letters and numbers" />
                <AuthField icon={KeyRound} label="Confirm Password" type="password" value={form.confirmPassword} placeholder="Confirm your password" onChange={(value) => updateField('confirmPassword', value)} />
                <label className="check-row terms-row"><input type="checkbox" defaultChecked /> I agree to the Terms of Service and Privacy Policy</label>
                <button className="auth-submit" type="submit" disabled={submitting}>Send Verification OTP</button>
                <SocialButtons onGoogleLogin={onGoogleLogin} />
                <p className="auth-bottom">Already have an account? <button type="button" onClick={() => switchMode('login')}>Login</button></p>
              </form>
            )}

            {mode === 'register' && registerStep === 'otp' && (
              <form className="auth-form" onSubmit={onCompleteRegistration}>
                <AuthField icon={Mail} label="Email OTP" value={form.otp} placeholder="Enter verification OTP" onChange={(value) => updateField('otp', value)} />
                <button className="auth-submit" type="submit" disabled={submitting}>Verify & Create Account</button>
                <button className="inline-action standalone" type="button" onClick={() => setRegisterStep('details')}>Edit account details</button>
              </form>
            )}

            {mode === 'reset' && resetStep === 'email' && (
              <form className="auth-form" onSubmit={onRequestPasswordReset}>
                <AuthField icon={Mail} label="Email Address" type="email" value={form.email} placeholder="Enter your email" onChange={(value) => updateField('email', value)} />
                <button className="auth-submit" type="submit" disabled={submitting}>Send Reset OTP</button>
                <p className="auth-bottom">Remembered it? <button type="button" onClick={() => switchMode('login')}>Login</button></p>
              </form>
            )}

            {mode === 'reset' && resetStep === 'otp' && (
              <form className="auth-form" onSubmit={onResetPassword}>
                <AuthField icon={Mail} label="Reset OTP" value={form.otp} placeholder="Enter reset OTP" onChange={(value) => updateField('otp', value)} />
                <AuthField icon={KeyRound} label="New Password" type="password" value={form.newPassword} placeholder="Create a new password" onChange={(value) => updateField('newPassword', value)} />
                <AuthField icon={KeyRound} label="Confirm New Password" type="password" value={form.confirmNewPassword} placeholder="Confirm your new password" onChange={(value) => updateField('confirmNewPassword', value)} />
                <button className="auth-submit" type="submit" disabled={submitting}>Reset Password</button>
              </form>
            )}

            {message && <p className="form-message">{message}</p>}
          </section>
        </div>

        <footer className="auth-footer">© 2026 Smart Revision Scheduler. All rights reserved.</footer>
      </section>
    </main>
  );
}

function AuthField({ icon: Icon, label, hint, type = 'text', value, placeholder, onChange }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const ToggleIcon = showPassword ? EyeOff : Eye;

  return (
    <label className="auth-field">
      {label}
      <span>
        <Icon size={18} />
        <input type={inputType} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} required />
        {isPassword && (
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <ToggleIcon size={17} />
          </button>
        )}
      </span>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SocialButtons({ onGoogleLogin }) {
  return (
    <div className="social-auth">
      <span>or continue with</span>
      <div>
        <button type="button" onClick={onGoogleLogin}><b>G</b> Google</button>
        <button type="button"><b>■</b> Microsoft</button>
      </div>
    </div>
  );
}

function requestGoogleCredential() {
  return new Promise((resolve, reject) => {
    loadGoogleIdentityScript()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response?.credential) {
              resolve(response.credential);
            } else {
              reject(new Error('No Google credential returned'));
            }
          },
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            reject(new Error('Google prompt was not displayed'));
          }
        });
      })
      .catch(reject);
  });
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function AuthIllustration({ register }) {
  return (
    <div className={`auth-art ${register ? 'register-art' : ''}`} aria-hidden="true">
      <div className="art-orbit" />
      <div className="art-board">
        {register ? (
          <>
            <div className="art-monitor">
              <PieChart size={54} />
              <Check size={28} />
            </div>
            <div className="art-book book-one" />
            <div className="art-book book-two" />
          </>
        ) : (
          <>
            <div className="art-clipboard">
              <Check size={34} />
              <Check size={34} />
              <Check size={34} />
            </div>
            <div className="art-plant" />
            <div className="art-book book-one" />
            <div className="art-book book-two" />
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({ dashboard, today, loading, onComplete, onDeleteTopic, onOpenNotes }) {
  const revisionListRef = useRef(null);
  const [revisionMode, setRevisionMode] = useState(false);
  const due = today.length;
  const completed = today.filter((item) => item.completed).length;
  const remaining = Math.max(due - completed, 0);

  function startRevising() {
    setRevisionMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (revisionMode) {
    return (
      <section className="panel revision-focus">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Revision session</p>
            <h2>Today's Revisions</h2>
          </div>
          <button className="secondary-btn" type="button" onClick={() => setRevisionMode(false)}>
            Back
          </button>
        </div>
        {today.length === 0 && <p className="empty">No revisions due today.</p>}
        <div className="revision-card-list">
          {today.map((item) => (
            <RevisionCard key={item.id} item={item} onComplete={onComplete} onDeleteTopic={onDeleteTopic} onOpenNotes={onOpenNotes} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="dashboard-hero">
        <div className="goal-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Today's Goal</h2>
            </div>
            <Target size={24} />
          </div>
          <div className="goal-metrics">
            <Metric label="Topics Due" value={due} />
            <Metric label="Completed" value={completed} />
            <Metric label="Remaining" value={remaining} />
          </div>
          <button className="primary-btn goal-action" type="button" onClick={startRevising} disabled={today.length === 0}>
            <PlayCircle size={18} />
            Start Revising
          </button>
        </div>

        <div className="memory-card">
          <ProgressRing value={dashboard.memoryScore} />
          <div>
            <p className="eyebrow">Retention</p>
            <h2>Memory Score</h2>
            <span>Based on your completed revisions</span>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <Stat label="Topics Learned" value={dashboard.topicsLearned} change="+3 this week" tone="violet" icon={<CalendarCheck size={19} />} />
        <Stat label="Revisions Completed" value={dashboard.revisionsCompleted} change="+12 this week" tone="green" icon={<CheckCircle2 size={19} />} />
        <Stat label="Current Streak" value={`${dashboard.currentStreak} Days`} change="Keep going" tone="amber" icon={<Flame size={19} />} />
        <Stat label="Next 7 Days" value={dashboard.nextWeek.length} change="Upcoming revisions" tone="cyan" icon={<BellRing size={19} />} />
      </section>

      <section className="main-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Today's Revisions</h2>
            <span>{today.length}</span>
          </div>
          {loading && <p className="empty">Loading revisions...</p>}
          {!loading && today.length === 0 && (
            <div className="empty-state">
              <CheckCircle2 size={34} />
              <strong>No revisions due today.</strong>
              <span>You are clear for now. Add a topic or check upcoming revisions.</span>
            </div>
          )}
          <div className="revision-card-list" ref={revisionListRef}>
            {today.map((item) => (
              <RevisionCard key={item.id} item={item} onComplete={onComplete} onDeleteTopic={onDeleteTopic} onOpenNotes={onOpenNotes} />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Upcoming</h2>
          </div>
          <UpcomingGroup title="Tomorrow" items={dashboard.tomorrow} />
          <UpcomingGroup title="Next Week" items={dashboard.nextWeek} />
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, change, tone = 'violet', icon }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {change && <em>{change}</em>}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProgressRing({ value }) {
  const score = Math.max(0, Math.min(Number(value) || 0, 100));
  return (
    <div className="progress-ring" style={{ '--progress': `${score * 3.6}deg` }}>
      <div>
        <strong>{score}%</strong>
      </div>
    </div>
  );
}

function RevisionCard({ item, onComplete, onDeleteTopic, onOpenNotes }) {
  const canComplete = canCompleteRevision(item.revisionDate);

  return (
    <div className={item.completed ? 'revision-card done' : 'revision-card'}>
      {canComplete ? (
        <button className="complete-btn" onClick={() => onComplete(item.id)} title="Mark complete" disabled={item.completed}>
          {item.completed ? <Check size={16} /> : <Circle size={16} />}
          <span>{item.completed ? 'Done' : 'Done'}</span>
        </button>
      ) : (
        <span className="locked-complete"><CalendarDays size={15} /></span>
      )}
      <div>
        <strong>{item.topicName}</strong>
        <span>Day {item.revisionDay}</span>
        <em>{item.subject}</em>
        {(item.notes || item.noteFiles?.length > 0) && (
          <button className="notes-link" type="button" onClick={() => onOpenNotes(item)}>
            View Notes / Files
          </button>
        )}
      </div>
      {onDeleteTopic && (
        <button className="delete-topic-btn" type="button" onClick={() => onDeleteTopic(item.topicId, item.topicName)} title="Delete topic">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function WeeklyBars({ data = [] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="weekly-bars">
      {data.map((item) => (
        <div className="weekly-row" key={item.date}>
          <span>{item.label}</span>
          <div><i style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }} /></div>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}

function MiniHeatmap({ data = [] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="heatmap">
      {data.map((item) => (
        <span
          key={item.date}
          className={`heat-${Math.ceil((item.count / maxCount) * 4)}`}
          title={`${item.label}: ${item.count} completed`}
        />
      ))}
    </div>
  );
}

function UpcomingGroup({ title, items }) {
  const grouped = items.reduce((acc, item) => {
    acc[item.revisionDate] = acc[item.revisionDate] || [];
    acc[item.revisionDate].push(item);
    return acc;
  }, {});

  return (
    <div className="upcoming-group">
      <h3>{title} ({items.length})</h3>
      {items.length === 0 && <p className="empty compact">Nothing scheduled.</p>}
      {Object.entries(grouped).map(([date, dateItems]) => (
        <div className="upcoming-date-group" key={date}>
          <span>{formatDate(date)}</span>
          <div>
            {dateItems.map((item) => (
              <strong key={item.id}>
                {item.topicName}
                <em>{item.subject} - Day {item.revisionDay}</em>
              </strong>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddTopic({ onAdded }) {
  const [form, setForm] = useState({
    topicName: '',
    subject: '',
    difficulty: 'MEDIUM',
    dateLearned: todayIso(),
    priority: 3,
    notes: '',
  });
  const [created, setCreated] = useState(null);
  const [preview, setPreview] = useState([]);
  const [noteFiles, setNoteFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await addTopic({
        topicName: form.topicName,
        subject: form.subject,
        difficulty: form.difficulty,
        dateLearned: form.dateLearned,
        notes: form.notes,
      });
      if (noteFiles.length > 0) {
        await uploadNoteFiles(response.id, noteFiles);
      }
      setCreated(response);
      setForm((current) => ({ ...current, topicName: '', subject: '', notes: '' }));
      setNoteFiles([]);
      setFileInputKey((current) => current + 1);
      await onAdded();
    } finally {
      setSaving(false);
    }
  }

  function generateSchedule() {
    const learnedDate = new Date(`${form.dateLearned}T00:00:00`);
    setPreview(revisionDays.map((day) => {
      const revisionDate = new Date(learnedDate);
      revisionDate.setDate(revisionDate.getDate() + day);
      return {
        revisionDay: day,
        revisionDate: toLocalIsoDate(revisionDate),
      };
    }));
  }

  const schedule = created?.revisions?.length ? created.revisions : preview;

  return (
    <section className="form-layout">
      <form className="panel topic-form" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">New revision plan</p>
            <h2>Add Topic</h2>
          </div>
        </div>
        <label>
          Topic Name
          <input value={form.topicName} onChange={(event) => updateField('topicName', event.target.value)} required autoComplete="off" />
        </label>
        <label>
          Subject
          <input value={form.subject} onChange={(event) => updateField('subject', event.target.value)} required autoComplete="off" />
        </label>
        <fieldset>
          <legend>Difficulty</legend>
          {['EASY', 'MEDIUM', 'HARD'].map((difficulty) => (
            <label className="radio-option" key={difficulty}>
              <input
                type="radio"
                name="difficulty"
                checked={form.difficulty === difficulty}
                onChange={() => updateField('difficulty', difficulty)}
              />
              {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
            </label>
          ))}
        </fieldset>
        <label>
          Date Learned
          <input type="date" value={form.dateLearned} onChange={(event) => updateField('dateLearned', event.target.value)} />
        </label>
        <label>
          Priority
          <div className="priority-stars">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                className={form.priority >= rating ? 'active' : ''}
                onClick={() => updateField('priority', rating)}
                title={`${rating} star priority`}
              >
                <Star size={20} />
              </button>
            ))}
          </div>
        </label>
        <label>
          Notes
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Important points, links, or doubts" />
        </label>
        <label>
          Upload PDF or Photos
          <input
            key={fileInputKey}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(event) => setNoteFiles(Array.from(event.target.files || []))}
          />
          {noteFiles.length > 0 && <span className="file-count">{noteFiles.length} file{noteFiles.length === 1 ? '' : 's'} selected</span>}
        </label>
        <button className="secondary-btn" type="button" onClick={generateSchedule} disabled={saving}>
          <CalendarCheck size={18} />
          Generate Schedule
        </button>
        <button className="primary-btn" type="submit" disabled={saving}>
          <CheckCircle2 size={18} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>

      <div className="panel">
        <div className="panel-heading">
          <h2>Generated Schedule</h2>
        </div>
        {schedule.length === 0 && <p className="empty">Click Generate Schedule to preview Day 1 through Day 90.</p>}
        {schedule.map((revision) => (
          <div className="schedule-item" key={revision.id || revision.revisionDay}>
            <span>{revision.revisionDay === 1 ? 'Tomorrow' : `Day ${revision.revisionDay}`}</span>
            <strong>{formatDate(revision.revisionDate)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CalendarView({ items, onComplete, onDeleteTopic, onOpenNotes }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const baseDate = new Date(selectedYear, selectedMonth, 1);
  const year = selectedYear;
  const month = selectedMonth;
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(baseDate);
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const monthDays = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: monthDays }, (_, index) => new Date(year, month, index + 1)),
  ];
  const grouped = items.reduce((acc, item) => {
    acc[item.revisionDate] = acc[item.revisionDate] || [];
    acc[item.revisionDate].push(item);
    return acc;
  }, {});
  const selectedItems = selectedDate ? grouped[selectedDate] || [] : [];

  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Revision calendar</p>
          <h2>{monthLabel}</h2>
        </div>
        <div className="calendar-controls">
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
            {monthNames.map((name, index) => (
              <option value={index} key={name}>{name}</option>
            ))}
          </select>
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {Array.from({ length: 76 }, (_, index) => 2024 + index).map((optionYear) => (
              <option value={optionYear} key={optionYear}>{optionYear}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <strong className="calendar-weekday" key={day}>{day}</strong>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span className="calendar-cell blank" key={`blank-${index}`} />;
      const iso = toLocalIsoDate(date);
          const dateItems = grouped[iso] || [];
          return (
            <button className="calendar-cell" key={iso} onClick={() => setSelectedDate(iso)} type="button">
              <span>{date.getDate()}</span>
              {dateItems.slice(0, 3).map((item) => (
                <em key={item.id}>{item.topicName} (Day {item.revisionDay})</em>
              ))}
              {dateItems.length > 3 && <i>+{dateItems.length - 3} more</i>}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="day-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <h2>{formatDate(selectedDate)}</h2>
              <button className="icon-btn secondary" onClick={() => setSelectedDate(null)} type="button">x</button>
            </div>
            {selectedItems.length === 0 && <p className="empty">No revisions on this day.</p>}
            {selectedItems.map((item) => (
              <div className="revision-card compact" key={item.id}>
                <div>
                  <strong>{item.topicName}</strong>
                  <span>Day {item.revisionDay}</span>
                  <em>{item.subject}</em>
                  {(item.notes || item.noteFiles?.length > 0) && (
                    <button className="notes-link" type="button" onClick={() => onOpenNotes(item)}>
                      View Notes / Files
                    </button>
                  )}
                </div>
                <div className="calendar-item-actions">
                  {item.completed && <span className="status-pill done"><Check size={14} /> Completed</span>}
                  {!item.completed && canCompleteRevision(item.revisionDate) && (
                    <button className="primary-btn small" onClick={() => onComplete(item.id)} type="button">
                      <Check size={15} />
                      Mark Complete
                    </button>
                  )}
                  {!item.completed && !canCompleteRevision(item.revisionDate) && (
                    <span className="status-pill locked"><CalendarDays size={14} /> Not due yet</span>
                  )}
                  <button className="delete-topic-btn" type="button" onClick={() => onDeleteTopic(item.topicId, item.topicName)} title="Delete topic">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NotesPage({ item, onBack }) {
  return (
    <div className="notes-page-backdrop">
      <section className="notes-page panel">
        <div className="notes-page-header">
          <div>
            <p className="eyebrow">Topic notes</p>
            <h2>{item.topicName}</h2>
          </div>
          <button className="secondary-btn" type="button" onClick={onBack}>
            Back
          </button>
        </div>
        <div className="notes-meta">
          <span><strong>Subject:</strong> {item.subject}</span>
          <span><strong>Revision:</strong> Day {item.revisionDay}</span>
          <span><strong>Date:</strong> {formatDate(item.revisionDate)}</span>
        </div>
        {item.notes ? (
          <article className="notes-body">
            {item.notes}
          </article>
        ) : (
          <div className="notes-empty-file-only">
            No text notes added. Uploaded files are shown below.
          </div>
        )}
        <AttachmentList files={item.noteFiles || []} />
      </section>
    </div>
  );
}

function AttachmentList({ files }) {
  if (!files.length) {
    return null;
  }

  return (
    <section className="attachment-section">
      <div className="panel-heading">
        <h2>Attached Files</h2>
        <span>{files.length}</span>
      </div>
      <div className="attachment-grid">
        {files.map((file) => (
          <AttachmentCard key={file.id} file={file} />
        ))}
      </div>
    </section>
  );
}

function AttachmentCard({ file }) {
  const [url, setUrl] = useState('');
  const isImage = file.contentType?.startsWith('image/');
  const isPdf = file.contentType === 'application/pdf';

  useEffect(() => {
    let objectUrl = '';
    getNoteFileBlob(file.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(''));

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.id]);

  return (
    <div className="attachment-card">
      {isImage && url && <img src={url} alt={file.fileName} />}
      {isPdf && (
        <div className="pdf-preview">
          <strong>PDF</strong>
        </div>
      )}
      {!isImage && !isPdf && (
        <div className="pdf-preview">
          <strong>FILE</strong>
        </div>
      )}
      <div>
        <strong>{file.fileName}</strong>
        <span>{formatFileSize(file.sizeBytes)}</span>
      </div>
      {url && (
        <a href={url} target="_blank" rel="noreferrer">
          Open
        </a>
      )}
    </div>
  );
}

function formatFileSize(sizeBytes) {
  if (!sizeBytes) return '0 KB';
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatisticsView({ dashboard, statistics }) {
  const subjectEntries = statistics.subjects.slice(0, 5);
  const maxSubjectCount = Math.max(...subjectEntries.map((item) => item.count), 1);
  const completionRate = dashboard.memoryScore || 0;

  return (
    <>
      <section className="panel statistics-summary">
        <div>
          <span>Topics Learned</span>
          <strong>{dashboard.topicsLearned}</strong>
        </div>
        <div>
          <span>Revisions Completed</span>
          <strong>{dashboard.revisionsCompleted}</strong>
        </div>
        <div>
          <span>Memory Score</span>
          <strong>{completionRate}%</strong>
        </div>
        <div>
          <span>Current Streak</span>
          <strong>{Math.max(dashboard.currentStreak, 0)} Days</strong>
        </div>
      </section>
      <section className="main-grid">
        <div className="panel stack-panel">
          <div className="panel-heading">
            <h2>Weekly Bar Chart</h2>
          </div>
          <WeeklyBars data={statistics.weeklyActivity} />
          <div className="panel-heading slim">
            <h2>Revision Consistency</h2>
          </div>
          <MiniHeatmap data={statistics.revisionConsistency} />
        </div>
        <div className="panel stack-panel">
          <div className="panel-heading">
            <h2>Subjects</h2>
          </div>
          <div className="subject-chart">
            {subjectEntries.length === 0 && <p className="empty">Add topics to see subject distribution.</p>}
            {subjectEntries.map((item, index) => (
              <div className="subject-row" key={item.subject}>
                <span>{item.subject}</span>
                <div><i style={{ width: `${Math.max(8, (item.count / maxSubjectCount) * 100)}%`, background: chartColors[index % chartColors.length] }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

const chartColors = ['#4f46e5', '#22c55e', '#06b6d4', '#f59e0b', '#ef4444'];

export default App;
