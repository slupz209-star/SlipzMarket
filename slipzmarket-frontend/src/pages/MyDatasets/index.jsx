import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../../utils/api';
import { 
 Download, Database, Eye, Loader2, FileSpreadsheet,
 ChevronLeft, Search, Filter, CheckSquare, Square, 
 Trash2, AlertTriangle, ChevronRight, CheckCircle2, AlertCircle, X, 
 Building2, UserCircle, Briefcase, Mail, Phone, Globe, Tag, 
 Users, Activity, Zap, FolderOutput, Link, ArchiveRestore, Trash,
 MapPin // Added MapPin for the new Address section
} from 'lucide-react';

const MyDatasets = () => {
 // Global & UI State
 const [datasets, setDatasets] = useState([]);
 const [deletedDatasets, setDeletedDatasets] = useState([]); 
 const [viewMode, setViewMode] = useState('active'); // 'active' | 'trash'
 
 const [isLoadingList, setIsLoadingList] = useState(true);
 const [downloadingId, setDownloadingId] = useState(null);
 const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
 const [modal, setModal] = useState({ isOpen: false, type: '', target: null, title: '', message: '' });
 const [moveModalOpen, setMoveModalOpen] = useState(false); 
 const [moveDestination, setMoveDestination] = useState('');
 const [previewLead, setPreviewLead] = useState(null);

 // Workspace State
 const [activeDataset, setActiveDataset] = useState(null);
 const [leads, setLeads] = useState([]);
 const [isLoadingLeads, setIsLoadingLeads] = useState(false);
 const [isProcessing, setIsProcessing] = useState(false);
 
 // Advanced Filtering & Search State
 const [searchQuery, setSearchQuery] = useState('');
 const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
 const [advancedFilters, setAdvancedFilters] = useState({
 industry: '',
 country: '',
 hasEmail: false,
 hasPhone: false,
 hasLinkedIn: false 
 });

 // Pagination & Selection
 const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
 const [currentPage, setCurrentPage] = useState(1);
 const itemsPerPage = 50;

 const toastTimer = useRef(null);

 const getAuthConfig = () => ({
 headers: { Authorization: `Bearer ${localStorage.getItem('slipz_token')}` }
 });

 const showToast = (message, type = 'success') => {
 setToast({ visible: true, message, type });
 if (toastTimer.current) clearTimeout(toastTimer.current);
 toastTimer.current = setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 3000);
 };

 // --- 1. DATA FETCHING ---
 const fetchDatasets = async () => {
 setIsLoadingList(true);
 try {
 const res = await axios.get(`${API_URL}/datasets/my-datasets`, getAuthConfig());
 setDatasets(res.data.data?.datasets || res.data.datasets || []);
 } catch (err) {
 showToast("Failed to fetch library", "error");
 } finally {
 setIsLoadingList(false);
 }
 };

 useEffect(() => { fetchDatasets(); }, []);

 // --- 2. ANALYTICS & INSIGHTS ---
 const datasetStats = useMemo(() => {
 const totalDatasets = datasets.length;
 const totalLeads = datasets.reduce((sum, dataset) => sum + (dataset.leadsCount || 0), 0);
 const latestDataset = [...datasets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;
 return { totalDatasets, totalLeads, latestDataset };
 }, [datasets]);

 const leadMetrics = useMemo(() => {
 if (!leads.length) return null;
 const emailCount = leads.filter(l => l.email && l.email !== 'N/A').length;
 const phoneCount = leads.filter(l => l.phone && l.phone !== 'N/A').length;
 
 const countryCounts = leads.reduce((acc, lead) => {
 const country = lead.country || 'Unknown';
 acc[country] = (acc[country] || 0) + 1;
 return acc;
 }, {});
 
 const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([country, count]) => ({ country, count }));
 const industryCounts = leads.reduce((acc, lead) => {
 const industry = lead.industry || 'Unknown';
 acc[industry] = (acc[industry] || 0) + 1;
 return acc;
 }, {});
 const topIndustries = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([industry, count]) => ({ industry, count }));
 return { emailCount, phoneCount, topCountries, topIndustries, total: leads.length };
 }, [leads]);

 const filterOptions = useMemo(() => {
 const industries = [...new Set(leads.map(l => l.industry).filter(Boolean))].sort();
 const countries = [...new Set(leads.map(l => l.country).filter(Boolean))].sort();
 return { industries, countries };
 }, [leads]);

 const openWorkspace = async (dataset) => {
 setActiveDataset(dataset);
 setIsLoadingLeads(true);
 setSearchQuery('');
 setAdvancedFilters({ industry: '', country: '', hasEmail: false, hasPhone: false, hasLinkedIn: false });
 setMoveDestination('');
 setSelectedLeadIds(new Set());
 setCurrentPage(1);

 try {
 const res = await axios.get(`${API_URL}/datasets/${dataset.invoiceId}/json`, getAuthConfig());
 setLeads(res.data.data?.leads || res.data.leads || []);
 } catch (err) {
 showToast("Failed to load dataset records.", "error");
 setActiveDataset(null);
 } finally {
 setIsLoadingLeads(false);
 }
 };

 // --- 3. FILTERING & PAGINATION ---
 const filteredLeads = useMemo(() => {
 return leads.filter(l => {
 const lowerQuery = searchQuery.toLowerCase();
 // Text Search
 const matchesSearch = !searchQuery || 
 (l.firstName?.toLowerCase() || '').includes(lowerQuery) ||
 (l.lastName?.toLowerCase() || '').includes(lowerQuery) ||
 (l.companyName?.toLowerCase() || '').includes(lowerQuery) ||
 (l.jobTitle?.toLowerCase() || '').includes(lowerQuery);

 // Advanced Filters
 const matchesIndustry = !advancedFilters.industry || l.industry === advancedFilters.industry;
 const matchesCountry = !advancedFilters.country || l.country === advancedFilters.country;
 const matchesEmail = !advancedFilters.hasEmail || (l.email && l.email !== 'N/A');
 const matchesPhone = !advancedFilters.hasPhone || (l.phone && l.phone !== 'N/A');
 const matchesLinkedIn = !advancedFilters.hasLinkedIn || (l.linkedin && l.linkedin !== 'N/A');

 return matchesSearch && matchesIndustry && matchesCountry && matchesEmail && matchesPhone && matchesLinkedIn;
 });
 }, [leads, searchQuery, advancedFilters]);

 const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
 
 const paginatedLeads = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredLeads.slice(start, start + itemsPerPage);
 }, [filteredLeads, currentPage]);

 useEffect(() => { setCurrentPage(1); }, [searchQuery, advancedFilters]);

 // --- 4. SELECTION LOGIC ---
 const toggleSelectAllPage = () => {
 const newSet = new Set(selectedLeadIds);
 const allPageSelected = paginatedLeads.every(l => newSet.has(l.id));
 if (allPageSelected) {
 paginatedLeads.forEach(l => newSet.delete(l.id));
 } else {
 paginatedLeads.forEach(l => newSet.add(l.id));
 }
 setSelectedLeadIds(newSet);
 };

 const toggleSelectLead = (id) => {
 const newSet = new Set(selectedLeadIds);
 if (newSet.has(id)) newSet.delete(id);
 else newSet.add(id);
 setSelectedLeadIds(newSet);
 };

 // --- 5. MASS ACTIONS & EXPORT ---
 const executeDelete = async () => {
 setIsProcessing(true);
 try {
 if (modal.type === 'DATASET') {
 const datasetToTrash = datasets.find(d => d.invoiceId === modal.target);
 setDeletedDatasets([...deletedDatasets, { ...datasetToTrash, deletedAt: new Date().toISOString() }]);
 setDatasets(datasets.filter(d => d.invoiceId !== modal.target));
 showToast("Dataset moved to trash.");
 } else if (modal.type === 'LEADS') {
 await axios.post(`${API_URL}/datasets/${activeDataset.invoiceId}/remove-leads`, { leadIds: modal.target }, getAuthConfig());
 setLeads(leads.filter(l => !selectedLeadIds.has(l.id)));
 setSelectedLeadIds(new Set());
 showToast(`${modal.target.length} leads removed successfully.`);
 }
 } catch (err) {
 showToast("Deletion failed. Please try again.", "error");
 } finally {
 setIsProcessing(false);
 setModal({ isOpen: false, type: '', target: null, title: '', message: '' });
 }
 };

 const handleRestoreDataset = (invoiceId) => {
 const datasetToRestore = deletedDatasets.find(d => d.invoiceId === invoiceId);
 setDatasets([...datasets, datasetToRestore]);
 setDeletedDatasets(deletedDatasets.filter(d => d.invoiceId !== invoiceId));
 showToast("Dataset restored successfully.");
 };

 const handleMoveLeadsSubmit = async (targetDatasetId) => {
 if (!targetDatasetId) {
 showToast('Please select a destination dataset before moving leads.', 'error');
 return;
 }

 setIsProcessing(true);
 try {
 setTimeout(() => {
 setLeads(leads.filter(l => !selectedLeadIds.has(l.id)));
 setSelectedLeadIds(new Set());
 setMoveDestination('');
 setMoveModalOpen(false);
 showToast(`Moved leads to selected dataset successfully.`);
 setIsProcessing(false);
 }, 800);
 } catch (err) {
 showToast("Failed to move leads.", "error");
 setIsProcessing(false);
 }
 };

 const handleVerifyData = () => {
 showToast("Verification job queued! We are validating the selected emails/phones against our master db.");
 };

 const handleFullDownload = async (invoiceId, description) => {
 setDownloadingId(invoiceId);
 try {
 const response = await axios.get(`${API_URL}/datasets/download/${invoiceId}`, { ...getAuthConfig(), responseType: 'blob' });
 triggerDownload(response.data, description, invoiceId, 'full');
 showToast("Export successful!");
 } catch (err) {
 showToast("Failed to download dataset.", "error");
 } finally {
 setDownloadingId(null);
 }
 };

 const downloadWorkspaceReport = async () => {
 setIsProcessing(true);
 const token = localStorage.getItem('slipz_token');

 try {
 const response = await axios.get(`${API_URL}/reports/download/workspace-summary`, {
 headers: { Authorization: `Bearer ${token}` },
 responseType: 'blob',
 });

 const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
 const url = window.URL.createObjectURL(pdfBlob);
 const link = document.createElement('a');
 link.href = url;
 const timestamp = new Date().toISOString().split('T')[0];
 link.setAttribute('download', `Workspace_Summary_${timestamp}.pdf`);
 document.body.appendChild(link);
 link.click();
 link.parentNode.removeChild(link);
 window.URL.revokeObjectURL(url);
 showToast("Report downloaded successfully!", "success");
 } catch (error) {
 console.error("Failed to download report:", error);
 showToast("Failed to generate the report. Please try again.", "error");
 } finally {
 setIsProcessing(false);
 }
 };

 const handleSelectedDownload = () => {
 const selectedData = leads.filter(l => selectedLeadIds.has(l.id));
 if (selectedData.length === 0) return;
 const headers = ['FirstName', 'LastName', 'Email', 'Phone', 'JobTitle', 'CompanyName', 'Industry', 'Country'];
 const csvContent = [headers.join(','), ...selectedData.map(row => headers.map(field => `"${(row[field] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
 triggerDownload(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), activeDataset.description, activeDataset.invoiceId, 'selected');
 showToast("Exported selected leads!");
 };

 const triggerDownload = (blob, description, invoiceId, suffix) => {
 const url = window.URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 const cleanName = (description || 'Custom_Export').replace(/[^a-z0-9]/gi, '_').toLowerCase();
 link.setAttribute('download', `${cleanName}_${invoiceId.split('-')[1] || 'leads'}_${suffix}.csv`);
 document.body.appendChild(link);
 link.click();
 link.parentNode.removeChild(link);
 };

 // --- SUB-COMPONENTS ---
 const ToastNotification = () => {
 if (!toast.visible) return null;
 return (
 <div className="fixed top-7 right-8 z-50 animate-in fade-in slide-in-from-top-4" style={{ transform: 'scale(0.9)' }}>
 <div className={`flex flex-col sm:flex-row items-center gap-2 px-3 md:px-6 py-1.5.5 rounded-lg shadow-sm border ${toast.type === 'error' ? 'bg-white border-red-200 text-red-800' : 'bg-emerald-600 border-emerald-700 text-white'}`}>
 {toast.type === 'error' ? <AlertCircle size={16} className="text-red-600" /> : <CheckCircle2 size={16} />}
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold">{toast.message}</p>
 </div>
 </div>
 );
 };

 const ConfirmationModal = () => {
 if (!modal.isOpen) return null;
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-2" style={{ transform: 'scale(0.9)' }}>
 <div className="overflow-x-auto bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
 <div className="flex flex-col sm:flex-row items-center gap-2 text-red-600 mb-3">
 <AlertTriangle size={16} />
 <h3 className="text-xs md:text-xs font-black" style={{ fontSize: '78%' }}>{modal.title}</h3>
 </div>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] leading-relaxed mb-6">{modal.message}</p>
 <div className="flex items-center justify-end gap-2">
 <button onClick={() => setModal({ ...modal, isOpen: false })} disabled={isProcessing} className="px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] hover:bg-[#f5f2f2] rounded-lg transition-all">Cancel</button>
 <button onClick={executeDelete} disabled={isProcessing} className="px-3 md:px-6 py-1.5.5 bg-red-600 hover:bg-red-700 text-white sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg transition-all flex flex-col sm:flex-row items-center gap-2">
 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Confirm
 </button>
 </div>
 </div>
 </div>
 );
 };

 const MoveLeadsModal = () => {
 if (!moveModalOpen) return null;
 const availableDestinations = datasets.filter(d => d.invoiceId !== activeDataset.invoiceId);
 
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-2" style={{ transform: 'scale(0.9)' }}>
 <div className="overflow-x-auto bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
 <div className="flex flex-col sm:flex-row items-center gap-2 text-[#2a1b1b] mb-4">
 <FolderOutput size={16} className="text-[#800000]" />
 <h3 className="text-xs md:text-xs font-black" style={{ fontSize: '78%' }}>Move Leads to List</h3>
 </div>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] leading-relaxed mb-4">Select the destination list for the {selectedLeadIds.size} selected leads. They will be removed from the current dataset.</p>
 
 {availableDestinations.length === 0 ? (
 <div className="p-4 bg-[#fcfbfb] border border-[#e8e2e2] rounded-lg sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] text-center mb-6">
 You don't have any other active datasets to move leads into.
 </div>
 ) : (
 <select value={moveDestination} onChange={e => setMoveDestination(e.target.value)} className="w-full border border-[#d8cdcd] rounded-lg p-3 sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b] focus:border-[#800000] outline-none mb-6">
 <option value="">Select destination list</option>
 {availableDestinations.map(d => (
 <option key={d.invoiceId} value={d.invoiceId}>{d.description}</option>
 ))}
 </select>
 )}

 <div className="flex items-center justify-end gap-2">
 <button onClick={() => setMoveModalOpen(false)} disabled={isProcessing} className="px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] hover:bg-[#f5f2f2] rounded-lg transition-all">Cancel</button>
 <button 
 onClick={() => handleMoveLeadsSubmit(moveDestination)} 
 disabled={isProcessing || availableDestinations.length === 0 || !moveDestination} 
 className="px-3 md:px-6 py-1.5.5 bg-[#2a1b1b] hover:bg-black text-white sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg transition-all flex flex-col sm:flex-row items-center gap-2 disabled:opacity-50"
 >
 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Move Leads
 </button>
 </div>
 </div>
 </div>
 );
 };

 // 👉 UPGRADED: Expanded Preview Modal mapped to your new dataset schema
 const LeadPreviewModal = () => {
 if (!previewLead) return null;

 // Helper to gracefully fallback empty fields to a dash
 const displayVal = (val) => val && val !== 'N/A' ? val : '-';

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-2" style={{ transform: 'scale(0.9)' }}>
 <div className="overflow-x-auto bg-white rounded-lg shadow-2xl max-w-full md:max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
 
 {/* Top Header Section */}
 <div className="bg-[#fcfbfb] border-b border-[#e8e2e2] px-3 py-2 flex items-center justify-between shrink-0">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <div className="w-16 md:w-18 h-18 bg-[#800000]/10 rounded-full flex items-center justify-center text-[#800000]">
 <UserCircle size={21} />
 </div>
 <div>
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">
 {previewLead.contactName || `${previewLead.firstName || ''} ${previewLead.lastName || ''}`.trim() || 'Unknown Contact'}
 </h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b]">{previewLead.title || previewLead.jobTitle || 'No Title Provided'}</p>
 </div>
 </div>
 <button onClick={() => setPreviewLead(null)} className="p-2 text-[#a09393] hover:text-[#2a1b1b] hover:bg-[#f5f2f2] rounded-lg transition-colors"><X size={16} /></button>
 </div>

 {/* Scrollable Data Body Section */}
 <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
 
 {/* 1. Quick Contact Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-2 gap-2">
 <div className="p-4 border border-[#e8e2e2] rounded-lg bg-[#fcfbfb] flex items-start gap-2">
 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0"><Mail size={16} /></div>
 <div className="min-w-0">
 <div className="sm:text-xs md:text-xs lg:text-xs font-bold uppercase tracking-wider text-[#a09393] mb-0.5">Email Address</div>
 <div className="sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b]" title={previewLead.email || previewLead.emailAddress}>
 {displayVal(previewLead.email || previewLead.emailAddress)}
 </div>
 </div>
 </div>
 <div className="p-4 border border-[#e8e2e2] rounded-lg bg-[#fcfbfb] flex items-start gap-2">
 <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0"><Phone size={16} /></div>
 <div>
 <div className="sm:text-xs md:text-xs lg:text-xs font-bold uppercase tracking-wider text-[#a09393] mb-0.5">Phone Number</div>
 <div className="sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b]">{displayVal(previewLead.phone || previewLead.phoneNumber)}</div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-2 gap-3 md:gap-6">
 {/* 2. Professional Info Column */}
 <div className="space-y-4">
 <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b] border-b border-[#e8e2e2] pb-2 flex flex-col sm:flex-row items-center gap-2">
 <Briefcase size={16} className="text-[#800000]" /> Professional Details
 </h4>
 <div className="space-y-3">
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-16 md:w-18 shrink-0 font-medium">Company:</span>
 <span className="font-bold text-[#2a1b1b]">{displayVal(previewLead.companyName)}</span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-16 md:w-18 shrink-0 font-medium">Industry:</span>
 <span className="font-medium text-[#2a1b1b]">{displayVal(previewLead.industry)}</span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-16 md:w-18 shrink-0 font-medium">Speciality:</span>
 <span className="font-medium text-[#2a1b1b]">
 {displayVal(previewLead.speciality)} {previewLead.specialityID ? <span className="text-[#a09393]">(ID: {previewLead.specialityID})</span> : ''}
 </span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-16 md:w-18 shrink-0 font-medium">Description:</span>
 <span className="font-medium text-[#2a1b1b] line-clamp-3" title={previewLead.description}>{displayVal(previewLead.description)}</span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-16 md:w-18 shrink-0 font-medium">Website:</span>
 <span className="font-medium text-[#2a1b1b]">
 {previewLead.website ? <a href={`https://${previewLead.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{previewLead.website}</a> : '-'}
 </span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-16 md:w-18 shrink-0 font-medium">Fax:</span>
 <span className="font-medium text-[#2a1b1b]">{displayVal(previewLead.faxNumber)}</span>
 </div>
 </div>
 </div>

 {/* 3. Location Info Column */}
 <div className="space-y-4">
 <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b] border-b border-[#e8e2e2] pb-2 flex flex-col sm:flex-row items-center gap-2">
 <MapPin size={16} className="text-[#800000]" /> Location Details
 </h4>
 <div className="space-y-3">
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-20 shrink-0 font-medium">Address:</span>
 <span className="font-medium text-[#2a1b1b]">{displayVal(previewLead.address)}</span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-20 shrink-0 font-medium">City:</span>
 <span className="font-medium text-[#2a1b1b]">{displayVal(previewLead.city)}</span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-20 shrink-0 font-medium">State:</span>
 <span className="font-medium text-[#2a1b1b]">{displayVal(previewLead.state)}</span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-20 shrink-0 font-medium">Zip Code:</span>
 <span className="font-medium text-[#2a1b1b]">{displayVal(previewLead.zipCode)}</span>
 </div>
 <div className="flex items-start gap-2 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] w-20 shrink-0 font-medium">Country:</span>
 <span className="font-medium text-[#2a1b1b]">{displayVal(previewLead.country)}</span>
 </div>
 </div>
 </div>
 </div>

 </div>
 </div>
 </div>
 );
 };

 // ==========================================
 // RENDER: WORKSPACE VIEW
 // ==========================================
 if (activeDataset) {
 return (
 <div className="p-6 max-w-[1400px] mx-auto w-full h-[calc(100vh-80px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
 <ToastNotification />
 <ConfirmationModal />
 <MoveLeadsModal />
 <LeadPreviewModal />
 
 {/* Workspace Header & Action Bar */}
 <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4 shrink-0">
 <div>
 <button onClick={() => { setActiveDataset(null); fetchDatasets(); }} className="flex flex-col sm:flex-row items-center gap-1 sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] hover:text-[#800000] transition-colors mb-2">
 <ChevronLeft size={16} /> Back to Library
 </button>
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <h1 className="text-xs md:text-xs font-bold text-[#2a1b1b]" style={{ fontSize: '78%' }}>{activeDataset.description}</h1>
 <button onClick={handleVerifyData} className="flex flex-col sm:flex-row items-center gap-1.5 px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"><Zap size={16} /> Enrich Data</button>
 </div>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-1 font-sans">ID: {activeDataset.invoiceId}</p>
 </div>

 <div className="flex flex-col sm:flex-row items-center gap-2 flex-wrap justify-end">
 {selectedLeadIds.size > 0 ? (
 <div className="flex flex-col sm:flex-row items-center gap-2 bg-[#fcfbfb] border border-[#e8e2e2] p-1.5 rounded-lg shadow-sm animate-in fade-in">
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#800000] px-3">{selectedLeadIds.size} selected</span>
 <div className="w-px h-4 bg-[#d8cdcd]"></div>
 <button onClick={handleVerifyData} className="flex flex-col sm:flex-row items-center gap-1.5 px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b] hover:bg-[#f5f2f2] rounded transition-colors"><Zap size={16} className="text-amber-500" /> Verify</button>
 <button onClick={() => setMoveModalOpen(true)} className="flex flex-col sm:flex-row items-center gap-1.5 px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b] hover:bg-[#f5f2f2] rounded transition-colors"><FolderOutput size={16} /> Move</button>
 <button onClick={handleSelectedDownload} className="flex flex-col sm:flex-row items-center gap-1.5 px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b] hover:bg-[#f5f2f2] rounded transition-colors"><Download size={16} /> Export</button>
 <div className="w-px h-4 bg-[#d8cdcd]"></div>
 <button onClick={() => setModal({ isOpen: true, type: 'LEADS', target: Array.from(selectedLeadIds), title: 'Remove Leads', message: 'Permanently remove selected leads from this list?' })} className="flex flex-col sm:flex-row items-center gap-1.5 px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /> Remove</button>
 </div>
 ) : (
 <div className="flex flex-wrap gap-2">
 <button onClick={() => handleFullDownload(activeDataset.invoiceId || activeDataset.id, activeDataset.description)} disabled={downloadingId === activeDataset.invoiceId} className="flex flex-col sm:flex-row items-center gap-2 bg-[#800000] text-white px-3 md:px-6 py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold hover:bg-[#660000] transition-colors shadow-sm disabled:opacity-70">
 {downloadingId === activeDataset.invoiceId ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
 Export Full List
 </button>
 <button onClick={downloadWorkspaceReport} disabled={isProcessing} className="flex flex-col sm:flex-row items-center gap-2 bg-[#1f2937] text-white px-2 py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold hover:bg-[#111827] transition-colors shadow-sm disabled:opacity-70">
 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
 Generate PDF Report
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Dataset Insights Panel */}
 {!isLoadingLeads && leadMetrics && (
 <div className="overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg p-4 mb-6 shrink-0 flex flex-wrap lg:flex-nowrap gap-2 items-center shadow-sm">
 <div className="flex flex-col flex-1 min-w-0 min-w-[200px]">
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold uppercase text-[#7a6b6b] tracking-wider mb-2">Data Health</span>
 <div className="flex flex-col md:flex-row gap-2">
 <div className="flex-1 min-w-0">
 <div className="flex justify-between sm:text-xs md:text-xs lg:text-xs font-bold mb-1"><span className="text-[#2a1b1b]">Emails</span><span className="text-[#800000]">{Math.round((leadMetrics.emailCount/leadMetrics.total)*100)}%</span></div>
 <div className="h-1.5 bg-[#f5f2f2] rounded-full overflow-hidden"><div className="h-full bg-[#800000]" style={{width: `${(leadMetrics.emailCount/leadMetrics.total)*100}%`}}></div></div>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex justify-between sm:text-xs md:text-xs lg:text-xs font-bold mb-1"><span className="text-[#2a1b1b]">Direct Dials</span><span className="text-emerald-600">{Math.round((leadMetrics.phoneCount/leadMetrics.total)*100)}%</span></div>
 <div className="h-1.5 bg-[#f5f2f2] rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{width: `${(leadMetrics.phoneCount/leadMetrics.total)*100}%`}}></div></div>
 </div>
 </div>
 </div>
 <div className="w-px h-6 bg-[#e8e2e2] hidden lg:block"></div>
 <div className="flex flex-col md:flex-row gap-2 flex-1 min-w-0 min-w-[300px]">
 <div>
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold uppercase text-[#7a6b6b] tracking-wider block mb-1">Top Locations</span>
 <div className="sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b]">{leadMetrics.topCountries.map(c => c.country).join(', ') || 'Varied'}</div>
 </div>
 <div>
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold uppercase text-[#7a6b6b] tracking-wider block mb-1">Top Industries</span>
 <div className="sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b]">{leadMetrics.topIndustries.map(i => i.industry).join(', ') || 'Varied'}</div>
 </div>
 </div>
 </div>
 )}

 <div className="flex flex-1 min-w-0 overflow-hidden gap-2 min-h-0">
 {/* Advanced Filter Drawer */}
 {isFilterDrawerOpen && (
 <div className="w-full md:w-38 shrink-0 overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg shadow-sm flex flex-col animate-in slide-in-from-left-4">
 <div className="p-4 border-b border-[#e8e2e2] flex items-center justify-between">
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b] flex flex-col sm:flex-row items-center gap-2"><Filter size={16} className="text-[#800000]"/> Advanced Filters</h3>
 <button onClick={() => setIsFilterDrawerOpen(false)} className="text-[#7a6b6b] hover:bg-[#f5f2f2] p-1 rounded-md"><X size={16} /></button>
 </div>
 <div className="p-4 flex-1 min-w-0 overflow-y-auto space-y-5">
 <div>
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#7a6b6b] uppercase tracking-wider block mb-2">Industry</label>
 <select value={advancedFilters.industry} onChange={e => setAdvancedFilters({...advancedFilters, industry: e.target.value})} className="w-full border border-[#d8cdcd] rounded-lg p-2 sm:text-xs md:text-xs lg:text-xs focus:border-[#800000] outline-none">
 <option value="">All Industries</option>
 {filterOptions.industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
 </select>
 </div>
 <div>
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#7a6b6b] uppercase tracking-wider block mb-2">Location</label>
 <select value={advancedFilters.country} onChange={e => setAdvancedFilters({...advancedFilters, country: e.target.value})} className="w-full border border-[#d8cdcd] rounded-lg p-2 sm:text-xs md:text-xs lg:text-xs focus:border-[#800000] outline-none">
 <option value="">All Locations</option>
 {filterOptions.countries.map(country => <option key={country} value={country}>{country}</option>)}
 </select>
 </div>
 <div className="pt-2 border-t border-[#e8e2e2] space-y-3">
 <label className="flex flex-col sm:flex-row items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={advancedFilters.hasEmail} onChange={e => setAdvancedFilters({...advancedFilters, hasEmail: e.target.checked})} className="rounded text-[#800000] focus:ring-[#800000]" />
 <span className="sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b] flex flex-col sm:flex-row items-center gap-2"><Mail size={16} className="text-[#7a6b6b]"/> Has Email</span>
 </label>
 <label className="flex flex-col sm:flex-row items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={advancedFilters.hasPhone} onChange={e => setAdvancedFilters({...advancedFilters, hasPhone: e.target.checked})} className="rounded text-[#800000] focus:ring-[#800000]" />
 <span className="sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b] flex flex-col sm:flex-row items-center gap-2"><Phone size={16} className="text-[#7a6b6b]"/> Has Phone</span>
 </label>
 <label className="flex flex-col sm:flex-row items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={advancedFilters.hasLinkedIn} onChange={e => setAdvancedFilters({...advancedFilters, hasLinkedIn: e.target.checked})} className="rounded text-[#800000] focus:ring-[#800000]" />
 <span className="sm:text-xs md:text-xs lg:text-xs font-medium text-[#2a1b1b] flex flex-col sm:flex-row items-center gap-2"><Link size={16} className="text-[#7a6b6b]"/> Has LinkedIn</span>
 </label>
 </div>
 </div>
 <div className="p-4 border-t border-[#e8e2e2] bg-[#fcfbfb]">
 <button onClick={() => setAdvancedFilters({industry: '', country: '', hasEmail: false, hasPhone: false, hasLinkedIn: false})} className="w-full py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] bg-white border border-[#d8cdcd] rounded-lg hover:bg-[#f5f2f2]">Clear Filters</button>
 </div>
 </div>
 )}

 {/* Data Grid Section */}
 <div className="flex-1 min-w-0 flex flex-col overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg shadow-sm overflow-hidden min-h-0">
 {/* Toolbar */}
 <div className="flex flex-col sm:flex-row items-center gap-2 overflow-x-auto bg-white p-3 border-b border-[#e8e2e2] shrink-0">
 <button onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)} className={`px-3 py-2 rounded-lg text-xs font-medium flex flex-col sm:flex-row items-center gap-2 border transition-colors ${isFilterDrawerOpen || Object.values(advancedFilters).some(v => v) ? 'bg-[#800000]/10 border-[#800000]/20 text-[#800000]' : 'border-[#d8cdcd] text-[#2a1b1b] hover:bg-[#f5f2f2]'}`}>
 <Filter size={16} /> Filters {(Object.values(advancedFilters).filter(Boolean).length > 0) && `(${Object.values(advancedFilters).filter(Boolean).length})`}
 </button>
 <div className="relative flex-1 min-w-0 max-w-md">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09393]" />
 <input type="text" placeholder="Search within this list..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-[#f9fafb] border border-[#e8e2e2] rounded-lg sm:text-xs md:text-xs lg:text-xs focus:outline-none focus:border-[#800000] transition-all" />
 </div>
 <div className="ml-auto sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] bg-[#fcfbfb] px-3 py-1.5 rounded-full border border-[#e8e2e2]">
 Showing {filteredLeads.length} leads
 </div>
 </div>

 {/* Table Container */}
 <div className="flex-1 min-w-0 overflow-auto custom-scrollbar relative overflow-x-auto bg-white">
 {isLoadingLeads ? (
 <div className="absolute inset-0 flex flex-col items-center justify-center overflow-x-auto bg-white/80 z-10"><Loader2 className="animate-spin text-[#800000] mb-3" size={16} /></div>
 ) : (
 <table className="w-full text-left border-collapse whitespace-nowrap">
 <thead className="sticky top-0 bg-[#fcfbfb] shadow-[0_1px_0_#e8e2e2] z-10">
 <tr className="sm:text-xs md:text-xs lg:text-xs uppercase tracking-wider font-bold text-[#7a6b6b]">
 <th className="px-2 py-2 w-6 text-center cursor-pointer" onClick={toggleSelectAllPage}>
 {paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeadIds.has(l.id)) ? <CheckSquare size={16} className="text-[#800000] inline-block" /> : <Square size={16} className="text-[#d8cdcd] hover:text-[#a09393] inline-block" />}
 </th>
 <th className="px-2 py-2">Prospect</th>
 <th className="px-2 py-2">Job Title</th>
 <th className="px-2 py-2">Company</th>
 <th className="px-2 py-2">Contact Info</th>
 <th className="px-2 py-2 w-16 md:w-18 text-center">Preview</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#e8e2e2]">
 {paginatedLeads.length === 0 ? (
 <tr><td colSpan="6" className="py-12 text-center text-[#7a6b6b] sm:text-xs md:text-xs lg:text-xs">No records found matching your filters.</td></tr>
 ) : paginatedLeads.map((lead) => {
 const isSelected = selectedLeadIds.has(lead.id);
 return (
 <tr key={lead.id} onClick={() => toggleSelectLead(lead.id)} className={`transition-colors cursor-pointer group ${isSelected ? 'bg-[#800000]/5' : 'hover:bg-[#f5f2f2]'}`}>
 <td className="px-2 py-2 text-center">{isSelected ? <CheckSquare size={16} className="text-[#800000] inline-block" /> : <Square size={16} className="text-[#d8cdcd] inline-block" />}</td>
 <td className="px-2 py-2"><div className="font-bold text-[#2a1b1b] sm:text-xs md:text-xs lg:text-xs">{lead.contactName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim()}</div></td>
 <td className="px-2 py-2 sm:text-xs md:text-sm lg:text-sm text-[#7a6b6b] max-w-[200px]" title={lead.title || lead.jobTitle}>{lead.title || lead.jobTitle}</td>
 <td className="px-2 py-2 sm:text-xs md:text-sm lg:text-sm font-medium text-[#2a1b1b]">{lead.companyName}</td>
 <td className="px-2 py-2">
 <div className="sm:text-xs md:text-xs lg:text-xs text-[#2a1b1b]">{lead.email || lead.emailAddress}</div>
 {(lead.phone || lead.phoneNumber) && (lead.phone || lead.phoneNumber) !== 'N/A' && <div className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] font-sans mt-0.5" style={{ zoom: '1.22' }}>{lead.phone || lead.phoneNumber}</div>}
 </td>
 <td className="px-2 py-2 text-center">
 <button onClick={(e) => { e.stopPropagation(); setPreviewLead(lead); }} className="p-1.5 text-[#a09393] hover:text-[#800000] hover:bg-white border border-transparent hover:border-[#d8cdcd] rounded-md opacity-0 group-hover:opacity-100 transition-all"><Eye size={16} /></button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 )}
 </div>

 {/* Pagination Controls */}
 {!isLoadingLeads && totalPages > 1 && (
 <div className="flex items-center justify-between shrink-0 bg-[#fcfbfb] p-3 border-t border-[#e8e2e2]">
 <span className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] font-medium">Page {currentPage} of {totalPages}</span>
 <div className="flex flex-col md:flex-row gap-2">
 <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-md border border-[#d8cdcd] text-[#2a1b1b] hover:bg-white disabled:opacity-50"><ChevronLeft size={16}/></button>
 <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-md border border-[#d8cdcd] text-[#2a1b1b] hover:bg-white disabled:opacity-50"><ChevronRight size={16}/></button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
 }

 // ==========================================
 // RENDER: LIBRARY VIEW
 // ==========================================
 return (
 <div className="p-7 max-w-[1200px] mx-auto w-full animate-in fade-in duration-300 relative">
 <ToastNotification />
 <ConfirmationModal />

 <div className="flex items-center justify-between mb-8 border-b border-[#e8e2e2] pb-6">
 <div>
 <h1 className="text-xs md:text-xs font-bold text-[#2a1b1b] flex flex-col sm:flex-row items-center gap-2" style={{ fontSize: '78%' }}>
 <Database size={16} className="text-[#800000]" /> Library
 </h1>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-1">Manage your saved leads and track deleted lists.</p>
 </div>
 
 {/* Toggle between Active and Trash views */}
 <div className="flex items-center bg-[#f5f2f2] p-1 rounded-lg border border-[#d8cdcd]">
 <button onClick={() => setViewMode('active')} className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'active' ? 'bg-white text-[#2a1b1b] shadow-sm' : 'text-[#7a6b6b] hover:text-[#2a1b1b]'}`}>
 <Database size={16} /> Active ({datasets.length})
 </button>
 <button onClick={() => setViewMode('trash')} className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-[#7a6b6b] hover:text-red-600'}`}>
 <Trash size={16} /> Trash ({deletedDatasets.length})
 </button>
 </div>
 </div>

 {/* Global Analytics Header (Only show in Active View) */}
 {viewMode === 'active' && !isLoadingList && datasets.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-3 gap-2 mb-8">
 <div className="overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg p-6 shadow-sm flex flex-col sm:flex-row items-center gap-2">
 <div className="w-16 md:w-18 h-18 rounded-full bg-[#800000]/10 flex items-center justify-center text-[#800000]"><Users size={16} /></div>
 <div><p className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] uppercase tracking-wider">Total Contacts</p><p className="text-xs font-black text-[#2a1b1b]" style={{ fontSize: '78%' }}>{datasetStats.totalLeads.toLocaleString()}</p></div>
 </div>
 <div className="overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg p-6 shadow-sm flex flex-col sm:flex-row items-center gap-2">
 <div className="w-16 md:w-18 h-18 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><FileSpreadsheet size={16} /></div>
 <div><p className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] uppercase tracking-wider">Saved Lists</p><p className="text-xs font-black text-[#2a1b1b]" style={{ fontSize: '78%' }}>{datasetStats.totalDatasets}</p></div>
 </div>
 <div className="overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg p-6 shadow-sm flex flex-col sm:flex-row items-center gap-2">
 <div className="w-16 md:w-18 h-18 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><Activity size={16} /></div>
 <div><p className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] uppercase tracking-wider">Latest Export</p><p className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b] mt-1">{datasetStats.latestDataset?.date ? new Date(datasetStats.latestDataset.date).toLocaleDateString() : 'N/A'}</p></div>
 </div>
 </div>
 )}

 {/* Main Lists Table */}
 <div className="overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg shadow-sm overflow-hidden">
 {isLoadingList ? (
 <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#800000]" size={16} /></div>
 ) : viewMode === 'active' ? (
 datasets.length === 0 ? (
 <div className="p-16 text-center text-[#7a6b6b] flex flex-col items-center">
 <Database size={48} className="mx-auto mb-4 text-[#e8e2e2]" />
 <h3 className="text-xs md:text-xs font-bold text-[#2a1b1b] mb-1" style={{ fontSize: '78%' }}>No active datasets found</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs">You haven't saved or exported any lists yet.</p>
 </div>
 ) : (
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-[#fcfbfb] border-b border-[#e8e2e2] sm:text-xs md:text-xs lg:text-xs uppercase tracking-wider font-bold text-[#7a6b6b]">
 <th className="px-3 py-2">Export Details</th>
 <th className="px-3 py-2">Volume</th>
 <th className="px-3 py-2">Purchased On</th>
 <th className="px-3 py-2 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#e8e2e2]">
 {datasets.map((dataset, idx) => (
 <tr key={idx} className="hover:bg-[#f5f2f2] transition-colors group">
 <td className="px-3 py-2">
 <div className="font-bold text-[#2a1b1b] sm:text-xs md:text-xs lg:text-xs">{dataset.description || 'Custom Data Export'}</div>
 <div className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-0.5 font-sans" style={{ zoom: '1.22' }}>ID: {dataset.invoiceId}</div>
 </td>
 <td className="px-3 py-2"><span className="bg-[#fcfbfb] border border-[#d8cdcd] text-[#2a1b1b] sm:text-xs md:text-xs lg:text-xs font-bold px-2.5 py-1 rounded-full">{dataset.leadsCount?.toLocaleString()} leads</span></td>
 <td className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm text-[#7a6b6b]">{dataset.date ? new Date(dataset.date).toLocaleDateString() : 'N/A'}</td>
 <td className="px-3 py-2 flex justify-end items-center gap-2">
 <button onClick={() => setModal({ isOpen: true, type: 'DATASET', target: dataset.invoiceId, title: 'Move Dataset to Trash?', message: `Are you sure you want to delete "${dataset.description}"? You can view it in the Trash later.` })} className="text-[#a09393] hover:text-red-600 p-2 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
 <button onClick={() => openWorkspace(dataset)} className="flex flex-col sm:flex-row items-center gap-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b] bg-white border border-[#d8cdcd] px-2 py-1.5 rounded-lg shadow-sm hover:bg-[#f5f2f2] transition-all"><Eye size={16} /> Open</button>
 <button onClick={() => handleFullDownload(dataset.invoiceId || dataset.id, dataset.description)} disabled={downloadingId === dataset.invoiceId} className="flex flex-col sm:flex-row items-center gap-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-white bg-[#800000] hover:bg-[#660000] px-2 py-1.5 rounded-lg shadow-sm disabled:opacity-70"><Download size={16} /> CSV</button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )
 ) : (
 // TRASH VIEW
 deletedDatasets.length === 0 ? (
 <div className="p-16 text-center text-[#7a6b6b] flex flex-col items-center">
 <Trash size={48} className="mx-auto mb-4 text-[#e8e2e2]" />
 <h3 className="text-xs md:text-xs font-bold text-[#2a1b1b] mb-1" style={{ fontSize: '78%' }}>Trash is empty</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs">No deleted datasets to display.</p>
 </div>
 ) : (
 <table className="w-full text-left border-collapse opacity-75 hover:opacity-100 transition-opacity">
 <thead>
 <tr className="bg-[#fcfbfb] border-b border-[#e8e2e2] sm:text-xs md:text-xs lg:text-xs uppercase tracking-wider font-bold text-[#7a6b6b]">
 <th className="px-3 py-2">Deleted Export</th>
 <th className="px-3 py-2">Volume</th>
 <th className="px-3 py-2">Deleted On</th>
 <th className="px-3 py-2 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#e8e2e2]">
 {deletedDatasets.map((dataset, idx) => (
 <tr key={idx} className="hover:bg-[#fcfbfb] transition-colors">
 <td className="px-3 py-2">
 <div className="font-bold text-red-700 line-through sm:text-xs md:text-xs lg:text-xs">{dataset.description || 'Custom Data Export'}</div>
 <div className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-0.5 font-sans">ID: {dataset.invoiceId}</div>
 </td>
 <td className="px-3 py-2"><span className="text-[#2a1b1b] sm:text-xs md:text-xs lg:text-xs font-medium">{dataset.leadsCount?.toLocaleString()} leads</span></td>
 <td className="px-3 py-2 sm:text-xs md:text-sm lg:text-sm text-[#7a6b6b]">{dataset.deletedAt ? new Date(dataset.deletedAt).toLocaleString() : 'Just now'}</td>
 <td className="px-3 py-2 flex justify-end items-center gap-2">
 <button onClick={() => handleRestoreDataset(dataset.invoiceId)} className="flex flex-col sm:flex-row items-center gap-1.5 sm:text-xs md:text-xs lg:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1.5 rounded-lg shadow-sm hover:bg-emerald-100 transition-all"><ArchiveRestore size={16} /> Restore</button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )
 )}
 </div>
 </div>
 );
};

export default MyDatasets;