import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../../utils/api';
import { useTranslation } from 'react-i18next';
import { 
  Settings, CreditCard, Database, ShieldCheck, 
  Save, CheckCircle2, AlertTriangle, RefreshCw, 
  Globe, Key, ToggleLeft, ToggleRight, Trash2,
  Loader2, Percent, Mail, Palette, Image as ImageIcon, Code, Plus
} from 'lucide-react';

const GlobalSettings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isProcessingData, setIsProcessingData] = useState(null);
    const [isUnlocked, setIsUnlocked] = useState(false);



  // Add these to your existing useState definitions
const [showVerification, setShowVerification] = useState(false);
const [verificationCode, setVerificationCode] = useState('');

// 1. Trigger the verification process (The "Unlock" button)
const requestVerification = async () => {
  setIsSaving(true);
  try {
    await axios.post(`${API_URL}/settings/request-verification`, {}, getAuthConfig());
    setShowVerification(true);
    showToast('Security code sent to your email.');
  } catch (err) {
    showToast('Failed to send verification code.', 'error');
  } finally {
    setIsSaving(false);
  }
};

// 2. Finalize changes (The modal "Verify & Save" button)
const finalizeSave = async () => {
  setIsSaving(true);
  try {
    const dynamicVarsObject = customVariables.reduce((acc, curr) => {
      if (curr.key?.trim()) acc[curr.key.trim()] = curr.value;
      return acc;
    }, {});

    const payload = { 
      ...config, 
      processingFee: parseFloat(config.processingFee) || 0,
      customVariables: dynamicVarsObject,
      verificationCode 
    };

    await axios.put(`${API_URL}/settings`, payload, getAuthConfig());
    showToast('Configuration securely saved!');
    setShowVerification(false);
    setIsUnlocked(true); // <--- NOW we unlock the inputs
    setVerificationCode('');
  } catch (err) {
    showToast(err.response?.data?.message || 'Verification failed.', 'error');
  } finally {
    setIsSaving(false);
  }
};

  // Master Configuration State
  const [config, setConfig] = useState({
    platformName: 'SlipZMarket B2B',
    supportEmail: '',
    primaryColor: '#800000',
    logoUrl: '',
    maintenanceMode: false,
    defaultRegion: 'UK & Europe',
    gateway: 'Stripe',
    currency: 'GBP (£)',
    processingFee: 4.50,
    publicKey: '',
    secretKey: '',
    require2FA: true,
    sessionTimeout: '60',
  });

  // Dynamic Key-Value Pairs State
  const [customVariables, setCustomVariables] = useState([]);
  const toastTimerRef = useRef(null);

  const getAuthConfig = () => ({
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('slipz_token')}` 
    }
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // 1. STRICT INITIAL FETCH
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/settings`, getAuthConfig());
        const dbData = response.data.data || response.data;
        
        if (dbData) {
          setConfig(prev => ({ ...prev, ...dbData }));
          
          if (dbData.customVariables) {
            // Handle both stringified JSON and actual JSON objects
            const parsedVars = typeof dbData.customVariables === 'string' 
              ? JSON.parse(dbData.customVariables) 
              : dbData.customVariables;
              
            const formattedVars = Object.entries(parsedVars).map(([key, value]) => ({ key, value }));
            setCustomVariables(formattedVars);
          }
        }
      } catch (err) {
        console.error("Fetch Settings Error:", err);
        showToast(err.response?.data?.message || 'Failed to load settings from database.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);


  // 3. STRICT DATA ENGINE HANDLER
  const handleDataReset = async (action) => {
    if (!window.confirm(`DANGER: Are you absolutely sure you want to execute: ${action}? This action will permanently delete data.`)) return;
    
    setIsProcessingData(action);
    try {
      const response = await axios.post(`${API_URL}/settings/data-engine`, { action }, getAuthConfig());
      
      if (response.status === 200 || response.status === 201) {
        showToast(`${action} successfully executed on database.`, 'success');
      } else {
        throw new Error("Server failed to confirm execution.");
      }
    } catch (err) {
      console.error("Data Engine Error:", err);
      const errorMsg = err.response?.data?.message || err.message || `${action} failed.`;
      showToast(errorMsg, 'error');
    } finally {
      setIsProcessingData(null);
    }
  };

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const addVariable = () => setCustomVariables([...customVariables, { key: '', value: '' }]);
  const updateVariable = (index, field, value) => {
    const newVars = [...customVariables];
    newVars[index][field] = value;
    setCustomVariables(newVars);
  };
  const removeVariable = (index) => setCustomVariables(customVariables.filter((_, i) => i !== index));

  // --- RENDERERS ---
  const renderGeneralSettings = () => (
    <div className="animate-in fade-in flex flex-col gap-3 md:gap-6">
        <div className="flex flex-col gap-2 border-b border-theme pb-4">
          <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-primary flex flex-col sm:flex-row items-center gap-2">
            <Globe size={16} className="text-accent" /> General Branding
          </h3>
          <p className="sm:text-xs md:text-xs lg:text-xs text-muted font-medium">Update the core identity, visual aesthetics, and global states.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-muted uppercase tracking-widest">Platform Name</label>
          <input 
            type="text" value={config.platformName} onChange={(e) => handleChange('platformName', e.target.value)}
            className="w-full bg-surface border border-theme rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-muted uppercase tracking-widest flex flex-col sm:flex-row items-center gap-1.5"><Mail size={16}/> Support Email</label>
          <input 
            type="email" value={config.supportEmail} onChange={(e) => handleChange('supportEmail', e.target.value)}
            className="w-full bg-surface border border-theme rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-medium text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-muted uppercase tracking-widest flex flex-col sm:flex-row items-center gap-1.5"><Palette size={16}/> Primary Brand Color</label>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input 
              type="color" value={config.primaryColor} onChange={(e) => handleChange('primaryColor', e.target.value)}
              className="w-16 md:w-18 h-18 rounded cursor-pointer border-0 p-0"
            />
            <input 
              type="text" value={config.primaryColor} onChange={(e) => handleChange('primaryColor', e.target.value)}
              className="flex-1 min-w-0 bg-surface border border-theme rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-sans font-bold text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest flex flex-col sm:flex-row items-center gap-1.5"><ImageIcon size={16}/> Logo URL (Remote)</label>
          <input 
            type="url" value={config.logoUrl} onChange={(e) => handleChange('logoUrl', e.target.value)} placeholder="https://..."
            className="w-full bg-white border border-[#d6c9b8] rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-medium  text-[#3b2a23] outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] transition-all"
          />
        </div>

        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-muted uppercase tracking-widest">Default Compliance Region</label>
          <select 
            value={config.defaultRegion} onChange={(e) => handleChange('defaultRegion', e.target.value)}
            className="w-full bg-surface border border-theme rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-medium text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          >
            <option>UK & Europe (GDPR)</option>
            <option>United States (CCPA)</option>
            <option>Global (Strict)</option>
          </select>
        </div>
      </div>

      <div className="mt-4 p-6 bg-surface border border-theme rounded-lg flex items-center justify-between shadow-sm">
        <div>
          <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-primary">Maintenance Mode</h4>
          <p className="sm:text-xs md:text-xs lg:text-xs text-muted mt-0.5">Disable access to the storefront for non-admin users instantly.</p>
        </div>
        <button 
          type="button" onClick={() => handleChange('maintenanceMode', !config.maintenanceMode)}
          className={`transition-colors ${config.maintenanceMode ? 'text-amber-600' : 'text-muted hover:text-accent'}`}
        >
          {config.maintenanceMode ? <ToggleRight size={21} /> : <ToggleLeft size={21} />}
        </button>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="animate-in fade-in flex flex-col gap-3 md:gap-6">
      <div className="flex flex-col gap-2 border-b border-[#d6c9b8] pb-4">
        <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
          <Code size={16} className="text-[#800000]" /> Dynamic Variables
        </h3>
        <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">Create unlimited custom settings (e.g., API limits, holiday messages, tax rates) without changing code.</p>
      </div>

      <div className="flex flex-col gap-2">
        {customVariables.length === 0 ? (
          <div className="text-center p-7 border-2 border-dashed border-[#d6c9b8] rounded-lg bg-[#faf6f0]">
            <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">No custom variables defined yet.</p>
          </div>
        ) : (
          customVariables.map((variable, index) => (
            <div key={index} className="flex flex-col sm:flex-row items-center gap-2 bg-[#faf6f0] p-3 rounded-lg border border-[#d6c9b8]">
              <input 
                type="text" placeholder="Variable Key (e.g., maxCartItems)" value={variable.key}
                onChange={(e) => updateVariable(index, 'key', e.target.value)}
                className="w-full sm:w-1/3 bg-white border border-[#d6c9b8] rounded-lg px-2 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans font-bold  text-[#3b2a23] outline-none focus:border-[#800000] focus:ring-1"
              />
              <input 
                type="text" placeholder="Value" value={variable.value}
                onChange={(e) => updateVariable(index, 'value', e.target.value)}
                className="w-full sm:flex-1 min-w-0 bg-white border border-[#d6c9b8] rounded-lg px-2 py-1.5 sm:text-xs md:text-xs lg:text-xs font-medium  text-[#3b2a23] outline-none focus:border-[#800000] focus:ring-1"
              />
              <button 
                type="button" onClick={() => removeVariable(index)}
                className="p-2.5 text-[#8b6f5a] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove Variable"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}

        <button 
          type="button" onClick={addVariable}
          className="mt-2 flex items-center justify-center gap-2 w-full border-2 border-dashed border-[#800000]/30 hover:border-[#800000] bg-white text-[#800000] py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all"
        >
          <Plus size={16} /> Add New Variable
        </button>
      </div>
    </div>
  );
const renderPaymentSettings = () => {
  // Check if we are currently in "Edit Mode" for sensitive fields


  return (
    <div className="animate-in fade-in flex flex-col gap-3 md:gap-6">
      <div className="flex flex-col gap-2 border-b border-[#d6c9b8] pb-4">
        <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
          <CreditCard size={16} className="text-[#800000]" /> Billing & Gateway
        </h3>
        <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">Configure transaction fees, currencies, and API keys.</p>
      </div>

      {/* Gateway & Currency Selection (Always Enabled) */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Active Gateway</label>
          <select value={config.gateway} onChange={(e) => handleChange('gateway', e.target.value)} className="w-full bg-white border border-[#d6c9b8] rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-medium  text-[#3b2a23] outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000]">
            <option>Stripe</option>
            <option>PayPal Braintree</option>
            <option>Adyen</option>
          </select>
        </div>
        {/* ... Currency and Fee inputs ... */}
      </div>

      {/* Sensitive Credentials (Locked by Default) */}
      <div className={`p-6 bg-[#faf6f0] border border-[#d6c9b8] rounded-lg flex flex-col gap-3 md:gap-6 shadow-sm transition-all ${isUnlocked ? 'opacity-100' : 'opacity-70'}`}>
        <div className="flex items-center justify-between">
          <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] uppercase tracking-widest flex flex-col sm:flex-row items-center gap-2">
            <Key size={16} className="text-[#800000]" /> API Credentials
          </h4>
          {!isUnlocked && (
<button 
  type="button" 
  onClick={requestVerification} // Use the new specialized function
  className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#800000] hover:underline"
>
  Unlock to Edit
</button>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Publishable Key</label>
          <input 
            type="text" 
            disabled={!isUnlocked}
            value={config.publicKey} 
            onChange={(e) => handleChange('publicKey', e.target.value)}
            className="w-full bg-white border border-[#d6c9b8] rounded-lg px-2 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans  text-[#3b2a23] outline-none disabled:bg-[#f5f5f5] disabled:cursor-not-allowed focus:border-[#800000] focus:ring-1"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Secret Key</label>
          <input 
            type="password" 
            disabled={!isUnlocked}
            value={config.secretKey} 
            onChange={(e) => handleChange('secretKey', e.target.value)}
            className="w-full bg-white border border-[#d6c9b8] rounded-lg px-2 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans  text-[#3b2a23] outline-none disabled:bg-[#f5f5f5] disabled:cursor-not-allowed focus:border-[#800000] focus:ring-1"
          />
        </div>
      </div>
    </div>
  );
};

  const renderSecuritySettings = () => (
    <div className="animate-in fade-in flex flex-col gap-3 md:gap-6">
      <div className="flex flex-col gap-2 border-b border-[#d6c9b8] pb-4">
        <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
          <ShieldCheck size={16} className="text-[#800000]" /> Security & Access
        </h3>
        <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">Manage authentication requirements and session limits.</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="p-6 overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg flex items-center justify-between shadow-sm">
          <div>
            <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23]">Enforce 2FA Globally</h4>
            <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-0.5">Require all workspace admins to use two-factor authentication.</p>
          </div>
          <button 
            type="button" onClick={() => handleChange('require2FA', !config.require2FA)}
            className={`transition-colors ${config.require2FA ? 'text-emerald-600' : 'text-[#d6c9b8] hover:text-[#800000]'}`}
          >
            {config.require2FA ? <ToggleRight size={21} /> : <ToggleLeft size={21} />}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Session Timeout (Minutes)</label>
          <input 
            type="number" value={config.sessionTimeout} onChange={(e) => handleChange('sessionTimeout', e.target.value)}
            className="w-full max-w-xs bg-white border border-[#d6c9b8] rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-sans font-bold  text-[#3b2a23] outline-none focus:border-[#800000] focus:ring-1"
          />
        </div>
      </div>
    </div>
  );

  const renderMockDataEngine = () => (
    <div className="animate-in fade-in flex flex-col gap-3 md:gap-6">
      <div className="flex flex-col gap-2 border-b border-[#d6c9b8] pb-4">
        <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
          <Database size={16} className="text-[#800000]" /> Mock Data Engine
        </h3>
        <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">Danger Zone. Hard reset the simulated databases across the application.</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="p-6 overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm hover:border-[#800000] transition-colors group">
          <div>
            <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23]">Reset Lead Packages</h4>
            <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-0.5">Restores the Browse Leads directory back to initial mock datasets.</p>
          </div>
          <button 
            type="button" onClick={() => handleDataReset('Reset Lead Packages')} disabled={isProcessingData !== null}
            className="flex items-center justify-center gap-2 px-2 py-1.5 bg-[#faf6f0] border border-[#d6c9b8] group-hover:bg-[#800000] group-hover:text-white group-hover:border-[#800000]  text-[#3b2a23] sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg transition-colors w-full sm:w-auto"
          >
            {isProcessingData === 'Reset Lead Packages' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reset Leads
          </button>
        </div>

        <div className="p-6 overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm hover:border-red-300 transition-colors group">
          <div>
            <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23]">Purge Order History</h4>
            <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-0.5">Deletes all generated invoices and transaction records.</p>
          </div>
          <button 
            type="button" onClick={() => handleDataReset('Purge Order History')} disabled={isProcessingData !== null}
            className="flex items-center justify-center gap-2 px-2 py-1.5 bg-red-50 border border-red-200 group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600 text-red-700 sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg transition-colors w-full sm:w-auto"
          >
            {isProcessingData === 'Purge Order History' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Purge History
          </button>
        </div>

        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
          <div>
            <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-red-900 flex flex-col sm:flex-row items-center gap-2"><AlertTriangle size={16} /> Factory Reset</h4>
            <p className="sm:text-xs md:text-xs lg:text-xs text-red-700 mt-0.5">Wipes all custom settings and mock data, returning the app to initial state.</p>
          </div>
          <button 
            type="button" onClick={() => handleDataReset('Factory Reset')} disabled={isProcessingData !== null}
            className="flex items-center justify-center gap-2 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg transition-colors w-full sm:w-auto shadow-sm"
          >
            {isProcessingData === 'Factory Reset' ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />} Nuke System
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f5efe6]"><Loader2 className="w-8 h-8 animate-spin text-[#800000]" /></div>;
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#f5efe6] font-sans pb-16 selection:bg-[#800000] selection:text-white relative" style={{ zoom: '1.22' }}>
      <div className="overflow-x-auto bg-white border-b border-[#d6c9b8] px-0 md:px-0 py-2 sticky top-0 z-30 shadow-sm shadow-[#3b2a23]/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 w-full">
          <div>
            <h1 className="text-xs md:text-xs font-bold break-words text-[#3b2a23] tracking-tight" style={{ fontSize: '78%' }}>{t('globalSettingsTitle')}</h1>
            <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium mt-1">{t('globalSettingsSubtitle')}</p>
          </div>
<button 
  onClick={() => {
    if (activeTab === 'payments' && !isUnlocked) {
      requestVerification(); // Step 1: Start the security handshake
    } else {
      finalizeSave(); // Step 2: Push changes to the DB
    }
  }}
  disabled={isSaving}
  className="flex items-center justify-center gap-2 bg-[#800000] hover:bg-[#660000] text-white px-3 py-1.5 rounded-lg shadow-xs sm:text-xs md:text-xs lg:text-xs font-bold transition-all disabled:opacity-70 w-full md:w-auto"
>
  {isSaving ? (
    <Loader2 size={16} className="animate-spin" />
  ) : (
    <Save size={16} />
  )}
  {isSaving 
    ? 'Saving...' 
    : (activeTab === 'payments' && !isUnlocked ? 'Unlock to Edit' : t('saveConfiguration'))
  }
</button>
        </div>
      </div>

      <div className="px-0 mt-8 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-6 items-start">
        <div className="lg:col-span-3 flex flex-col gap-2 sticky top-32">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-colors w-full text-left ${activeTab === 'general' ? 'bg-white border border-[#d6c9b8] break-words text-[#3b2a23] shadow-sm' : 'text-[#8b6f5a] hover:bg-white/50 hover:break-words text-[#3b2a23] border border-transparent'}`}
          >
            <Settings size={16} className={activeTab === 'general' ? 'text-[#800000]' : 'opacity-70'} /> {t('generalBranding')}
          </button>
          <button 
            onClick={() => setActiveTab('advanced')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-colors w-full text-left ${activeTab === 'advanced' ? 'bg-white border border-[#d6c9b8] break-words text-[#3b2a23] shadow-sm' : 'text-[#8b6f5a] hover:bg-white/50 hover:break-words text-[#3b2a23] border border-transparent'}`}
          >
            <Code size={16} className={activeTab === 'advanced' ? 'text-[#800000]' : 'opacity-70'} /> {t('advancedVariables')}
          </button>
          <button 
            onClick={() => setActiveTab('payments')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-colors w-full text-left ${activeTab === 'payments' ? 'bg-white border border-[#d6c9b8] break-words text-[#3b2a23] shadow-sm' : 'text-[#8b6f5a] hover:bg-white/50 hover:break-words text-[#3b2a23] border border-transparent'}`}
          >
            <CreditCard size={16} className={activeTab === 'payments' ? 'text-[#800000]' : 'opacity-70'} /> {t('paymentsApi')}
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-colors w-full text-left ${activeTab === 'security' ? 'bg-white border border-[#d6c9b8] break-words text-[#3b2a23] shadow-sm' : 'text-[#8b6f5a] hover:bg-white/50 hover:break-words text-[#3b2a23] border border-transparent'}`}
          >
            <ShieldCheck size={16} className={activeTab === 'security' ? 'text-[#800000]' : 'opacity-70'} /> {t('securityTab')}
          </button>
          
          <div className="h-px w-full bg-[#d6c9b8] my-2 opacity-50" />
          
          <button 
            onClick={() => setActiveTab('data')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-colors w-full text-left ${activeTab === 'data' ? 'bg-[#faf6f0] border border-[#d6c9b8] break-words text-[#3b2a23] shadow-sm' : 'text-[#8b6f5a] hover:bg-[#faf6f0] hover:break-words text-[#3b2a23] border border-transparent'}`}
          >
            <Database size={16} className={activeTab === 'data' ? 'text-[#800000]' : 'opacity-70'} /> {t('mockDataEngine')}
          </button>
        </div>

        <div className="lg:col-span-9 overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-sm p-7 min-h-185">
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'advanced' && renderAdvancedSettings()}
          {activeTab === 'payments' && renderPaymentSettings()}
          {activeTab === 'security' && renderSecuritySettings()}
          {activeTab === 'data' && renderMockDataEngine()}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-10 right-10 z-80 bg-[#2a1b1b] text-white px-3 py-2 rounded-lg shadow-2xl flex flex-col sm:flex-row items-center gap-2 animate-in slide-in-from-bottom-5 border border-[#4a3b3b]" style={{ transform: 'scale(0.9)' }}>
          {toast.type === 'error' ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle2 size={16} className="text-emerald-400" />}
          <p className="sm:text-xs md:text-xs lg:text-xs font-bold">{toast.msg}</p>
        </div>
      )}

      {/* Verification Modal */}
{showVerification && (
  <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-[#3b2a23]/60 backdrop-blur-sm" style={{ transform: 'scale(0.9)' }}>
    <div className="overflow-x-auto bg-white p-7 rounded-lg w-full max-w-sm shadow-2xl border border-[#d6c9b8] animate-in fade-in zoom-in">
      <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] mb-2">Verify Identity</h3>
      <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mb-6">Enter the 6-digit security code sent to your admin email to authorize these changes.</p>
      
      <input 
        type="text"
        maxLength={6}
        placeholder="000000"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
        className="w-full text-center text-xs tracking-[0.5em] py-2 bg-[#faf6f0] border-2 border-[#d6c9b8] rounded-lg mb-6 outline-none focus:border-[#800000]"
      />
      
      <div className="flex flex-col md:flex-row gap-2">
        <button onClick={() => setShowVerification(false)} className="flex-1 min-w-0 py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a]">Cancel</button>
        <button onClick={finalizeSave} className="flex-1 min-w-0 bg-[#800000] text-white py-2 rounded-lg font-bold sm:text-xs md:text-xs lg:text-xs">Verify & Save</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default GlobalSettings;