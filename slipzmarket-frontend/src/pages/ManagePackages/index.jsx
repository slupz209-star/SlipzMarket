import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../utils/api';
import { useTranslation } from 'react-i18next';
import { 
 Search, Plus, Edit2, Trash2, X, Save, 
 CheckCircle2, Database, Download, Mail, Phone, 
 Layers, Lock, Upload, Loader2, FileUp, AlertCircle
} from 'lucide-react';

const ManagePackages = () => {
 const { t } = useTranslation();
 
 // --- STATE ---
 const [packages, setPackages] = useState([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isUploadingLeads, setIsUploadingLeads] = useState(false);
 const [uploadTasks, setUploadTasks] = useState([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [activeCategoryTab, setActiveCategoryTab] = useState('All');
 const [selectedPackages, setSelectedPackages] = useState([]);
 
 // UI & Drawer States
 const [isDrawerOpen, setIsDrawerOpen] = useState(false);
 const [editingPackage, setEditingPackage] = useState(null);
 const [isImportModalOpen, setIsImportModalOpen] = useState(false);
 const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
 const [deleteTarget, setDeleteTarget] = useState(null);
 
 // 👉 NEW: State for uploading datasets to specific packages
 const [isUploadDataModalOpen, setIsUploadDataModalOpen] = useState(false);
 const [uploadTargetPkg, setUploadTargetPkg] = useState(null);

 const [toast, setToast] = useState(null);

 // Form State
 const [formData, setFormData] = useState({
 id: '', brand: '', category: 'Email Leads', leadsCount: '', price: '', deliverability: '99.0%', lastUpdated: new Date().toISOString().slice(0, 10)
 });

 // Helper: Auth Header
 const getAuthConfig = () => ({
 headers: { Authorization: `Bearer ${localStorage.getItem('slipz_token')}` }
 });

 const showToast = useCallback((msg, type = 'success') => {
 setToast({ msg, type });
 setTimeout(() => setToast(null), 3000);
 }, []);

 // --- API HANDLERS ---
 const fetchPackages = useCallback(async () => {
 setIsLoading(true);
 try {
 const res = await axios.get(`${API_URL}/packages`);
 setPackages(res.data.packages || []);
 } catch {
 showToast('Error loading packages', 'error');
 } finally {
 setIsLoading(false);
 }
 }, [showToast]);

 useEffect(() => {
 const loadPackages = async () => {
 await fetchPackages();
 };
 loadPackages();
 }, [fetchPackages]);

 const toggleSelectRow = (id) => {
 setSelectedPackages((prev) =>
 prev.includes(id) ? prev.filter((pkgId) => pkgId !== id) : [...prev, id]
 );
 };

 const handleSelectAll = (e, currentPackages) => {
 if (e.target.checked) {
 setSelectedPackages(currentPackages.map((pkg) => pkg.id));
 } else {
 setSelectedPackages([]);
 }
 };

 const handleBulkDelete = async () => {
 if (selectedPackages.length === 0) {
 showToast('Select packages first.', 'error');
 return;
 }

 if (!window.confirm(`Delete ${selectedPackages.length} selected package(s)?`)) {
 return;
 }

 try {
 await Promise.all(selectedPackages.map((id) => axios.delete(`${API_URL}/packages/${id}`, getAuthConfig())));
 setSelectedPackages([]);
 fetchPackages();
 showToast('Selected packages deleted.');
 } catch {
 showToast('Bulk delete failed.', 'error');
 }
 };

 const openDeleteModal = (id) => {
 setDeleteTarget(id);
 setIsDeleteModalOpen(true);
 };

 const closeDeleteModal = () => {
 setDeleteTarget(null);
 setIsDeleteModalOpen(false);
 };

 const handleConfirmDelete = async () => {
 if (!deleteTarget) return;
 try {
 await axios.delete(`${API_URL}/packages/${deleteTarget}`, getAuthConfig());
 fetchPackages();
 showToast('Package deleted.');
 } catch {
 showToast('Delete failed.', 'error');
 } finally {
 closeDeleteModal();
 }
 };

 // Catalog Import Handlers
 const openImportModal = () => setIsImportModalOpen(true);
 const closeImportModal = () => setIsImportModalOpen(false);

 // 👉 NEW: Dataset Import Handlers
 const openUploadDataModal = (pkg) => {
 setUploadTargetPkg(pkg);
 setUploadTasks([]);
 setIsUploadDataModalOpen(true);
 };
 const closeUploadDataModal = () => {
 setUploadTargetPkg(null);
 setUploadTasks([]);
 setIsUploadDataModalOpen(false);
 };

 const exportCsv = (rows, filename) => {
 const csvContent = [
 ['ID', 'Brand', 'Category', 'Contacts', 'Price', 'Deliverability', 'Last Updated'],
 ...rows.map((row) => [row.id, row.brand, row.category, row.leadsCount, row.price, row.deliverability, row.lastUpdated || ''])
 ]
 .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
 .join('\n');

 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.setAttribute('download', filename);
 link.click();
 URL.revokeObjectURL(link.href);
 };

 const handleBulkExport = () => {
 if (selectedPackages.length === 0) {
 showToast('Select packages to export.', 'error');
 return;
 }
 const rows = packages.filter((pkg) => selectedPackages.includes(pkg.id)).map((pkg) => ({
 id: pkg.id, brand: pkg.brand, category: pkg.category, leadsCount: pkg.leadsCount, price: pkg.price, deliverability: pkg.deliverability, lastUpdated: pkg.lastUpdated || ''
 }));
 exportCsv(rows, 'selected-packages.csv');
 showToast('Selected packages exported.');
 };

 const handleExportFiltered = () => {
 if (filteredPackages.length === 0) {
 showToast('No filtered packages to export.', 'error');
 return;
 }
 const rows = filteredPackages.map((pkg) => ({
 id: pkg.id, brand: pkg.brand, category: pkg.category, leadsCount: pkg.leadsCount, price: pkg.price, deliverability: pkg.deliverability, lastUpdated: pkg.lastUpdated || ''
 }));
 exportCsv(rows, 'filtered-packages.csv');
 showToast('Filtered packages exported.');
 };

 const handleExportAll = () => {
 if (packages.length === 0) {
 showToast('No packages available to export.', 'error');
 return;
 }
 const rows = packages.map((pkg) => ({
 id: pkg.id, brand: pkg.brand, category: pkg.category, leadsCount: pkg.leadsCount, price: pkg.price, deliverability: pkg.deliverability, lastUpdated: pkg.lastUpdated || ''
 }));
 exportCsv(rows, 'all-packages.csv');
 showToast('All packages exported.');
 };

 // Upload Package Catalog Metadata
 const handleFileUpload = async (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 const fd = new FormData();
 fd.append('file', file);

 try {
 await axios.post(`${API_URL}/packages/import`, fd, getAuthConfig());
 showToast('File import complete!');
 fetchPackages();
 } catch {
 showToast('File import failed.', 'error');
 } finally {
 e.target.value = '';
 closeImportModal();
 }
 };

 // 👉 NEW: Upload Raw Leads for a specific package
 const updateUploadTask = (taskId, values) => {
 setUploadTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...values } : task)));
 };

 const handleLeadsFileUpload = async (e) => {
 const files = Array.from(e.target.files || []);
 if (!files.length || !uploadTargetPkg) return;

 const selectedFiles = files.slice(0, 10);
 if (files.length > 10) {
 showToast('Only the first 10 files will be uploaded at once.', 'error');
 }

 const tasks = selectedFiles.map((file, index) => ({
 id: `${uploadTargetPkg.id}-${Date.now()}-${index}`,
 file,
 progress: 0,
 status: 'pending',
 message: null,
 }));

 setUploadTasks(tasks);
 setIsUploadingLeads(true);

 for (const task of tasks) {
 updateUploadTask(task.id, { status: 'uploading', progress: 0 });
 const fd = new FormData();
 fd.append('file', task.file);

 try {
 await axios.post(`${API_URL}/packages/${uploadTargetPkg.id}/upload-leads`, fd, {
 ...getAuthConfig(),
 headers: { 'Content-Type': 'multipart/form-data', ...getAuthConfig().headers },
 onUploadProgress: (progressEvent) => {
 if (!progressEvent.total) return;
 const progress = Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100));
 updateUploadTask(task.id, { progress });
 },
 });

 updateUploadTask(task.id, { status: 'success', progress: 100 });
 } catch (err) {
 const message = err?.response?.data?.message || 'Upload failed.';
 updateUploadTask(task.id, { status: 'error', message, progress: 100 });
 }
 }

 setIsUploadingLeads(false);
 fetchPackages();
 e.target.value = '';
 };

 const handleSavePackage = async (e) => {
 e.preventDefault();
 const payload = {
 ...formData,
 leadsCount: parseInt(formData.leadsCount, 10),
 price: parseFloat(formData.price)
 };

 try {
 if (editingPackage) {
 await axios.put(`${API_URL}/packages/${editingPackage.id}`, payload, getAuthConfig());
 showToast('Package updated successfully.');
 } else {
 await axios.post(`${API_URL}/packages`, payload, getAuthConfig());
 showToast('Package created successfully.');
 }
 fetchPackages();
 closeDrawer();
 } catch {
 showToast('Failed to save package.', 'error');
 }
 };

 // --- UI HANDLERS ---
 const openDrawer = (pkg = null) => {
 if (pkg) {
 setEditingPackage(pkg);
 setFormData({ ...pkg, price: pkg.price.toString(), leadsCount: pkg.leadsCount.toString() });
 } else {
 setEditingPackage(null);
 const randomId = `PKG-${Math.floor(Math.random() * 9000) + 1000}`;
 setFormData({ id: randomId, brand: '', category: 'Email Leads', leadsCount: '', price: '', deliverability: '99.0%', lastUpdated: new Date().toISOString().slice(0, 10) });
 }
 setIsDrawerOpen(true);
 };

 const closeDrawer = () => { setIsDrawerOpen(false); setEditingPackage(null); };

 // --- DERIVED DATA ---
 const filteredPackages = packages.filter((pkg) =>
 (activeCategoryTab === 'All' || pkg.category === activeCategoryTab) &&
 (pkg.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
 pkg.brand.toLowerCase().includes(searchTerm.toLowerCase()))
 );

 const bulkTotalContacts = packages
 .filter((pkg) => selectedPackages.includes(pkg.id))
 .reduce((sum, pkg) => sum + pkg.leadsCount, 0);

 const getCategoryIcon = (category) => {
 if (category === 'Email & Password') return <Lock size={16} className="text-[#8b6f5a]" />;
 if (category.includes('Email')) return <Mail size={16} className="text-[#8b6f5a]" />;
 if (category.includes('Phone')) return <Phone size={16} className="text-[#8b6f5a]" />;
 return <Layers size={16} className="text-[#8b6f5a]" />;
 };

 const categoryCounts = {
 All: packages.length,
 'Email Leads': packages.filter((pkg) => pkg.category === 'Email Leads').length,
 'Phone Leads': packages.filter((pkg) => pkg.category === 'Phone Leads').length,
 'Email & Password': packages.filter((pkg) => pkg.category === 'Email & Password').length,
 'Full Profile': packages.filter((pkg) => pkg.category === 'Full Profile').length,
 };

 const categoryCards = [
 { key: 'All', label: 'All Packages', icon: <Layers size={16} className="text-[#8b6f5a]" />, count: categoryCounts.All },
 { key: 'Email Leads', label: 'Email', icon: <Mail size={16} className="text-[#8b6f5a]" />, count: categoryCounts['Email Leads'] },
 { key: 'Phone Leads', label: 'Phone', icon: <Phone size={16} className="text-[#8b6f5a]" />, count: categoryCounts['Phone Leads'] },
 { key: 'Email & Password', label: 'Email+Pass', icon: <Lock size={16} className="text-[#8b6f5a]" />, count: categoryCounts['Email & Password'] },
 { key: 'Full Profile', label: 'Profile', icon: <Database size={16} className="text-[#8b6f5a]" />, count: categoryCounts['Full Profile'] },
 ];

 return (
 <div className="flex flex-col h-full min-h-screen bg-[#f5efe6] font-sans pb-12 selection:bg-[#8b6f5a] selection:text-white relative" style={{ zoom: '1.22' }}>
 
 {/* --- HEADER --- */}
 <div className="overflow-x-auto bg-white border-b border-[#d6c9b8] px-0 lg:px-0 py-7 sticky top-0 z-30 shadow-sm">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 w-full">
 <div>
 <h1 className="text-xs md:text-xs font-bold break-words text-[#3b2a23] tracking-tight flex flex-col sm:flex-row items-center gap-2" style={{ fontSize: '78%' }}>
 <Database size={21} className="text-[#8b6f5a]" /> {t('managePackagesTitle', 'Manage Packages')}
 </h1>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium mt-0.5">{t('managePackagesSubtitle', 'Control your dataset catalog')}</p>
 </div>
 <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto flex-wrap">
 <button 
 onClick={() => openDrawer()}
 className="flex items-center justify-center gap-2 bg-[#8b6f5a] hover:bg-[#6c5544] text-white px-3 md:px-6 py-1.5 rounded-lg shadow-sm sm:text-xs md:text-xs lg:text-xs font-bold transition-all w-full md:w-auto"
 >
 <Plus size={16} /> {t('addNewPackage', 'Add Package')}
 </button>
 <button
 onClick={openImportModal}
 className="flex items-center justify-center gap-2 bg-white border border-[#d6c9b8] hover:bg-[#faf6f0]  text-[#3b2a23] px-2 py-1.5 rounded-lg shadow-sm sm:text-xs md:text-xs lg:text-xs font-bold transition-all w-full md:w-auto"
 >
 <Upload size={16} /> {t('importFile', 'Import CSV/TXT')}
 </button>
 <button
 onClick={handleExportFiltered}
 className="flex items-center justify-center gap-2 bg-white border border-[#d6c9b8] hover:bg-[#faf6f0]  text-[#3b2a23] px-2 py-1.5 rounded-lg shadow-sm sm:text-xs md:text-xs lg:text-xs font-bold transition-all w-full md:w-auto"
 >
 <Download size={16} /> {t('exportFiltered', 'Export Filtered')}
 </button>
 <button
 onClick={handleExportAll}
 className="flex items-center justify-center gap-2 bg-white border border-[#d6c9b8] hover:bg-[#faf6f0]  text-[#3b2a23] px-2 py-1.5 rounded-lg shadow-sm sm:text-xs md:text-xs lg:text-xs font-bold transition-all w-full md:w-auto"
 >
 <Download size={16} /> {t('exportAll', 'Export All')}
 </button>
 {isLoading && (
 <span className="inline-flex flex-col sm:flex-row items-center gap-2 bg-[#faf6f0] border border-[#d6c9b8] text-[#8b6f5a] sm:text-xs md:text-xs lg:text-xs font-bold px-2 py-1.5 rounded-lg shadow-sm">
 <Loader2 size={16} className="animate-spin" /> Loading...
 </span>
 )}
 </div>
 </div>
 </div>

 {/* --- MAIN CONTENT --- */}
 <div className="px-0 mt-6 w-full flex flex-col gap-3 md:gap-6">

 {/* Filters & Search */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
 <div className="relative flex-1 min-w-0 sm:w-72">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b6f5a] opacity-70" />
 <input 
 type="text" 
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search by ID or brand name..." 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg pl-9 pr-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-medium  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a] shadow-sm"
 />
 </div>
 </div>
 <div className="grid gap-2 sm:md:grid-cols-2 grid-cols-1 xl:grid-cols-5 mt-4">
 {categoryCards.map((card) => (
 <button
 key={card.key}
 type="button"
 onClick={() => setActiveCategoryTab(card.key)}
 className={`group rounded-3xl border p-4 text-left transition-all shadow-sm ${activeCategoryTab === card.key ? 'border-[#8b6f5a] bg-[#f3efe6]' : 'border-[#e3dccf] bg-white hover:border-[#8b6f5a] hover:bg-[#faf6f0]'}`}
 >
 <div className="flex items-center justify-between gap-2">
 <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#e9e2d9] text-[#8b6f5a]">{card.icon}</span>
 <span className={`text-xs font-bold tracking-[0.12em] uppercase ${activeCategoryTab === card.key ? 'break-words text-[#3b2a23]' : 'text-[#8b6f5a]'}`}>{card.key === 'All' ? 'All' : card.label}</span>
 </div>
 <p className="mt-4 sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{card.count}</p>
 <p className="mt-1 sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a]">{card.key === 'All' ? 'Total packages' : `${card.label} packages`}</p>
 </button>
 ))}
 </div>
 </div>

 {/* Bulk Action Bar */}
 <div className={`bg-white border border-[#8b6f5a] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm shadow-[#3b2a23]/5 transition-all duration-300 ${selectedPackages.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 hidden'}`}>
 <div className="flex flex-col sm:flex-row items-center gap-2 mb-3 sm:mb-0 px-2">
 <span className="bg-[#faf6f0] border border-[#d6c9b8] text-[#8b6f5a] sm:text-xs md:text-xs lg:text-xs font-bold px-3 py-1 rounded-full">
 {selectedPackages.length} Selected
 </span>
 <span className="sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23] font-medium">Total Contacts: <span className="font-bold ml-1">{bulkTotalContacts.toLocaleString()}</span></span>
 </div>
 <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
 <button onClick={handleBulkDelete} className="flex-1 min-w-0 sm:flex-none sm:text-xs md:text-xs lg:text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-2 border border-red-200 rounded-lg bg-white shadow-sm transition-colors flex items-center justify-center gap-1.5">
 <Trash2 size={16} /> Delete
 </button>
 <button onClick={handleBulkExport} className="flex-1 min-w-0 sm:flex-none sm:text-xs md:text-xs lg:text-xs font-bold text-white bg-[#8b6f5a] hover:bg-[#6c5544] px-2 py-2 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5">
 <Download size={16} /> Export CSV
 </button>
 </div>
 </div>

 {/* Main Package Table */}
 <div className="overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-sm overflow-hidden mt-6">
 {filteredPackages.length === 0 ? (
 <div className="p-8 text-center">
 <Database size={16} className="mx-auto text-[#d6c9b8] mb-3" />
 <p className="break-words text-[#3b2a23] font-bold sm:text-xs md:text-xs lg:text-xs">{t('noPackagesFound', 'No packages found')}</p>
 <p className="text-[#8b6f5a] sm:text-xs md:text-xs lg:text-xs mt-1">{t('adjustFilters', 'Try adjusting your search or filters')}</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse min-w-195">
 <thead>
 <tr className="bg-[#faf6f0] border-b border-[#d6c9b8]">
 <th className="w-16 md:w-18 px-3 md:px-6 py-1.5 text-center">
 <input
 type="checkbox"
 checked={selectedPackages.length === filteredPackages.length && filteredPackages.length > 0}
 onChange={(e) => handleSelectAll(e, filteredPackages)}
 className="w-4 h-4 rounded border-[#d6c9b8] text-[#8b6f5a] focus:ring-[#8b6f5a] cursor-pointer"
 />
 </th>
 <th className="px-3 md:px-6 py-1.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">{t('packageDetails', 'Package Details')}</th>
 <th className="px-3 md:px-6 py-1.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">{t('category', 'Category')}</th>
 <th className="px-3 md:px-6 py-1.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">{t('volume', 'Volume')}</th>
 <th className="px-3 md:px-6 py-1.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">{t('deliverability', 'Deliverability')}</th>
 <th className="px-3 md:px-6 py-1.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest text-right">{t('price', 'Price')}</th>
 <th className="px-3 md:px-6 py-1.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest text-right">{t('actions', 'Actions')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#d6c9b8]/50">
 {filteredPackages.map((pkg) => {
 const isSelected = selectedPackages.includes(pkg.id);
 return (
 <tr key={pkg.id} className={`transition-colors group ${isSelected ? 'bg-[#faf6f0]' : 'hover:bg-[#f5efe6]/50'}`}>
 <td className="px-3 md:px-6 py-1.5 text-center">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleSelectRow(pkg.id)}
 className="w-4 h-4 rounded border-[#d6c9b8] text-[#8b6f5a] focus:ring-[#8b6f5a] cursor-pointer"
 />
 </td>
 <td className="px-3 md:px-6 py-1.5">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <div className="w-6 h-6 overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg flex items-center justify-center shrink-0 shadow-sm">
 {getCategoryIcon(pkg.category)}
 </div>
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{pkg.brand}</p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1"><span className="font-sans">{pkg.id}</span></p>
 </div>
 </div>
 </td>
 <td className="px-3 md:px-6 py-1.5 break-words text-[#3b2a23]">{pkg.category}</td>
 <td className="px-3 md:px-6 py-1.5">{pkg.leadsCount.toLocaleString()}</td>
 <td className="px-3 md:px-6 py-1.5">{pkg.deliverability}</td>
 <td className="px-3 md:px-6 py-1.5 text-right font-sans font-bold break-words text-[#3b2a23]">£{pkg.price.toFixed(2)}</td>
 <td className="px-3 md:px-6 py-1.5 text-right">
 <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
 <button onClick={() => openUploadDataModal(pkg)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md border border-transparent hover:border-blue-200">
 <FileUp size={16} />
 </button>
 <button onClick={() => openDrawer(pkg)} className="p-1.5 text-[#8b6f5a] hover:bg-[#faf6f0] rounded-md border border-transparent hover:border-[#d6c9b8]">
 <Edit2 size={16} />
 </button>
 <button onClick={() => openDeleteModal(pkg.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md border border-transparent hover:border-red-200">
 <Trash2 size={16} />
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>

 </div>

 {/* ========================================= */}
 {/* DRAWER: CREATE / EDIT PACKAGE METADATA */}
 {/* ========================================= */}
 {isDrawerOpen && (
 <div className="fixed inset-0 z-60 flex justify-end" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={closeDrawer} />
 
 <div className="relative w-full max-w-full md:max-w-112.5 bg-[#f5efe6] h-full shadow-2xl shadow-[#3b2a23]/20 flex flex-col animate-fade-in-right border-l border-[#d6c9b8]">
 <div className="px-3 py-7 border-b border-[#d6c9b8] overflow-x-auto bg-white flex items-center justify-between shrink-0">
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2">
 <Edit2 size={16} className="text-[#8b6f5a]"/> {editingPackage ? 'Edit Package Metadata' : 'Create Package'}
 </h3>
 <button onClick={closeDrawer} className="p-1.5 text-[#8b6f5a] hover:break-words text-[#3b2a23] hover:bg-[#f5efe6] rounded-lg transition-colors">
 <X size={16} />
 </button>
 </div>
 
 <form id="package-form" onSubmit={handleSavePackage} className="p-6 flex-1 min-w-0 overflow-y-auto flex flex-col gap-3 md:gap-6">
 
 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Package ID</label>
 <input 
 type="text" required 
 value={formData.id} 
 onChange={(e) => setFormData({...formData, id: e.target.value})} 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 disabled={!!editingPackage} 
 />
 </div>

 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Brand / Display Name</label>
 <input 
 type="text" required 
 value={formData.brand} 
 onChange={(e) => setFormData({...formData, brand: e.target.value})} 
 placeholder="e.g., 10,000 SaaS Founders"
 className="w-full bg-white border border-[#d6c9b8] rounded-lg px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-medium  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 />
 </div>

 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Category</label>
 <select 
 value={formData.category} 
 onChange={(e) => setFormData({...formData, category: e.target.value})} 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 >
 <option value="Email Leads">Email Leads</option>
 <option value="Phone Leads">Phone Leads</option>
 <option value="Email & Password">Email & Password</option>
 <option value="Full Profile">Full Profile</option>
 </select>
 </div>

 <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Lead Volume</label>
 <input 
 type="number" required min="1"
 value={formData.leadsCount} 
 onChange={(e) => setFormData({...formData, leadsCount: e.target.value})} 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 />
 </div>
 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Price (£)</label>
 <input 
 type="number" step="0.01" required min="0"
 value={formData.price} 
 onChange={(e) => setFormData({...formData, price: e.target.value})} 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 />
 </div>
 </div>

 <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Deliverability %</label>
 <input 
 type="text" required placeholder="e.g. 98.5%"
 value={formData.deliverability} 
 onChange={(e) => setFormData({...formData, deliverability: e.target.value})} 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 />
 </div>
 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Last Updated</label>
 <input 
 type="date" required 
 value={formData.lastUpdated} 
 onChange={(e) => setFormData({...formData, lastUpdated: e.target.value})} 
 className="w-full bg-white border border-[#d6c9b8] rounded-lg px-3 py-1.5 sm:text-xs md:text-xs lg:text-xs font-sans  text-[#3b2a23] outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]"
 />
 </div>
 </div>

 </form>

 <div className="p-6 border-t border-[#d6c9b8] overflow-x-auto bg-white flex flex-col md:flex-row gap-2 shrink-0">
 <button type="button" onClick={closeDrawer} className="flex-1 min-w-0 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold  text-[#3b2a23] bg-white border border-[#d6c9b8] hover:bg-[#faf6f0] transition-colors rounded-lg shadow-sm">
 Cancel
 </button>
 <button type="submit" form="package-form" className="flex-2 bg-[#8b6f5a] hover:bg-[#6c5544] text-white py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
 <Save size={16} /> {editingPackage ? 'Update Metadata' : 'Create Package'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ========================================= */}
 {/* PACKAGE METADATA IMPORT MODAL */}
 {/* ========================================= */}
 {isImportModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/60 backdrop-blur-sm animate-fade-in" onClick={closeImportModal} />
 <div className="relative w-full max-w-lg rounded-3xl bg-[#f5efe6] border border-[#d6c9b8] shadow-2xl shadow-[#3b2a23]/10 overflow-hidden animate-fade-in-right">
 <div className="flex items-center justify-between px-3 py-7 border-b border-[#d6c9b8] overflow-x-auto bg-white">
 <div>
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23]" style={{ fontSize: '78%' }}>Import Package Catalog</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1">Upload a CSV file to add or update package metadata.</p>
 </div>
 <button onClick={closeImportModal} className="text-[#8b6f5a] hover:break-words text-[#3b2a23] p-2 rounded-full transition-colors">
 <X size={16} />
 </button>
 </div>
 <div className="p-6">
 <div className="space-y-4">
 <div className="rounded-3xl overflow-x-auto bg-white border border-[#d6c9b8] p-6">
 <p className="sm:text-xs md:text-xs lg:text-xs font-semibold break-words text-[#3b2a23]">CSV / TXT Format</p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-2">Required columns: <span className="font-sans">id, brand, category, leadsCount, price, deliverability, lastUpdated</span>.</p>
 </div>

 <label className="block rounded-3xl bg-white border border-dashed border-[#8b6f5a]/40 p-6 text-center cursor-pointer hover:border-[#8b6f5a] transition-colors">
 <Upload size={16} className="mx-auto text-[#8b6f5a]" />
 <p className="mt-3 sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">Select CSV or TXT File</p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1">Only .csv or .txt files are accepted.</p>
 <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
 </label>

 <div className="grid gap-2 sm:md:grid-cols-2 grid-cols-1">
 <button type="button" onClick={closeImportModal} className="py-2 sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23] bg-white border border-[#d6c9b8] rounded-lg hover:bg-[#faf6f0] transition-colors">
 Cancel
 </button>
 <button type="button" onClick={closeImportModal} className="py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-white bg-[#8b6f5a] rounded-lg hover:bg-[#6c5544] transition-colors">
 Done
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ========================================= */}
 {/* 👉 NEW: DATASET (LEADS) UPLOAD MODAL */}
 {/* ========================================= */}
 {isUploadDataModalOpen && uploadTargetPkg && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/60 backdrop-blur-sm animate-fade-in" onClick={closeUploadDataModal} />
 <div className="relative w-full max-w-lg rounded-3xl bg-[#f5efe6] border border-[#d6c9b8] shadow-2xl shadow-[#3b2a23]/10 overflow-hidden animate-fade-in-right">
 <div className="flex items-center justify-between px-3 py-7 border-b border-[#d6c9b8] overflow-x-auto bg-white">
 <div>
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23]" style={{ fontSize: '78%' }}>Upload Dataset Leads</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1">Import actual contact data for <span className="font-bold">{uploadTargetPkg.brand}</span>.</p>
 </div>
 <button onClick={closeUploadDataModal} className="text-[#8b6f5a] hover:break-words text-[#3b2a23] p-2 rounded-full transition-colors disabled:opacity-50" disabled={isUploadingLeads}>
 <X size={16} />
 </button>
 </div>
 <div className="p-6">
 <div className="space-y-4">
 <div className="rounded-3xl overflow-x-auto bg-white border border-[#d6c9b8] p-6">
 <p className="sm:text-xs md:text-xs lg:text-xs font-semibold break-words text-[#3b2a23]">Leads File Format</p>
 {uploadTargetPkg.category === 'Email & Password' ? (
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-2">Accepts <span className="font-sans bg-gray-100 px-1 rounded">.txt</span> files with <span className="font-sans">email:password</span> per line, or <span className="font-sans bg-gray-100 px-1 rounded">.csv</span> with <span className="font-sans">email,password</span>.</p>
 ) : (
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-2">Required columns: <span className="font-sans bg-gray-100 px-1 rounded">firstName, lastName, email, phone, jobTitle, companyName, industry, country</span>.</p>
 )}
 </div>

 <label className={`block rounded-3xl bg-white border border-dashed border-[#8b6f5a]/40 p-6 text-center transition-colors ${isUploadingLeads ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#8b6f5a]'}`}>
 {isUploadingLeads ? (
 <Loader2 size={16} className="mx-auto text-blue-500 animate-spin" />
 ) : (
 <FileUp size={16} className="mx-auto text-blue-500" />
 )}
 <p className="mt-3 sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">
 {isUploadingLeads ? 'Uploading datasets...' : `Upload up to 10 ${uploadTargetPkg.category} Files`}
 </p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1">Select multiple .csv/.txt files and they will import one-by-one automatically.</p>
 <input type="file" accept=".csv,.txt" onChange={handleLeadsFileUpload} disabled={isUploadingLeads} className="hidden" multiple />
 </label>

 {uploadTasks.length > 0 && (
 <div className="rounded-3xl overflow-x-auto bg-white border border-[#d6c9b8] p-4 space-y-4">
 <div className="flex items-center justify-between gap-2">
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-semibold break-words text-[#3b2a23]">Batch Upload Progress</p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1">{uploadTasks.filter((task) => task.status !== 'pending').length}/{uploadTasks.length} files processed</p>
 </div>
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">
 {Math.round(uploadTasks.reduce((sum, task) => sum + task.progress, 0) / uploadTasks.length || 0)}%
 </span>
 </div>
 <div className="h-2 rounded-full bg-[#e3dccf] overflow-hidden">
 <div className="h-full rounded-full bg-[#8b6f5a]" style={{ width: `${Math.round(uploadTasks.reduce((sum, task) => sum + task.progress, 0) / uploadTasks.length || 0)}%` }} />
 </div>

 <div className="space-y-3 max-h-56 overflow-y-auto">
 {uploadTasks.map((task) => (
 <div key={task.id} className="rounded-lg border border-[#e3dccf] p-3 bg-[#faf6f0]">
 <div className="flex items-center justify-between gap-2">
 <p className="sm:text-xs md:text-xs lg:text-xs font-semibold break-words text-[#3b2a23]">{task.file.name}</p>
 <span className={`text-xs font-semibold ${task.status === 'success' ? 'text-emerald-600' : task.status === 'error' ? 'text-red-600' : 'text-[#8b6f5a]'}`}>
 {task.status === 'uploading' ? `${task.progress}%` : task.status === 'success' ? 'Imported' : task.status === 'error' ? 'Failed' : 'Queued'}
 </span>
 </div>
 <div className="h-2 rounded-full bg-[#e3dccf] overflow-hidden mt-2">
 <div className="h-full rounded-full bg-[#8b6f5a]" style={{ width: `${task.progress}%` }} />
 </div>
 {task.message && <p className="mt-2 sm:text-xs md:text-xs lg:text-xs text-red-600">{task.message}</p>}
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="w-full">
 <button type="button" onClick={closeUploadDataModal} disabled={isUploadingLeads} className="w-full py-2 sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23] bg-white border border-[#d6c9b8] rounded-lg hover:bg-[#faf6f0] transition-colors disabled:opacity-50">
 Close
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* DELETE CONFIRM MODAL */}
 {isDeleteModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ transform: 'scale(0.9)' }}>
 <div className="absolute inset-0 bg-[#3b2a23]/60 backdrop-blur-sm animate-fade-in" onClick={closeDeleteModal} />
 <div className="relative w-full max-w-md rounded-3xl bg-[#f5efe6] border border-[#d6c9b8] shadow-2xl shadow-[#3b2a23]/10 overflow-hidden animate-fade-in-right">
 <div className="flex items-center justify-between px-3 py-7 border-b border-[#d6c9b8] overflow-x-auto bg-white">
 <h3 className="text-xs md:text-xs font-bold break-words text-[#3b2a23]" style={{ fontSize: '78%' }}>Confirm Deletion</h3>
 <button onClick={closeDeleteModal} className="text-[#8b6f5a] hover:break-words text-[#3b2a23] p-2 rounded-full transition-colors">
 <X size={16} />
 </button>
 </div>
 <div className="p-6 space-y-4">
 <p className="sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23]">Are you sure you want to delete this package? This action cannot be undone.</p>
 <div className="flex flex-col md:flex-row gap-2">
 <button type="button" onClick={closeDeleteModal} className="flex-1 min-w-0 py-2 sm:text-xs md:text-xs lg:text-xs font-bold  text-[#3b2a23] bg-white border border-[#d6c9b8] rounded-lg hover:bg-[#faf6f0] transition-colors">
 Cancel
 </button>
 <button type="button" onClick={handleConfirmDelete} className="flex-1 min-w-0 py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
 Delete Package
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* TOAST NOTIFICATIONS */}
 {toast && (
 <div className="fixed bottom-8 right-8 z-80 bg-[#3b2a23] text-white px-3 md:px-6 py-1.5 rounded-lg shadow-2xl flex flex-col sm:flex-row items-center gap-2 animate-fade-in-up border border-[#8b6f5a]" style={{ transform: 'scale(0.9)' }}>
 {toast.type === 'error' ? (
 <AlertCircle size={16} className="text-red-400" />
 ) : (
 <CheckCircle2 size={16} className="text-emerald-400" />
 )}
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold">{toast.msg}</p>
 </div>
 )}

 </div>
 );
};

export default ManagePackages;