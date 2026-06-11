import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../../utils/api';
import { useTranslation } from 'react-i18next';
import {
  Search, ShieldCheck, X, ShoppingCart,
  Mail, Phone, Database, SlidersHorizontal,
  Lock, Check, MoreVertical, Activity,
  Loader2, LogIn
} from 'lucide-react';
import { 
  addToLocalCart, 
  isLoggedIn, markPendingSync 
} from '../../utils/sessionCart';

const BrowseLeads = () => {
  const { t } = useTranslation();
  // --- CORE DATA STATE ---
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- UI STATE ---
  const [activeCategory, setActiveCategory] = useState('All Leads');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [revealPasswords, setRevealPasswords] = useState(false);

  const categories = [
    { value: 'All Leads', label: 'All Datasets', icon: Database },
    { value: 'Email Leads', label: 'Email Contacts', icon: Mail },
    { value: 'Phone Leads', label: 'Phone Contacts', icon: Phone },
    { value: 'Email & Password', label: 'Email & Passwords', icon: Lock },
  ];
  
  // --- MODAL & DRAWER STATES ---
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState('overview');
  const [isAdding, setIsAdding] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [showGuestAddedModal, setShowGuestAddedModal] = useState(false);
  const toastTimerRef = useRef(null);
  
  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, 3000);
  };

  // --- FETCH DATA FROM BACKEND ---
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await axios.get(`${API_URL}/packages`);
        setPackages(res.data.packages);
      } catch (error) {
        console.error("Failed to fetch packages", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPackages();
  }, []);

  const handleAddToCart = async (packageToMap = selectedPackage) => {
    if (!packageToMap) return;
    
    setIsAdding(true);
    try {
      const token = localStorage.getItem('slipz_token');
      const loggedIn = isLoggedIn();

      const pkg = packageToMap;
      const packageId = pkg?.id || pkg?.packageId || pkg?.package?.id;
      if (!packageId) {
        console.error('Cannot add package to cart, missing id', pkg);
        showToast('Unable to add item to cart. Please try again.');
        return;
      }

      const snapshot = {
        id: packageId,
        brand: pkg.brand || pkg.name || '',
        price: Number(pkg.price || 0),
        category: pkg.category || 'Lead Package',
        leadsCount: Number(pkg.leadsCount || 0),
      };
      addToLocalCart({ id: packageId, package: snapshot, quantity: 1 });
      
      window.dispatchEvent(new Event('cartUpdated'));

      if (loggedIn) {
        try {
          await axios.post(`${API_URL}/cart/add`, 
            { packageId }, 
            { headers: { Authorization: `Bearer ${token}` } }
          );
          showToast('✓ Added to cart!');
        } catch (err) {
          if (err.response?.status === 401) {
            showToast('Session expired. Saved to local cart');
          } else {
            showToast('✓ Saved locally (check connection)');
          }
        }
      } else {
        showToast('✓ Added to cart!');
        markPendingSync(); 
        setTimeout(() => setShowGuestAddedModal(true), 500);
      }
      
      setSelectedPackage(null);
    } catch (err) {
      console.error("Cart error:", err);
      showToast('Error adding to cart. Please try again');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleRowSelection = (e, id) => {
    e.stopPropagation();
    setSelectedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  const selectAllPackages = () => {
    const currentFiltered = getFilteredPackages();
    if (selectedRows.length === currentFiltered.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(currentFiltered.map(pkg => pkg.id));
    }
  };

  const getFilteredPackages = () => {
    let filtered = packages;
    if (activeCategory !== 'All Leads') {
      filtered = filtered.filter(pkg => pkg.category === activeCategory);
    }
    if (searchQuery) {
      filtered = filtered.filter(pkg => pkg.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  };

  const getPackageIcon = (category, size = 18) => {
    if (category === 'Email Leads') return <Mail size={size} className="text-blue-600" />;
    if (category === 'Phone Leads') return <Phone size={size} className="text-amber-600" />;
    if (category === 'Email & Password') return <Lock size={size} className="text-violet-600" />;
    return <Database size={size} className="text-[#8b6f5a]" />;
  };

  const filteredPackages = getFilteredPackages();
  const bulkTotal = filteredPackages.filter(p => selectedRows.includes(p.id)).reduce((acc, curr) => acc + curr.price, 0);
  const packageCount = packages.length;
  const selectedCount = selectedRows.length;

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#faf6f0] font-sans selection:bg-[#8b6f5a] selection:text-white pb-16" style={{ zoom: '1.22' }}>
      
      {/* --- ENTERPRISE HEADER --- */}
      <div className="overflow-x-auto bg-white border-b border-[#d6c9b8] px-2 lg:px-3 md:px-6 py-1.5.5 sticky top-0 z-30 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 w-full max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="w-14 h-14 bg-[#faf6f0] border border-[#d6c9b8] rounded-lg flex items-center justify-center shadow-sm">
              <Database size={16} className="text-[#8b6f5a]" />
            </div>
            <div>
              <h1 className="truncate text-xs md:text-xs font-bold break-words text-[#3b2a23] tracking-tight leading-tight" style={{ fontSize: '78%' }}>{t('leadDatabase', 'Dataset Marketplace')}</h1>
              <div className="truncate flex flex-col sm:flex-row items-center gap-2 mt-1 sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] font-medium">
                <span className="truncate flex flex-col sm:flex-row items-center gap-1.5"><ShieldCheck size={16} className="truncate text-emerald-600"/> Verified Network</span>
                <span className="truncate opacity-50">•</span>
                <span>Mixed Packages Supported</span>
              </div>
            </div>
          </div>

          <div className="truncate flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <div className="truncate flex items-center w-full md:w-full md:w-80 bg-[#faf6f0] border border-[#d6c9b8] rounded-lg px-2 py-1.5 shadow-inner focus-within:border-[#8b6f5a] focus-within:ring-1 focus-within:ring-[#8b6f5a] transition-all">
              <Search size={16} className="truncate text-[#8b6f5a] opacity-70" />
              <input 
                type="text" 
                placeholder="Search dataset brands or niches..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="truncate bg-transparent border-none outline-none sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23] w-full px-3 placeholder:text-[#8b6f5a] placeholder:opacity-60"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TOASTS & MODALS */}
      {toastVisible && (
        <div className="truncate fixed right-6 top-24 z-50 max-w-xs animate-in slide-in-from-right-8" style={{ transform: 'scale(0.9)' }}>
          <div className="truncate rounded-lg bg-[#3b2a23] border border-[#8b6f5a] px-2 py-2 shadow-2xl text-[#faf6f0]">
            <p className="truncate sm:text-xs md:text-xs lg:text-xs font-bold">Update</p>
            <p className="truncate mt-0.5 sm:text-xs md:text-xs lg:text-xs leading-snug opacity-90">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Guest Added Modal CTA */}
      {showGuestAddedModal && (
        <div className="truncate fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-2" style={{ transform: 'scale(0.9)' }}>
          <div className="truncate overflow-x-auto bg-white rounded-lg shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95">
            <div className="truncate w-16 md:w-18 h-18 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart size={21} />
            </div>
            <h3 className="truncate text-xs md:text-center text-xs font-black text-[#2a1b1b] tracking-tight" style={{ fontSize: '78%' }}>Item Added to Cart!</h3>
            <p className="truncate text-center sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-3 leading-relaxed">
              Your package is saved locally. Sign in to your account to review your cart and complete checkout with instant data access.
            </p>
            <div className="truncate flex flex-col gap-2 mt-6">
              <button onClick={() => { setShowGuestAddedModal(false); window.location.href = '/cart'; }} className="truncate w-full bg-white border-2 border-[#800000] hover:bg-[#800000]/5 text-[#800000] py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all">
                View Cart
              </button>
              <button onClick={() => { setShowGuestAddedModal(false); window.location.href = '/auth?redirect=/cart'; }} className="truncate w-full bg-[#800000] hover:bg-[#660000] text-white py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2">
                <LogIn size={16} /> Sign In Now
              </button>
            </div>
            <button onClick={() => setShowGuestAddedModal(false)} className="truncate mt-4 w-full sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] hover:text-[#2a1b1b] py-2 transition-colors">
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* --- SIDEBAR & MAIN WORKSPACE LAYOUT --- */}
      <div className="truncate flex flex-col md:flex-row gap-3 md:gap-3 md:gap-6 px-2 lg:px-6 mt-4 md:mt-8 w-full max-w-[1400px] mx-auto items-start">
        
        {/* LEFT SIDEBAR (Tabs) */}
        <aside className="truncate w-full md:w-full md:w-38 shrink-0 bg-white border border-[#d6c9b8] rounded-lg p-4 shadow-sm md:sticky md:top-28">
          <h3 className="truncate sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest mb-4 px-2">Data Categories</h3>
          <nav className="truncate flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => { setActiveCategory(cat.value); setSelectedRows([]); }}
                  className={`flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#3b2a23] text-white shadow-xs'
                      : 'text-[#8b6f5a] hover:bg-[#faf6f0] hover:break-words text-[#3b2a23]'
                  }`}
                >
                  <Icon size={16} className={isSelected ? 'text-white' : 'text-[#8b6f5a] opacity-70'} />
                  {cat.label}
                  {isSelected && (
                    <span className="truncate ml-auto inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-md bg-white/20 text-xs">
                      {filteredPackages.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT MAIN CONTENT */}
        <main className="truncate flex-1 min-w-0 w-full flex flex-col gap-2 min-w-0">
          
          {/* Top Control Bar */}
          <div className="truncate flex flex-col lg:flex-row lg:items-center lg:justify-between overflow-x-auto bg-white rounded-lg p-4 border border-[#d6c9b8] shadow-sm">
            <div className="truncate flex flex-wrap gap-2 sm:text-xs md:text-xs lg:text-xs mb-4 lg:mb-0">
              <span className="truncate inline-flex flex-col sm:flex-row items-center gap-2 px-3 py-2 rounded-lg bg-[#faf6f0] border border-[#d6c9b8] break-words text-[#3b2a23] font-bold">
                📊 {packageCount} total
              </span>
              <span className="truncate inline-flex flex-col sm:flex-row items-center gap-2 px-3 py-2 rounded-lg bg-[#faf6f0] border border-[#d6c9b8] break-words text-[#3b2a23] font-bold">
                🔍 {filteredPackages.length} shown
              </span>
            </div>
            
            <div className="truncate flex flex-col sm:flex-row items-center gap-2 border-t lg:border-t-0 border-[#d6c9b8] pt-4 lg:pt-0">
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="truncate inline-flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg border border-[#d6c9b8] bg-white break-words text-[#3b2a23] sm:text-xs md:text-xs lg:text-xs font-bold hover:bg-[#faf6f0] transition-all"
              >
                <SlidersHorizontal size={16} /> Refine Data
              </button>
              <button
                onClick={selectAllPackages}
                className="truncate inline-flex flex-col sm:flex-row items-center gap-2 px-2 py-2 rounded-lg border border-[#d6c9b8] bg-[#faf6f0] break-words text-[#3b2a23] sm:text-xs md:text-xs lg:text-xs font-bold hover:bg-[#ebe1d3] transition-all"
              >
                <Check size={16} /> Select All
              </button>
            </div>
          </div>

          {/* Bulk Action Bar */}
          <div className={`bg-[#3b2a23] text-white rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-xl transition-all duration-300 ${selectedRows.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 hidden'}`}>
            <div className="truncate flex flex-col sm:flex-row items-center gap-2 mb-3 sm:mb-0">
              <span className="truncate bg-[#8b6f5a] text-white sm:text-xs md:text-xs lg:text-xs font-bold px-3 py-1 rounded-md">
                {selectedRows.length} Selected
              </span>
              <span className="truncate sm:text-xs md:text-xs lg:text-xs font-medium">Bulk Value: <span className="truncate font-bold font-sans ml-1">£{bulkTotal.toFixed(2)}</span></span>
            </div>
            <button 
              onClick={() => handleAddToCart()} 
              className="truncate sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23] bg-[#faf6f0] hover:bg-white px-3 md:px-6 py-1.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart size={16} /> Add Selection to Cart
            </button>
          </div>

          {/* Bento Card Grid */}
          {isLoading ? (
            <div className="truncate w-full py-24 flex flex-col items-center justify-center text-[#8b6f5a]">
              <Loader2 size={21} className="truncate animate-spin mb-4" />
              <span className="truncate sm:text-xs md:text-xs lg:text-xs font-bold">Querying Active Datasets...</span>
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="truncate w-full py-24 text-center overflow-x-auto bg-white border border-[#d6c9b8] rounded-lg shadow-sm">
              <Database size={48} className="truncate mx-auto text-[#d6c9b8] mb-4" />
              <span className="truncate text-xs font-bold text-[#8b6f5a]">No datasets match your criteria.</span>
            </div>
          ) : (
            <div className="truncate grid md:grid-cols-1 grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-2 md:gap-2 md:gap-4">
              {filteredPackages.map((pkg) => {
                const isSelected = selectedRows.includes(pkg.id);
                const isCredentials = pkg.category === 'Email & Password';

                return (
                  <div 
                    key={pkg.id}
                    onClick={() => { setSelectedPackage(pkg); setDetailsTab('overview'); }}
                    className={`relative group bg-white border rounded-lg p-4 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-xs ${
                      isSelected 
                        ? 'border-[#8b6f5a] ring-1 ring-[#8b6f5a]' 
                        : 'border-[#d6c9b8] hover:border-[#8b6f5a]'
                    }`}
                  >
                    {/* Select Checkbox */}
                    <div className="truncate absolute top-6 right-5 z-10" onClick={(e) => toggleRowSelection(e, pkg.id)}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-[#8b6f5a] border-[#8b6f5a]' : 'border-[#d6c9b8] bg-white group-hover:border-[#8b6f5a]'
                      }`}>
                        {isSelected && <Check size={16} className="truncate text-white" />}
                      </div>
                    </div>

                    {/* Card Header */}
                    <div className="truncate flex items-start gap-2 mb-4 pr-8">
                      <div className={`w-14 h-14 rounded-lg flex items-center justify-center border shrink-0 ${
                        isCredentials ? 'bg-violet-50 border-violet-100' : 'bg-[#faf6f0] border-[#d6c9b8]'
                      }`}>
                        {getPackageIcon(pkg.category, 18)}
                      </div>
                      <div>
                        <h3 className="truncate text-xs md:text-xs font-bold break-words text-[#3b2a23] leading-tight mb-1">{pkg.brand}</h3>
                        <span className={`inline-flex items-center text-xs uppercase tracking-widest font-bold px-2 py-0.5 rounded-md ${
                          isCredentials ? 'bg-violet-100 text-violet-700' : 'bg-[#faf6f0] text-[#8b6f5a] border border-[#d6c9b8]'
                        }`}>
                          {pkg.category}
                        </span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid md:grid-cols-2 grid-cols-1 gap-1.5 mb-3">
                      <div className="bg-[#faf6f0] rounded-lg p-2.5">
                        <span className="block text-xs font-bold text-[#8b6f5a] uppercase tracking-wider mb-1">Volume</span>
                        <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{pkg.leadsCount.toLocaleString()} <span className="sm:text-xs md:text-xs lg:text-xs font-normal text-[#8b6f5a]">records</span></span>
                      </div>
                      <div className="bg-[#faf6f0] rounded-lg p-2.5">
                        <span className="block text-xs font-bold text-[#8b6f5a] uppercase tracking-wider mb-1">Health</span>
                        <div className="flex flex-col sm:flex-row items-center gap-1.5">
                          <Activity size={16} className="text-emerald-500" />
                          <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{pkg.deliverability}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer & Action */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#d6c9b8]">
                      <div>
                        <span className="block text-xs text-[#8b6f5a] font-medium">Total Cost</span>
                        <span className="sm:text-xs md:text-xs lg:text-xs font-sans font-bold break-words text-[#3b2a23]">£{pkg.price.toFixed(2)}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(pkg);
                        }}
                        className="bg-[#3b2a23] hover:bg-[#5a4336] text-white p-2.5 rounded-lg transition-colors"
                      >
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ========================================= */}
      {/* DRAWER: ADVANCED FILTERS                    */}
      {/* ========================================= */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ transform: 'scale(0.9)' }}>
          <div className="absolute inset-0 bg-[#3b2a23]/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setIsFilterModalOpen(false)} />
          
          <div className="relative w-full max-w-sm bg-[#f5efe6] h-full shadow-2xl shadow-[#3b2a23]/20 flex flex-col animate-fade-in-right border-l border-[#d6c9b8]">
            <div className="px-3 py-4 border-b border-[#d6c9b8] overflow-x-auto bg-white flex items-center justify-between">
              <h3 className="truncate text-xs md:text-xs font-bold break-words text-[#3b2a23] flex flex-col sm:flex-row items-center gap-2"><SlidersHorizontal size={16} className="truncate text-[#8b6f5a]"/> Advanced Filters</h3>
              <button onClick={() => setIsFilterModalOpen(false)} className="truncate p-2 text-[#8b6f5a] hover:break-words text-[#3b2a23] hover:bg-[#f5efe6] rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="truncate p-4 flex-1 min-w-0 overflow-y-auto flex flex-col gap-2">
              <div className="truncate flex flex-col gap-2">
                <label className="truncate sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Target Industry</label>
                <select className="truncate w-full bg-white border border-[#d6c9b8] rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23] font-medium outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]">
                  <option>All Industries</option>
                  <option>Software & IT Services</option>
                  <option>Healthcare & Pharma</option>
                  <option>Financial Services</option>
                </select>
              </div>

              <div className="truncate flex flex-col gap-2">
                <label className="truncate sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Job Function</label>
                <select className="truncate w-full bg-white border border-[#d6c9b8] rounded-lg px-2 py-2 sm:text-xs md:text-xs lg:text-xs break-words text-[#3b2a23] font-medium outline-none focus:border-[#8b6f5a] focus:ring-1 focus:ring-[#8b6f5a]">
                  <option>Any Function</option>
                  <option>C-Suite & Founders</option>
                  <option>Marketing / Growth</option>
                  <option>Sales / RevOps</option>
                </select>
              </div>
            </div>

            <div className="truncate p-4 border-t border-[#d6c9b8] overflow-x-auto bg-white flex flex-col md:flex-row gap-2">
              <button onClick={() => setIsFilterModalOpen(false)} className="truncate flex-1 min-w-0 py-1.5 sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23] bg-white border border-[#d6c9b8] hover:bg-[#faf6f0] transition-colors rounded-lg shadow-sm">
                Clear All
              </button>
              <button onClick={() => setIsFilterModalOpen(false)} className="truncate flex-1 min-w-0 bg-[#8b6f5a] hover:bg-[#6c5544] text-white py-1.5 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold shadow-sm transition-colors">
                Apply Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* DRAWER: PACKAGE DETAILS                     */}
      {/* ========================================= */}
      {selectedPackage && (
        <div className="truncate fixed inset-0 z-50 flex justify-end" style={{ transform: 'scale(0.9)' }}>
          <div className="truncate absolute inset-0 bg-[#3b2a23]/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setSelectedPackage(null)} />
          
          <div className="truncate relative w-full max-w-full md:w-150 bg-[#f5efe6] h-full shadow-2xl shadow-[#3b2a23]/20 flex flex-col animate-fade-in-right border-l border-[#d6c9b8]">
            
            {/* Drawer Header */}
            <div className="truncate px-3 py-2 border-b border-[#d6c9b8] flex items-start justify-between overflow-x-auto bg-white">
              <div className="truncate flex flex-col sm:flex-row items-center gap-2">
                <div className="truncate w-14 h-14 bg-[#faf6f0] border border-[#d6c9b8] rounded-lg flex items-center justify-center shadow-sm">
                  {getPackageIcon(selectedPackage.category, 20)}
                </div>
                <div>
                  <h2 className="truncate sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23] leading-none mb-1.5">{selectedPackage.brand}</h2>
                  <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] flex flex-col sm:flex-row items-center gap-2 uppercase tracking-wider">
                    {selectedPackage.category} <span className="w-1 h-1 bg-[#d6c9b8] rounded-full" /> Updated {selectedPackage.lastUpdated}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedPackage(null)} className="p-2 text-[#8b6f5a] hover:break-words text-[#3b2a23] hover:bg-[#f5efe6] rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Internal Tabs */}
            <div className="flex border-b border-[#d6c9b8] px-6 overflow-x-auto bg-white gap-3 md:gap-3 md:gap-6">
              <button 
                onClick={() => setDetailsTab('overview')}
                className={`py-2 text-xs font-bold border-b-2 transition-colors ${detailsTab === 'overview' ? 'border-[#8b6f5a] text-[#8b6f5a]' : 'border-transparent text-[#8b6f5a] opacity-70 hover:opacity-100 hover:break-words text-[#3b2a23]'}`}
              >
                Overview
              </button>
              <button 
                onClick={() => setDetailsTab('preview')}
                className={`py-2 text-xs font-bold border-b-2 transition-colors ${detailsTab === 'preview' ? 'border-[#8b6f5a] text-[#8b6f5a]' : 'border-transparent text-[#8b6f5a] opacity-70 hover:opacity-100 hover:break-words text-[#3b2a23]'}`}
              >
                Data Sample
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 p-7 overflow-y-auto overflow-x-auto bg-white">
              
              {detailsTab === 'overview' && (
                selectedPackage.category === 'Email & Password' ? (
                  <div className="animate-fade-in flex flex-col gap-3 md:gap-3 md:gap-6">
                    {/* Credential-focused Quick Stats */}
                    <div className="grid md:grid-cols-2 grid-cols-1 gap-3 md:gap-3 md:gap-6">
                      <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#fff7ff]">
                        <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#7b3d7b] uppercase tracking-widest block mb-1">Total Credentials</span>
                        <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{selectedPackage.leadsCount.toLocaleString()}</span>
                      </div>
                      <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#faf6f0]">
                        <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest block mb-1">Access Types</span>
                        <span className="text-xs font-bold break-words text-[#3b2a23]">Admin · User · Service</span>
                      </div>
                      <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#fff7ff]">
                        <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#7b3d7b] uppercase tracking-widest block mb-1">Format</span>
                        <span className="text-xs font-bold break-words text-[#3b2a23]">Email • Password • Access Type</span>
                      </div>
                      <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#faf6f0]">
                        <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest block mb-1">Cost per Credential</span>
                        <span className="text-xs font-sans font-bold break-words text-[#3b2a23]">£{selectedPackage.unitPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="h-px bg-[#d6c9b8] w-full" />

                    {/* Large masked preview for credentials */}
                    <div className="border border-[#d6c9b8] rounded-lg p-4 overflow-x-auto bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23]">Credential Samples (masked)</h4>
                        <button onClick={() => setRevealPasswords(!revealPasswords)} className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#7b3d7b] bg-[#fff7ff] px-3 py-1 rounded-lg">
                          {revealPasswords ? 'Hide Passwords' : 'Reveal Passwords'}
                        </button>
                      </div>

                      <div className="grid md:grid-cols-3 grid-cols-1 gap-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="p-3 border rounded-lg bg-[#fffaf8] font-sans">
                            <div className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a]">{`u${i}***@example.com`}</div>
                            <div className="sm:text-xs md:text-xs lg:text-xs font-bold mt-2">{revealPasswords ? `password${i}#A` : `p***A${i}#`}</div>
                            <div className="sm:text-xs md:text-xs lg:text-xs mt-1 text-[#8b6f5a]">Acme Corp · Admin</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="animate-fade-in flex flex-col gap-3 md:gap-3 md:gap-6">

                  {/* Quick Stats */}
                  <div className="grid md:grid-cols-2 grid-cols-1 gap-3 md:gap-3 md:gap-6">
                    <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#faf6f0]">
                      <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest block mb-1">Total Contacts</span>
                      <span className="sm:text-xs md:text-xs lg:text-xs font-bold break-words text-[#3b2a23]">{selectedPackage.leadsCount.toLocaleString()}</span>
                    </div>
                    <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#faf6f0]">
                      <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest block mb-1">Deliverability</span>
                      <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-emerald-600">{selectedPackage.deliverability}</span>
                    </div>
                    <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#faf6f0]">
                      <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest block mb-1">Format</span>
                      <span className="text-xs font-bold break-words text-[#3b2a23]">{selectedPackage.type}</span>
                    </div>
                    <div className="border border-[#d6c9b8] p-6 rounded-lg bg-[#faf6f0]">
                      <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest block mb-1">Cost per Record</span>
                      <span className="text-xs font-sans font-bold break-words text-[#3b2a23]">£{selectedPackage.unitPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="h-px bg-[#d6c9b8] w-full" />

                  {/* Trust Signals */}
                  <div className="flex flex-col gap-3 md:gap-3 md:gap-6">
                    <div className="flex flex-col md:flex-row gap-2 items-start p-4 rounded-lg border border-[#d6c9b8] bg-[#faf6f0]">
                      <ShieldCheck size={16} className="text-[#8b6f5a] shrink-0" />
                      <div>
                        <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23]">GDPR & CCPA Compliant</h4>
                        <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1 font-medium">Data is sourced exclusively from opt-in corporate networks and public business filings.</p>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 items-start p-4 rounded-lg border border-[#d6c9b8] bg-[#faf6f0]">
                      <Activity size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23]">SMTP Verified Datasets</h4>
                        <p className="sm:text-xs md:text-xs lg:text-xs text-[#8b6f5a] mt-1 font-medium">All communication records are pinged to ensure active server reception prior to final export.</p>
                      </div>
                    </div>
                  </div>
                </div>
                )
              )}

              {detailsTab === 'preview' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold break-words text-[#3b2a23]">Data Preview (Masked)</h3>
                    <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] bg-[#faf6f0] px-3 py-1 rounded-full border border-[#d6c9b8] flex flex-col sm:flex-row items-center gap-1.5"><Lock size={16}/> Locked Preview</span>
                  </div>

                  <div className="border border-[#d6c9b8] rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-[#faf6f0] border-b border-[#d6c9b8]">
                        <tr>
                          <th className="px-3 md:px-6 py-1.5.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">{selectedPackage.category === 'Email & Password' ? 'Email' : 'Name'}</th>
                          <th className="px-3 md:px-6 py-1.5.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">{selectedPackage.category === 'Email & Password' ? 'Password' : 'Title'}</th>
                          <th className="px-3 md:px-6 py-1.5.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">Company</th>
                          <th className="px-3 md:px-6 py-1.5.5 sm:text-xs md:text-sm lg:text-sm font-bold text-[#8b6f5a] uppercase tracking-widest">{selectedPackage.category === 'Email & Password' ? 'Access Type' : 'Contact'}</th>
                        </tr>
                      </thead>
                      <tbody className="sm:text-xs md:text-xs lg:text-xs font-medium break-words text-[#3b2a23] divide-y divide-[#d6c9b8]/50">
                        {selectedPackage.category === 'Email & Password' ? (
                          <>
                            <tr className="hover:bg-[#f5efe6]/50">
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">s***@acme.com</td>
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">p***A1!#</td>
                              <td className="px-3 md:px-6 py-1.5">Acme Corp</td>
                              <td className="px-3 md:px-6 py-1.5">Console Access</td>
                            </tr>
                            <tr className="hover:bg-[#f5efe6]/50">
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">j***@techflow.io</td>
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">s***Gt9&</td>
                              <td className="px-3 md:px-6 py-1.5">TechFlow</td>
                              <td className="px-3 md:px-6 py-1.5">Admin Login</td>
                            </tr>
                            <tr className="hover:bg-[#f5efe6]/50">
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">e***@globallink.net</td>
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">f***T2@</td>
                              <td className="px-3 md:px-6 py-1.5">GlobalLink</td>
                              <td className="px-3 md:px-6 py-1.5">Service Login</td>
                            </tr>
                          </>
                        ) : (
                          <>
                            <tr className="hover:bg-[#f5efe6]/50">
                              <td className="px-3 md:px-6 py-1.5">Sarah M***</td>
                              <td className="px-3 md:px-6 py-1.5">VP Marketing</td>
                              <td className="px-3 md:px-6 py-1.5">Acme Corp</td>
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">s***@acme.com</td>
                            </tr>
                            <tr className="hover:bg-[#f5efe6]/50">
                              <td className="px-3 md:px-6 py-1.5">James R***</td>
                              <td className="px-3 md:px-6 py-1.5">Director of Sales</td>
                              <td className="px-3 md:px-6 py-1.5">TechFlow</td>
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">j***@techflow.io</td>
                            </tr>
                            <tr className="hover:bg-[#f5efe6]/50">
                              <td className="px-3 md:px-6 py-1.5">Elena T***</td>
                              <td className="px-3 md:px-6 py-1.5">CEO</td>
                              <td className="px-3 md:px-6 py-1.5">GlobalLink</td>
                              <td className="px-3 md:px-6 py-1.5 font-sans text-[#8b6f5a]">e***@globallink.net</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-6 overflow-x-auto bg-white border-t border-[#d6c9b8] flex items-center justify-between shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
              <div>
                <p className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#8b6f5a] uppercase tracking-widest mb-1">Total Value</p>
                <p className="sm:text-xs md:text-xs lg:text-xs font-sans font-bold break-words text-[#3b2a23] tracking-tight">£{selectedPackage.price.toFixed(2)}</p>
              </div>

              <button 
                onClick={() => handleAddToCart()}
                disabled={isAdding}
                className={`px-3 md:px-6 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex flex-col sm:flex-row items-center gap-2 ${
                  isAdding 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-[#8b6f5a] hover:bg-[#6c5544] text-white'
                }`}
              >
                {isAdding ? (
                  <span className="flex flex-col sm:flex-row items-center gap-2"><Check size={16} /> Added to Cart</span>
                ) : (
                  <span className="flex flex-col sm:flex-row items-center gap-2"><ShoppingCart size={16} /> Add to Cart</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default BrowseLeads;