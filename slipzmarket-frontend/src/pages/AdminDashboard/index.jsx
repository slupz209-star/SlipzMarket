import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_URL } from '../../utils/api';
import { 
 Users, Database, DollarSign, 
 Activity, AlertTriangle, CheckCircle2, 
 MoreVertical, Download, ArrowUpRight, 
 ArrowDownRight, Mail, Search,
 Server, ShieldCheck, Zap, Megaphone, UserCog, 
 BarChart2, Globe,
 X, Send, Eye, RefreshCw, Ban, Loader2, FileText, Check
} from 'lucide-react';

// Map string icon names from the backend to actual Lucide components
const ICON_MAP = {
 DollarSign, Users, Database, AlertTriangle, Server, Mail, Zap, Activity
};

const reportOptions = [
 { id: 'tax', label: 'Fiscal Tax Report', desc: 'Invoices, tax allocations & revenue.' },
 { id: 'perf', label: 'Sales Performance', desc: 'Team quotas and revenue metrics.' },
 { id: 'inv', label: 'Stock Valuation', desc: 'Current stock levels and cost analysis.' }
];

const AdminDashboard = () => {
 const { t } = useTranslation();
 const [currentTab, setCurrentTab] = useState('type'); // 'type' or 'dates'
const [reportSelection, setReportSelection] = useState({ type: 'tax', startDate: '', endDate: '' });

 
 // --- CORE STATE (Connected to Backend) ---
 const [timeRange, setTimeRange] = useState('7D');
 const [isLoading, setIsLoading] = useState(true);
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());
 const [activitySearch, setActivitySearch] = useState('');
 
 // Data States
 const [kpis, setKpis] = useState([]);
 const [chartData, setChartData] = useState([]);
 const [users, setUsers] = useState([]);
 const [activities, setActivities] = useState([]);
 const [systemHealth, setSystemHealth] = useState([]);
 const [userSearch, setUserSearch] = useState('');

 // --- MODAL STATES ---
 const [activeMenuId, setActiveMenuId] = useState(null);
 const [toast, setToast] = useState(null);
 
 const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
 const [announcementText, setAnnouncementText] = useState('');
 
 const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
 const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
 const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);

 // --- CLICK OUTSIDE LISTENER ---
 useEffect(() => {
 const handleOutsideClick = () => setActiveMenuId(null);
 window.addEventListener('click', handleOutsideClick);
 return () => window.removeEventListener('click', handleOutsideClick);
 }, []);

 // --- FUNCTIONAL HANDLERS ---
 const showToast = useCallback((msg, type = 'success') => {
 setToast({ msg, type });
 setTimeout(() => setToast(null), 3000);
 }, []);

 // --- API DATA FETCHING ---
 const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
 if (isManualRefresh) setIsRefreshing(true);
 else setIsLoading(true);

 try {
 const response = await fetch(`/api/admin/dashboard?range=${timeRange}`, {
 headers: { 
 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
 'Content-Type': 'application/json'
 }
 });
 
 if (!response.ok) throw new Error('Network response was not ok');
 
 const { data, success, message } = await response.json();
 
 if (success && data) {
 // Map backend string icons to Lucide components safely, with fallbacks
 setKpis(data.kpis?.map(k => ({ ...k, icon: ICON_MAP[k.icon] || Activity })) || []);
 setSystemHealth(data.systemHealth?.map(s => ({ ...s, icon: ICON_MAP[s.icon] || Server })) || []);
 setChartData(data.chart || []);
 setActivities(data.activities || []);
 
 setLastSync(new Date().toLocaleTimeString());
 if (isManualRefresh) showToast('Dashboard data synced successfully.');
 } else {
 throw new Error(message || 'Failed to parse payload');
 }
 } catch (error) {
 console.error("Failed to fetch dashboard data:", error);
 showToast('Failed to sync data. Check connection.', 'error');
 } finally {
 setIsLoading(false);
 setIsRefreshing(false);
 }
 }, [timeRange, showToast]);

 const fetchUsers = useCallback(async () => {
 try {
 const response = await fetch('/api/admin/dashboard/users', {
 headers: {
 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
 'Content-Type': 'application/json'
 }
 });

 if (!response.ok) throw new Error('Network response was not ok');

 const { data, success, message } = await response.json();
 if (!success) throw new Error(message || 'Failed to load users');

 setUsers(data || []);
 } catch (error) {
 console.error('Failed to load admin users:', error);
 showToast('Failed to load users. Check connection.', 'error');
 }
 }, [showToast]);

 // Re-fetch when timeRange changes
 useEffect(() => {
 fetchDashboardData();
 fetchUsers();
 }, [fetchDashboardData, fetchUsers]);

 const handleExportCSV = () => {
 if (chartData.length === 0) return showToast('No data available to export.', 'error');

 const headers = ['Period', 'Amount'];
 const rows = chartData.map(data => [
 data.label,
 data.amount != null ? Number(data.amount).toFixed(2) : data.value
 ]);
 const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
 
 const encodedUri = encodeURI(csvContent);
 const link = document.createElement("a");
 link.setAttribute("href", encodedUri);
 link.setAttribute("download", `slipzmarket_revenue_${timeRange.toLowerCase()}.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 
 showToast('Report downloaded successfully.');
 };

 // API Call: Send Announcement
 const handleSendAnnouncement = async (e) => {
 e.preventDefault();
 if (!announcementText.trim()) return;
 
 try {
 const res = await fetch('/api/admin/dashboard/announcement', {
 method: 'POST',
 headers: { 
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
 },
 body: JSON.stringify({ message: announcementText })
 });
 const result = await res.json();
 
 if (result.success) {
 // Extract the count from the success message if needed, or just show the message
 showToast(result.message);
 setIsAnnouncementModalOpen(false);
 setAnnouncementText('');
 fetchDashboardData(false); // Refresh logs so the broadcast shows in Activity
 } else {
 throw new Error(result.message);
 }
 } catch (err) {
 showToast(err.message || 'Failed to broadcast announcement.', 'error');
 }
 };

 // API Call: Suspend User
 const handleRowAction = async (actionType, id) => {
 setActiveMenuId(null);
 if (actionType === 'ban') {
 const confirmBan = window.confirm('Are you sure you want to suspend this user?');
 if (confirmBan) {
 try {
 const res = await fetch(`/api/admin/dashboard/users/${id}/suspend`, { 
 method: 'POST',
 headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
 });
 const result = await res.json();
 
 if(res.ok && result.success) {
 showToast('User account suspended.');
 fetchDashboardData(false); // Sync table to show new status
 } else {
 throw new Error(result.message);
 }
 } catch (err) {
 showToast(err.message || 'Failed to suspend user.', 'error');
 }
 }
 } else if (actionType === 'revert') {
 showToast('Action revert requires system admin override.', 'error');
 } else {
 showToast('Fetching complete audit trail for this event...');
 }
 };

 const handleUserAction = async (actionType, id) => {
 const targetUser = users.find(user => user.id === id);
 if (!targetUser) {
 return showToast('User not found.', 'error');
 }

 const payload = {};
 if (actionType === 'toggleBlacklist') {
 payload.action = 'toggleBlacklist';
 }

 if (actionType === 'toggleRole') {
 payload.role = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
 }

 try {
 const response = await fetch(`/api/admin/dashboard/users/${id}`, {
 method: 'PATCH',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
 },
 body: JSON.stringify(payload)
 });

 const result = await response.json();
 if (!response.ok || !result.success) {
 throw new Error(result.message || 'Failed to update user');
 }

 setUsers(prev => prev.map(user => user.id === id ? result.data : user));
 showToast('User updated successfully.');
 } catch (err) {
 console.error('Failed to update user:', err);
 showToast(err.message || 'Failed to update user', 'error');
 }
 };

const handleGenerateReport = async (e) => {
 e.preventDefault();

 // 1. Validate that we have all required data
 if (!reportSelection.type || !reportSelection.startDate || !reportSelection.endDate) {
 showToast("Please select a report type and a date range.", "error");
 return;
 }

 // 2. Start the loading process
 setIsTaxModalOpen(false);
 showToast(`Compiling ${reportSelection.type} report...`, 'loading');

 try {
 // 3. Trigger the dynamic backend API
 const token = localStorage.getItem('slipz_token');
 
 const response = await axios.get(`${API_URL}/reports/download/${reportSelection.type}`, {
 params: { 
 startDate: reportSelection.startDate, 
 endDate: reportSelection.endDate 
 },
 headers: { 
 Authorization: `Bearer ${token}` 
 },
 responseType: 'blob' // Essential for receiving a PDF file
 });

 // 4. Create a URL for the downloaded Blob
 const blob = new Blob([response.data], { type: 'application/pdf' });
 const url = window.URL.createObjectURL(blob);
 
 // 5. Create a temporary link to trigger download
 const link = document.createElement('a');
 link.href = url;
 
 // Format a clean filename
 const fileName = `${reportSelection.type}_Report_${reportSelection.startDate}_to_${reportSelection.endDate}.pdf`;
 link.setAttribute('download', fileName);
 
 // Append, click, and cleanup
 document.body.appendChild(link);
 link.click();
 link.parentNode.removeChild(link);
 window.URL.revokeObjectURL(url);

 showToast('Report downloaded successfully!');
 
 // Reset selection for next time
 setReportSelection({ type: '', startDate: '', endDate: '' });
 setCurrentTab('type');

 } catch (error) {
 console.error("Report generation failed:", error);
 showToast('Failed to generate report. Please try again.', 'error');
 }
};
 // Memoized Search Filter
 const filteredActivity = useMemo(() => {
 if (!activities) return [];
 return activities.filter(log => 
 log.user.toLowerCase().includes(activitySearch.toLowerCase()) || 
 log.action.toLowerCase().includes(activitySearch.toLowerCase())
 );
 }, [activities, activitySearch]);

 const filteredUsers = useMemo(() => {
 const query = userSearch.trim().toLowerCase();
 if (!query) return users;
 return users.filter(user => {
 const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
 return [displayName, user.email, user.role].some(value =>
 value?.toLowerCase().includes(query)
 );
 });
 }, [users, userSearch]);

 // Loading Screen Match
 if (isLoading) {
 return (
 <div className="flex flex-col h-full min-h-screen bg-app font-sans items-center justify-center" style={{ zoom: '1.22' }}>
 <Loader2 size={21} className="animate-spin text-[#8b6f5a] mb-4" />
 <p className="break-words text-[#3b2a23] font-bold">Loading Dashboard Assets...</p>
 </div>
 );
 }

 return (
 <div className="flex flex-col h-full min-h-screen bg-app font-sans pb-16 selection:bg-accent selection:text-surface relative" style={{ zoom: '1.22' }}>
 
 {/* --- DASHBOARD HEADER --- */}
 <div className="bg-surface border-b border-theme px-3 py-2 sticky top-0 z-30 shadow-sm">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 w-full">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <div>
 <h1 className="text-xs md:text-xs font-bold text-primary tracking-tight" style={{ fontSize: '78%' }}>{t('adminOverviewTitle', 'Admin Control Center')}</h1>
 <p className="sm:text-xs md:text-xs lg:text-xs text-muted font-medium mt-1">{t('adminOverviewSubtitle', 'Real-time overview & infrastructure management')}</p>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row items-center gap-2">
 <span className="hidden md:block sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest mr-2">
 Last Sync: {lastSync}
 </span>
 <div className="bg-surface border border-theme rounded-lg p-1 flex">
 {['24H', '7D', '30D', 'YTD'].map(range => (
 <button 
 key={range}
 onClick={() => setTimeRange(range)}
 className={`px-2 py-1.5 rounded-md text-xs font-bold transition-all ${timeRange === range ? 'bg-[#faf6f0] shadow-sm break-words text-[#3b2a23] border border-[#d6c9b8]' : 'text-[#8b6f5a] hover:break-words text-[#3b2a23]'}`}
 >
 {range}
 </button>
 ))}
 </div>
 <button 
 onClick={() => { fetchDashboardData(true); fetchUsers(); }}
 disabled={isRefreshing}
 className="flex flex-col sm:flex-row items-center gap-2 bg-[#8b6f5a] hover:bg-[#6c5544] text-white px-2 py-1.5 rounded-lg shadow-sm sm:text-xs md:text-xs lg:text-xs font-bold transition-all disabled:opacity-70"
 >
 <Activity size={16} className={isRefreshing ? "animate-spin" : ""} /> 
 {isRefreshing ? 'Syncing...' : 'Sync Data'}
 </button>
 </div>
 </div>
 </div>

 {/* --- MAIN CONTENT GRID --- */}
 <div className="px-3 mt-8 w-full flex flex-col gap-3 md:gap-6">

 {/* 1. FUNCTIONAL QUICK ACTIONS BAR */}
 <div className="grid md:grid-cols-2 grid-cols-1 md:grid-cols-4 gap-2">
 <button 
 onClick={() => setIsAnnouncementModalOpen(true)}
 className="flex items-center justify-center gap-2 bg-white border border-[#d6c9b8] hover:border-[#8b6f5a] hover:bg-[#faf6f0]  text-[#3b2a23] p-3 rounded-lg shadow-sm transition-all group"
 >
 <Megaphone size={16} className="text-[#8b6f5a] group-hover:scale-110 transition-transform" />
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold">Global Announcement</span>
 </button>
 <button 
 onClick={() => setIsWorkspaceModalOpen(true)}
 className="flex items-center justify-center gap-2 bg-white border border-[#d6c9b8] hover:border-[#8b6f5a] hover:bg-[#faf6f0]  text-[#3b2a23] p-3 rounded-lg shadow-sm transition-all group"
 >
 <UserCog size={16} className="text-[#8b6f5a] group-hover:scale-110 transition-transform" />
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold">Manage Workspaces</span>
 </button>
 <button 
 onClick={() => setIsTaxModalOpen(true)}
 className="flex items-center justify-center gap-2 bg-white border border-[#d6c9b8] hover:border-[#8b6f5a] hover:bg-[#faf6f0]  text-[#3b2a23] p-3 rounded-lg shadow-sm transition-all group"
 >
 <BarChart2 size={16} className="text-[#8b6f5a] group-hover:scale-110 transition-transform" />
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold">Generate Tax Report</span>
 </button>
 <button 
 onClick={() => setIsRegionModalOpen(true)}
 className="flex items-center justify-center gap-2 bg-white border border-[#d6c9b8] hover:border-[#8b6f5a] hover:bg-[#faf6f0]  text-[#3b2a23] p-3 rounded-lg shadow-sm transition-all group"
 >
 <Globe size={16} className="text-[#8b6f5a] group-hover:scale-110 transition-transform" />
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold">Region Restrictions</span>
 </button>
 </div>

 {/* 2. DYNAMIC KPI STATS ROW */}
 <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
 {kpis.map((stat, i) => (
 <div className="overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg p-6 shadow-sm hover:border-[#8b6f5a] transition-colors relative overflow-hidden group">
 <div className="flex justify-between items-start mb-4">
 <div className="w-6 h-6 bg-[#faf6f0] rounded-lg flex items-center justify-center border border-[#d6c9b8] group-hover:bg-[#8b6f5a] group-hover:text-white transition-colors text-[#8b6f5a]">
 {stat.icon && <stat.icon size={16} />}
 </div>
 <div className={`flex flex-col sm:flex-row items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${stat.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
 {stat.isUp ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
 {stat.trend}
 </div>
 </div>
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest mb-1">{stat.label}</h3>
 <p className="text-xs font-black font-sans break-words text-[#3b2a23] tracking-tight">{stat.value}</p>
 </div>
 ))}
 </div>

 {/* 3. CHARTS & SYSTEM HEALTH ROW */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
 
 {/* Dynamic Revenue Chart */}
 <div className="lg:col-span-2 overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-sm p-6 flex flex-col transition-all duration-300">
 <div className="flex justify-between items-center mb-8">
 <div>
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23]">Revenue & Volume Trend</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">Displaying metrics for selected period ({timeRange}).</p>
 </div>
 <button 
 onClick={handleExportCSV}
 className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] hover:break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2 border border-[#d6c9b8] px-2 py-2 rounded-lg bg-[#faf6f0] transition-colors shadow-sm"
 >
 <Download size={16} /> Export CSV
 </button>
 </div>
 
 {/* CSS Bar Chart Engine */}
 <div className="flex-1 min-w-0 flex items-end justify-between gap-2 h-64 mt-auto border-b border-[#d6c9b8]/50 pb-2 relative">
 <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
 <div className="border-t border-[#d6c9b8] w-full h-0"></div>
 <div className="border-t border-[#d6c9b8] w-full h-0"></div>
 <div className="border-t border-[#d6c9b8] w-full h-0"></div>
 <div className="border-t border-[#d6c9b8] w-full h-0"></div>
 </div>

 {chartData.length === 0 ? (
 <div className="absolute inset-0 flex items-center justify-center text-[#8b6f5a] sm:text-xs md:text-xs lg:text-xs font-bold">No chart data available for {timeRange}</div>
 ) : (
 chartData.map((data, i) => (
 <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-0 group z-10 h-full justify-end">
 <div className="w-full relative flex justify-center h-full items-end">
 <div className="absolute -top-8 opacity-0 group-hover:opacity-100 bg-[#3b2a23] text-white sm:text-xs md:text-xs lg:text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity whitespace-nowrap z-20 shadow-xl border border-[#8b6f5a]">
 {data.amount != null ? `Amount: £${Number(data.amount).toFixed(2)}` : `Val: ${data.value}%`}
 </div>
 <div 
 className="w-3/4 bg-[#d6c9b8] group-hover:bg-[#8b6f5a] rounded-t-md transition-all duration-500"
 style={{ height: `${Math.max(data.value, 5)}%` }} /* Ensure minimum height for visibility */
 />
 </div>
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase w-full text-center">{data.label}</span>
 </div>
 ))
 )}
 </div>
 </div>

 {/* System Health Module */}
 <div className="overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-sm p-6 flex flex-col">
 <div className="flex justify-between items-center mb-6 border-b border-[#d6c9b8] pb-4">
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
 <ShieldCheck size={16} className="text-[#8b6f5a]" /> Infrastructure Health
 </h3>
 </div>
 <div className="flex flex-col gap-2">
 {systemHealth.map((sys, i) => (
 <div key={i} className="p-3 border border-[#d6c9b8] bg-[#faf6f0] rounded-lg flex items-center justify-between">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <div className={`p-2 rounded-lg ${sys.status === 'Operational' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
 {sys.icon && <sys.icon size={16} />}
 </div>
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{sys.service}</p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">{sys.uptime} Uptime</p>
 </div>
 </div>
 <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${sys.status === 'Operational' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
 {sys.status}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* 4. FUNCTIONAL RECENT ACTIVITY LOG */}
 <div className="overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-sm overflow-hidden flex flex-col mb-10">
 <div className="p-6 border-b border-[#d6c9b8] bg-[#faf6f0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div>
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23]">Global Activity Log</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">Real-time platform events across all workspaces.</p>
 </div>
 
 <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
 <div className="relative flex-1 min-w-0 sm:w-full md:w-38">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b6f5a]" />
 <input 
 type="text" 
 value={activitySearch}
 onChange={(e) => setActivitySearch(e.target.value)}
 placeholder="Search user or action..." 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg pl-9 pr-3 py-2 sm:text-xs md:text-xs lg:text-xs font-medium  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 />
 </div>
 </div>
 </div>

 <div className="overflow-x-auto relative">
 <table className="w-full text-left border-collapse min-w-200">
 <thead>
 <tr className="bg-white border-b border-[#d6c9b8]">
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">User / Workspace</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Action Performed</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Time</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest text-right">Value</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest text-center">Status</th>
 <th className="w-16 md:w-18 px-3 py-2 text-center"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#d6c9b8]/50">
 {filteredActivity.length === 0 ? (
 <tr>
 <td colSpan="6" className="px-3 py-12 text-center text-[#8b6f5a] sm:text-xs md:text-xs lg:text-xs font-medium">
 No activity found matching "{activitySearch}".
 </td>
 </tr>
 ) : (
 filteredActivity.map((log) => (
 <tr key={log.id} className="hover:bg-[#faf6f0] transition-colors">
 <td className="px-3 py-2">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-[#d6c9b8]/40 flex items-center justify-center text-[#8b6f5a] font-bold sm:text-xs md:text-xs lg:text-xs uppercase shrink-0">
 {log.user.charAt(0)}
 </div>
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23] max-w-full md:max-w-37.5 sm:max-w-none">{log.user}</span>
 </div>
 </td>
 <td className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-medium break-words text-[#3b2a23]">
 {log.action}
 </td>
 <td className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm text-[#8b6f5a]">
 {log.time}
 </td>
 <td className="px-3 py-2 text-right">
 {log.amount ? (
 <span className="sm:text-xs md:text-xs lg:text-xs font-sans font-bold break-words text-[#3b2a23]">£{log.amount.toFixed(2)}</span>
 ) : (
 <span className="sm:text-xs md:text-xs lg:text-xs font-sans text-[#8b6f5a]">-</span>
 )}
 </td>
 <td className="px-3 py-2 text-center">
 <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
 log.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
 log.status === 'Pending Review' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
 log.status === 'Reverted' ? 'bg-[#3b2a23] text-white border-[#3b2a23]' :
 'bg-[#faf6f0] text-[#8b6f5a] border-[#d6c9b8]'
 }`}>
 {log.status}
 </span>
 </td>

 {/* Functional Context Menu */}
 <td className="px-3 py-2 text-center relative">
 <button 
 onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === log.id ? null : log.id); }}
 className={`p-2 rounded-lg transition-colors ${activeMenuId === log.id ? 'bg-[#d6c9b8]/40 break-words text-[#3b2a23]' : 'text-[#8b6f5a] hover:break-words text-[#3b2a23] hover:bg-[#d6c9b8]/30'}`}
 >
 <MoreVertical size={16} />
 </button>

 {activeMenuId === log.id && (
 <div className="absolute right-10 top-8 w-29 overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-xl z-50 py-1 flex flex-col text-left animate-fade-in-up">
 <button 
 onClick={(e) => { e.stopPropagation(); handleRowAction('view', log.id); }}
 className="w-full px-2 py-2 sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23] hover:bg-[#faf6f0] flex flex-col sm:flex-row items-center gap-2 font-medium"
 >
 <Eye size={16} className="text-[#8b6f5a]" /> View Audit Trail
 </button>
 <button 
 onClick={(e) => { e.stopPropagation(); handleRowAction('revert', log.id); }}
 className="w-full px-2 py-2 sm:text-xs md:text-xs lg:text-xs text-amber-800 hover:bg-amber-50 flex flex-col sm:flex-row items-center gap-2 font-medium border-t border-[#d6c9b8]/30"
 >
 <RefreshCw size={16} /> Revert Action
 </button>
 <button 
 onClick={(e) => { e.stopPropagation(); handleRowAction('ban', log.id); }}
 className="w-full px-2 py-2 sm:text-xs md:text-xs lg:text-xs text-red-700 hover:bg-red-50 flex flex-col sm:flex-row items-center gap-2 font-medium"
 >
 <Ban size={16} /> Suspend User
 </button>
 </div>
 )}
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>

 {/* 5. CRM USER MANAGEMENT */}
 <div className="overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-sm overflow-hidden flex flex-col mb-10">
 <div className="p-6 border-b border-[#d6c9b8] bg-[#faf6f0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div>
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
 <UserCog size={16} className="text-[#8b6f5a]" /> CRM User Management
 </h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">Manage platform users, roles, and suspend/reactivate accounts from the CRM control panel.</p>
 </div>
 <div className="relative w-full sm:w-96">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b6f5a]" />
 <input
 type="text"
 value={userSearch}
 onChange={(e) => setUserSearch(e.target.value)}
 placeholder="Search customers, email, or role..."
 className="w-full bg-white border border-[#d6c9b8] rounded-lg pl-9 pr-3 py-2 sm:text-xs md:text-xs lg:text-xs font-medium  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 />
 </div>
 </div>

 <div className="overflow-x-auto relative">
 <table className="w-full text-left border-collapse min-w-[800px]">
 <thead>
 <tr className="bg-white border-b border-[#d6c9b8]">
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Name / Email</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Role</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Credits</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Joined</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Status</th>
 <th className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#d6c9b8]/50">
 {filteredUsers.length === 0 ? (
 <tr>
 <td colSpan="6" className="px-3 py-12 text-center text-[#8b6f5a] sm:text-xs md:text-xs lg:text-xs font-medium">
 No users found matching "{userSearch}".
 </td>
 </tr>
 ) : (
 filteredUsers.map((user) => (
 <tr key={user.id} className="hover:bg-[#faf6f0] transition-colors">
 <td className="px-3 py-2">
 <div className="flex flex-col gap-1">
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23] max-w-[280px]">{`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed'}</span>
 <span className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] max-w-[280px]">{user.email}</span>
 </div>
 </td>
 <td className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm font-medium break-words text-[#3b2a23]">{user.role}</td>
 <td className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm break-words text-[#3b2a23] font-sans">{user.exportCreditsUsed}/{user.exportCreditsTotal}</td>
 <td className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm text-[#8b6f5a]">{new Date(user.createdAt).toLocaleDateString()}</td>
 <td className="px-3 py-2">
 <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-widest border ${user.isBlacklisted ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
 {user.isBlacklisted ? 'Suspended' : 'Active'}
 </span>
 </td>
 <td className="px-3 py-2 text-right flex flex-col sm:flex-row sm:justify-end gap-2">
 <button
 onClick={() => handleUserAction('toggleBlacklist', user.id)}
 className={`text-xs font-bold px-3 py-2 rounded-lg transition-all ${user.isBlacklisted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
 >
 {user.isBlacklisted ? 'Reinstate' : 'Suspend'}
 </button>
 <button
 onClick={() => handleUserAction('toggleRole', user.id)}
 className="sm:text-xs md:text-xs lg:text-xs font-bold px-3 py-2 rounded-lg bg-[#faf6f0] border border-[#d6c9b8]  text-[#3b2a23] hover:bg-[#f5efe6]"
 >
 {user.role === 'ADMIN' ? 'Demote' : 'Promote'}
 </button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>

 </div>

 {/* ========================================= */}
 {/* 1. GLOBAL ANNOUNCEMENT MODAL */}
 {/* ========================================= */}
 {isAnnouncementModalOpen && (
 <div className="fixed inset-0 z-70 flex items-center justify-center p-4" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsAnnouncementModalOpen(false)} />
 <form onSubmit={handleSendAnnouncement} className="relative bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-fade-in-up border border-[#d6c9b8]">
 <div className="px-3 py-7 border-b border-[#d6c9b8] flex items-center justify-between bg-[#faf6f0]">
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
 <Megaphone size={16} className="text-[#8b6f5a]" /> Global Announcement
 </h3>
 <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="text-[#8b6f5a] hover:break-words text-[#3b2a23] hover:bg-white p-1.5 rounded-lg transition-colors">
 <X size={16} />
 </button>
 </div>
 <div className="p-6">
 <p className="sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23]/80 mb-5">
 This message will appear as a banner in the dashboard for all active workspaces and be sent via email if enabled.
 </p>
 <div className="flex flex-col gap-2 mb-2">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Broadcast Message</label>
 <textarea 
 required
 rows="4"
 value={announcementText}
 onChange={(e) => setAnnouncementText(e.target.value)}
 placeholder="e.g., System maintenance scheduled for Saturday at 02:00 GMT..." 
 className="w-full p-4 bg-white border border-[#d6c9b8] rounded-lg sm:text-xs md:text-xs lg:text-xs  text-[#3b2a23] font-medium outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a] resize-none transition-all"
 />
 </div>
 </div>
 <div className="flex flex-col sm:flex-row items-center gap-2 p-6 border-t border-[#d6c9b8] bg-[#faf6f0]">
 <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="flex-1 min-w-0 px-2 py-1.5 border border-[#d6c9b8] bg-white  text-[#3b2a23] sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg hover:bg-[#f5efe6] transition-colors shadow-sm">
 Cancel
 </button>
 <button type="submit" className="flex-2 bg-[#8b6f5a] hover:bg-[#6c5544] text-white px-2 py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
 <Send size={16} /> Broadcast Now
 </button>
 </div>
 </form>
 </div>
 )}

 {/* ========================================= */}
 {/* 2. MANAGE WORKSPACES MODAL (REDIRECT) */}
 {/* ========================================= */}
 {isWorkspaceModalOpen && (
 <div className="fixed inset-0 z-70 flex items-center justify-center p-4" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsWorkspaceModalOpen(false)} />
 <div className="relative overflow-x-auto bg-white rounded-lg w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-fade-in-up border border-[#d6c9b8] p-7 text-center items-center">
 <div className="w-16 md:w-18 h-18 bg-[#faf6f0] border border-[#d6c9b8] rounded-lg flex items-center justify-center text-[#8b6f5a] mb-6">
 <UserCog size={16} />
 </div>
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] mb-2">Workspace CRM</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mb-8 font-medium">
 Managing users, billing profiles, and workspace allocations happens in the dedicated Users CRM module.
 </p>
 <div className="flex w-full gap-2">
 <button onClick={() => setIsWorkspaceModalOpen(false)} className="flex-1 min-w-0 px-2 py-1.5 border border-[#d6c9b8] bg-white  text-[#3b2a23] sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg hover:bg-[#f5efe6] transition-colors">
 Close
 </button>
 <button onClick={() => { setIsWorkspaceModalOpen(false); showToast('Routing to User CRM module...'); }} className="flex-1 min-w-0 bg-[#3b2a23] hover:bg-black text-white px-2 py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-colors">
 Go to CRM
 </button>
 </div>
 </div>
 </div>
 )}

{isTaxModalOpen && (
 <div className="fixed inset-0 z-70 flex items-center justify-center p-4" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/60 backdrop-blur-sm" onClick={() => setIsTaxModalOpen(false)} />
 <form onSubmit={handleGenerateReport} className="relative bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-[#d6c9b8]">
 
 {/* Header with Tabs */}
 <div className="bg-[#faf6f0] border-b border-[#d6c9b8]">
 <div className="flex px-3 pt-4 gap-2">
 <button type="button" onClick={() => setCurrentTab('type')} className={`pb-3 text-xs font-bold border-b-2 transition-colors ${currentTab === 'type' ? 'border-[#8b6f5a] text-[#8b6f5a]' : 'border-transparent text-[#8b6f5a]/50'}`}>1. Select Report</button>
 <button type="button" disabled={!reportSelection.type} onClick={() => setCurrentTab('dates')} className={`pb-3 text-xs font-bold border-b-2 transition-colors ${currentTab === 'dates' ? 'border-[#8b6f5a] text-[#8b6f5a]' : 'border-transparent text-[#8b6f5a]/50 disabled:opacity-30'}`}>2. Define Period</button>
 </div>
 </div>

 <div className="p-6 min-h-[250px]">
{currentTab === 'type' ? (
 <div className="space-y-4">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">
 Report Category
 </label>
 <select 
 value={reportSelection.type} 
 onChange={(e) => setReportSelection({...reportSelection, type: e.target.value})}
 className="w-full px-2 py-2 bg-white border-2 border-[#d6c9b8] rounded-lg sm:text-xs md:text-xs lg:text-xs  text-[#3b2a23] font-medium outline-none focus:border-[#8b6f5a] cursor-pointer"
 >
 <option value="" disabled>Select a report type...</option>
 {reportOptions.map((opt) => (
 <option key={opt.id} value={opt.id}>
 {opt.label}
 </option>
 ))}
 </select>
 
 {/* Description box to give context to the selected report */}
 <div className="p-4 bg-[#faf6f0] rounded-lg border border-[#d6c9b8] sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a]">
 {reportOptions.find(o => o.id === reportSelection.type)?.desc || "Please select a report to see details."}
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex flex-col gap-2">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase">Start Date</label>
 <input name="startDate" type="date" required className="w-full px-2 py-1.5 border border-[#d6c9b8] rounded-lg outline-none focus:border-[#8b6f5a]" onChange={(e) => setReportSelection({...reportSelection, startDate: e.target.value})} />
 </div>
 <div className="flex flex-col gap-2">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase">End Date</label>
 <input name="endDate" type="date" required className="w-full px-2 py-1.5 border border-[#d6c9b8] rounded-lg outline-none focus:border-[#8b6f5a]" onChange={(e) => setReportSelection({...reportSelection, endDate: e.target.value})} />
 </div>
 </div>
 )}
 </div>

 {/* Footer Buttons */}
 <div className="flex flex-col sm:flex-row items-center gap-2 p-6 border-t border-[#d6c9b8] bg-[#faf6f0]">
 {currentTab === 'dates' && (
 <button type="button" onClick={() => setCurrentTab('type')} className="px-2 py-1.5 text-[#8b6f5a] font-bold sm:text-xs md:text-xs lg:text-xs">Back</button>
 )}
 <div className="flex-1 min-w-0" />
 {currentTab === 'type' ? (
 <button type="button" disabled={!reportSelection.type} onClick={() => setCurrentTab('dates')} className="bg-[#3b2a23] text-white px-3 py-1.5 rounded-lg font-bold sm:text-xs md:text-xs lg:text-xs disabled:opacity-50">Next</button>
 ) : (
 <button type="submit" className="bg-[#8b6f5a] text-white px-3 py-1.5 rounded-lg font-bold sm:text-xs md:text-xs lg:text-xs flex flex-col sm:flex-row items-center gap-2">
 <Download size={16} /> Generate PDF
 </button>
 )}
 </div>
 </form>
 </div>
)}

 {/* ========================================= */}
 {/* 4. REGION RESTRICTIONS MODAL */}
 {/* ========================================= */}
 {isRegionModalOpen && (
 <div className="fixed inset-0 z-70 flex items-center justify-center p-4" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsRegionModalOpen(false)} />
 <div className="relative overflow-x-auto bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-fade-in-up border border-[#d6c9b8]">
 <div className="px-3 py-7 border-b border-[#d6c9b8] flex items-center justify-between bg-[#faf6f0]">
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
 <Globe size={16} className="text-[#8b6f5a]" /> API Region Restrictions
 </h3>
 <button type="button" onClick={() => setIsRegionModalOpen(false)} className="text-[#8b6f5a] hover:break-words text-[#3b2a23] hover:bg-white p-1.5 rounded-lg transition-colors">
 <X size={16} />
 </button>
 </div>
 <div className="p-6">
 <p className="sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23]/80 mb-5">
 Block traffic or purchases from specific geographic regions for compliance (e.g., GDPR, CAN-SPAM).
 </p>
 <div className="flex flex-col gap-2">
 {['United Kingdom & EU', 'United States (North America)', 'Asia & Pacific', 'Middle East & Africa'].map((region, i) => (
 <label key={i} className="flex items-center justify-between p-3 border border-[#d6c9b8] rounded-lg hover:bg-[#faf6f0] cursor-pointer transition-colors group">
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{region}</span>
 <div className="relative flex items-center">
 <input type="checkbox" defaultChecked={i < 2} className="peer sr-only" />
 <div className="w-11 h-6 bg-[#d6c9b8] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:overflow-x-auto bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8b6f5a]"></div>
 </div>
 </label>
 ))}
 </div>
 </div>
 <div className="flex flex-col sm:flex-row items-center gap-2 p-6 border-t border-[#d6c9b8] bg-[#faf6f0]">
 <button type="button" onClick={() => setIsRegionModalOpen(false)} className="flex-1 min-w-0 px-2 py-1.5 border border-[#d6c9b8] bg-white  text-[#3b2a23] sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg hover:bg-[#f5efe6] transition-colors shadow-sm">
 Discard Changes
 </button>
 <button onClick={() => { setIsRegionModalOpen(false); showToast('Geo-restrictions updated.'); }} className="flex-2 bg-[#3b2a23] hover:bg-black text-white px-2 py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
 <Check size={16} /> Save Rules
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ========================================= */}
 {/* TOAST NOTIFICATION SYSTEM */}
 {/* ========================================= */}
 {toast && (
 <div className="fixed bottom-10 right-10 z-80 bg-[#3b2a23] text-white px-3 py-2 rounded-lg shadow-2xl flex flex-col sm:flex-row items-center gap-2 animate-fade-in-up border border-[#8b6f5a]" style={{ transform: 'scale(0.9)' }}>
 {toast.type === 'loading' ? (
 <Loader2 size={16} className="text-[#d6c9b8] animate-spin" />
 ) : toast.type === 'error' ? (
 <AlertTriangle size={16} className="text-red-400" />
 ) : (
 <CheckCircle2 size={16} className="text-emerald-400" />
 )}
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold">{toast.msg}</p>
 </div>
 )}

 </div>
 );
};

export default AdminDashboard;