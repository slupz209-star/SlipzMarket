import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../utils/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
 Plus, Minus, ShieldCheck, CreditCard,
 Lock, FileText, X, Mail, Phone, Building2, CheckCircle2, AlertCircle, Download, ArrowRight, Loader2, Wallet, LogIn
} from 'lucide-react';
import { 
 getLocalCart, setLocalCart, removeFromLocalCart, clearLocalCart, hasPendingSync, clearPendingSync, markPendingSync 
} from '../../utils/sessionCart';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test');

// --- STRIPE CHECKOUT COMPONENT ---
const CheckoutFormWrapper = ({ total, cartItems, billingDetails, isProcessing, setIsProcessing, showNotification, getAuthConfig, onSuccess }) => {
 const stripe = useStripe();
 const elements = useElements();

 const isBillingComplete = 
 billingDetails.companyName.trim() !== '' &&
 billingDetails.firstName.trim() !== '' &&
 billingDetails.lastName.trim() !== '' &&
 billingDetails.email.trim() !== '';

 const handleCheckout = async (e) => {
 e.preventDefault();
 if (!stripe || !elements) return;

 setIsProcessing(true);
 try {
 const response = await axios.post(`${API_URL}/checkout/create-payment-intent`, {}, getAuthConfig());
 const payload = response.data.data || response.data;
 const clientSecret = payload.clientSecret;

 if (!clientSecret) throw new Error("Connection failed. Please try again.");

 const result = await stripe.confirmCardPayment(clientSecret, {
 payment_method: {
 card: elements.getElement(CardElement),
 billing_details: {
 name: `${billingDetails.firstName} ${billingDetails.lastName}`,
 email: billingDetails.email,
 }
 }
 });

 if (result.error) {
 showNotification(result.error.message, 'error');
 setIsProcessing(false);
 } else if (result.paymentIntent?.status === 'succeeded') {
 const finalizeRes = await axios.post(`${API_URL}/checkout/finalize`, {
 intentId: result.paymentIntent.id,
 billingDetails: billingDetails
 }, getAuthConfig());

 const invoiceData = finalizeRes.data.data?.invoice || finalizeRes.data.invoice;
 onSuccess({ ...invoiceData, amountPaid: total, email: billingDetails.email });
 } else {
 showNotification('Payment could not be completed. Please try again.', 'error');
 setIsProcessing(false);
 }
 } catch (err) {
 console.error(err);
 if (err.response?.data?.message === 'CART_EMPTY') {
 showNotification("Your cart is empty. Please add items to proceed.", "error");
 } else {
 showNotification("Payment could not be processed right now. Please try again or contact support.", "error");
 }
 setIsProcessing(false);
 }
 };

 return (
 <form onSubmit={handleCheckout} className="space-y-5">
 <div className="flex flex-col gap-2">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b] flex flex-col sm:flex-row items-center gap-2">
 <CreditCard size={16} className="text-[#a09393]" /> Secure Card Entry
 </label>
 <div className="border border-[#d8cdcd] bg-[#fcfbfb] rounded-lg p-4 shadow-sm hover:border-[#b8a9a9] focus-within:overflow-x-auto bg-white focus-within:border-[#800000] focus-within:ring-2 focus-within:ring-[#800000]/20 transition-all duration-200">
 <CardElement
 options={{
 style: {
 base: {
 fontSize: '15px',
 color: '#2a1b1b',
 fontFamily: 'Inter, system-ui, sans-serif',
 letterSpacing: '0.025em',
 '::placeholder': { color: '#a09393', fontStyle: 'italic' },
 iconColor: '#800000',
 },
 invalid: { color: '#dc2626', iconColor: '#dc2626' },
 complete: { color: '#059669', iconColor: '#059669' }
 },
 hidePostalCode: true,
 }}
 />
 </div>
 </div>

 <button
 type="submit"
 disabled={isProcessing || cartItems.length === 0 || !stripe || !isBillingComplete}
 className="w-full bg-[#800000] hover:bg-[#660000] text-white py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all duration-200 flex justify-center items-center gap-2 disabled:opacity-60 disabled:hover:bg-[#800000] shadow-xs hover:shadow-sm disabled:shadow-none"
 >
 {isProcessing ? (
 <span className="flex flex-col sm:flex-row items-center gap-2">
 <Loader2 size={16} className="animate-spin text-white" /> Authorizing...
 </span>
 ) : !isBillingComplete ? (
 <span className="flex flex-col sm:flex-row items-center gap-2 opacity-90 sm:text-xs md:text-xs lg:text-xs">Please fill Billing Details</span>
 ) : (
 <span className="flex flex-col sm:flex-row items-center gap-2">
 <Lock size={16} /> Pay �{total.toFixed(2)} securely
 </span>
 )}
 </button>
 </form>
 );
};

// --- MAIN CART COMPONENT ---
const Cart = () => {
 const [cartItems, setCartItems] = useState([]);
 const [paymentMethod, setPaymentMethod] = useState('balance'); // Set balance or card as default
 const [isProcessing, setIsProcessing] = useState(false);
 const [isLoading, setIsLoading] = useState(true);
 
 // Notification State
 const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
 const [showInvoiceModal, setShowInvoiceModal] = useState(false);
 
 // SUCCESS STATE (Triggers the full-screen success view)
 const [successData, setSuccessData] = useState(null);
 const [isDownloading, setIsDownloading] = useState(false);
 
 const [billingDetails, setBillingDetails] = useState({
 companyName: '', firstName: '', lastName: '', email: ''
 });
 const [workspaceBalance, setWorkspaceBalance] = useState(0); // Added balance state
 const [saveBillingToProfile, setSaveBillingToProfile] = useState(false);
 const [savedBilling, setSavedBilling] = useState(false);
 
 const notificationTimerRef = useRef(null);

 const getAuthConfig = useCallback(() => ({
 headers: { Authorization: `Bearer ${localStorage.getItem('slipz_token')}` }
 }), []);

 const showNotification = (message, type = 'success') => {
 setNotification({ visible: true, message, type });
 if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
 notificationTimerRef.current = window.setTimeout(() => {
 setNotification(prev => ({ ...prev, visible: false }));
 notificationTimerRef.current = null;
 }, 4000);
 };

 useEffect(() => {
 return () => {
 if (notificationTimerRef.current) {
 clearTimeout(notificationTimerRef.current);
 }
 };
 }, []);

 const fetchCartItems = useCallback(async () => {
 setIsLoading(true);
 const token = localStorage.getItem('slipz_token');
 
 try {
 if (token) {
 // If token exists, try fetching from API
 try {
 const res = await axios.get(`${API_URL}/cart`, getAuthConfig());
 setCartItems(res.data.items || res.data.data?.items || []);
 } catch (err) {
 // If API fails (e.g., 401), it means the token is dead
 if (err.response?.status === 401) {
 localStorage.removeItem('slipz_token');
 // Fallback to local cart instead of showing error
 setCartItems(getLocalCart());
 } else {
 throw err;
 }
 }
 } else {
 // If no token, just load local
 setCartItems(getLocalCart());
 }
 } catch (error) {
 console.error('Failed to load cart', error);
 showNotification('Unable to sync cart. Please refresh.', 'error');
 } finally {
 setIsLoading(false);
 }
}, [getAuthConfig]);

 useEffect(() => {
 const loadCart = async () => { await fetchCartItems(); };
 loadCart();

 // Keep cart in-sync when local cart changes elsewhere (other tabs/components)
 const handleCartUpdate = () => { fetchCartItems(); };
 const handleStorageChange = (e) => { if (e.key === 'slipz_local_cart' || !e.key) fetchCartItems(); };
 window.addEventListener('cartUpdated', handleCartUpdate);
 window.addEventListener('storage', handleStorageChange);

 return () => {
 window.removeEventListener('cartUpdated', handleCartUpdate);
 window.removeEventListener('storage', handleStorageChange);
 };
 }, [fetchCartItems]);

 // Sync local cart to backend after login
 useEffect(() => {
 const syncLocalCart = async () => {
 // Only attempt auto-sync when user is authenticated and a pending sync is flagged
 const token = localStorage.getItem('slipz_token');
 if (!token || !hasPendingSync()) return;

 try {
 const localCartItems = getLocalCart();
 if (Array.isArray(localCartItems) && localCartItems.length > 0) {
 // Sync each item to backend cart using packageId
 await Promise.all(
 localCartItems.map(item =>
 axios.post(
 `${API_URL}/cart/add`,
 { 
 packageId: item?.package?.id || item?.packageId || item?.id,
 quantity: item?.quantity || 1
 },
 getAuthConfig()
).catch(err => console.error('Sync error for', item?.id, err))
 )
 );
 // Clear local cart and sync flag
 clearLocalCart();
 clearPendingSync();
 showNotification('? Your saved items have been added to cart!', 'success');
 // Reload cart to show synced items
 await fetchCartItems();
 }
 } catch (error) {
 console.error('Failed to sync local cart:', error);
 showNotification('Could not sync saved items. Please try refreshing the page.', 'error');
 }
 };
 syncLocalCart();
 }, [getAuthConfig, fetchCartItems]);

 const manualSyncLocalCart = async () => {
 const token = localStorage.getItem('slipz_token');
 const local = getLocalCart();
 if (!local || local.length === 0) {
 showNotification('No saved local items to merge', 'info');
 return;
 }

 if (!token) {
 markPendingSync();
 showNotification('Please login to complete merge. Redirecting...', 'info');
 setTimeout(() => { window.location.href = '/auth?redirect=/cart'; }, 800);
 return;
 }

 setIsLoading(true);
 try {
 await Promise.all(
 local.map(i => 
 axios.post(
 `${API_URL}/cart/add`, 
 { 
 packageId: i?.package?.id || i?.packageId || i?.id,
 quantity: i?.quantity || 1
 }, 
 getAuthConfig()
 ).catch(err => { 
 console.error('sync item', i?.package?.id || i?.id, err); 
 })
) );
 clearLocalCart();
 clearPendingSync();
 showNotification('? Saved items merged into your cart', 'success');
 await fetchCartItems();
 window.dispatchEvent(new Event('cartUpdated'));
 } catch (err) {
 console.error('Manual sync failed', err);
 showNotification('Could not merge saved items. Try again later.', 'error');
 } finally {
 setIsLoading(false);
 }
 };

 // Fetch billing prefill data & workspace balance from backend on mount
 useEffect(() => {
 const fetchAccountData = async () => {
 try {
 const [billingRes, workspaceRes] = await Promise.all([
 axios.get(`${API_URL}/account/billing-prefill`, getAuthConfig()).catch(() => null),
 axios.get(`${API_URL}/workspace`, getAuthConfig()).catch(() => null)
 ]);

 if (billingRes?.data) {
 const data = billingRes.data?.data || billingRes.data;
 setBillingDetails(prev => ({ ...prev, ...data }));
 }

 if (workspaceRes?.data) {
 const workspaceData = workspaceRes.data?.data || workspaceRes.data;
 setWorkspaceBalance(parseFloat(workspaceData.balance || 0));
 }

 } catch (_err) {
 console.warn('Could not fetch account data', _err?.message || _err);
 }
 };
 fetchAccountData();
 }, [getAuthConfig]);

 const cartCount = useMemo(
 () => cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
 [cartItems]
 );

 const subtotal = useMemo(
 () => cartItems.reduce((acc, item) => {
 const price = Number(item.package?.price || 0);
 const quantity = Math.max(1, Number(item.quantity) || 1);
 return acc + price * quantity;
 }, 0),
 [cartItems]
 );

 const processingFee = 0.0;
 const total = useMemo(() => Math.max(0, subtotal + processingFee), [subtotal]);

 const updateQty = async (id, delta) => {
 const existing = cartItems.find((item) => item.id === id);
 if (!existing) return;
 const currentQty = Math.max(1, Number(existing.quantity) || 1);
 const newQty = Math.max(1, currentQty + delta);
 if (newQty === currentQty) return;

 const token = localStorage.getItem('slipz_token');
 if (!token) {
 // Update local cart
 const local = getLocalCart();
 const updated = local.map(i => i.id === id ? { ...i, quantity: newQty } : i);
 setLocalCart(updated);
 setCartItems(updated.map(i => ({ id: i.id, package: i.package, quantity: i.quantity })));
 window.dispatchEvent(new Event('cartUpdated'));
 showNotification('Cart updated');
 return;
 }

 try {
 await axios.patch(`${API_URL}/cart/${id}`, { quantity: newQty }, getAuthConfig());
 setCartItems((items) => items.map((item) => item.id === id ? { ...item, quantity: newQty } : item));
 showNotification('Cart updated');
 } catch (error) {
 console.error(error);
 showNotification('Could not update quantity. Please try again.', 'error');
 }
 };

 const removeItem = async (id) => {
 const token = localStorage.getItem('slipz_token');
 if (!token) {
 const updated = removeFromLocalCart(id);
 setCartItems(updated.map(i => ({ id: i.id, package: i.package, quantity: i.quantity })));
 window.dispatchEvent(new Event('cartUpdated'));
 showNotification('Item removed');
 return;
 }

 try {
 await axios.delete(`${API_URL}/cart/${id}`, getAuthConfig());
 setCartItems((items) => items.filter((item) => item.id !== id));
 showNotification('Item removed');
 } catch (error) {
 console.error(error);
 showNotification('Failed to remove item.', 'error');
 }
 };

 const clearCart = async () => {
 const token = localStorage.getItem('slipz_token');
 if (!token) {
 clearLocalCart();
 setCartItems([]);
 window.dispatchEvent(new Event('cartUpdated'));
 showNotification('Cart cleared successfully');
 return;
 }

 try {
 await axios.delete(`${API_URL}/cart`, getAuthConfig());
 setCartItems([]);
 showNotification('Cart cleared successfully');
 } catch (error) {
 console.error(error);
 showNotification('Unable to clear cart.', 'error');
 }
 };

 const handleInputChange = (e) => {
 setBillingDetails({ ...billingDetails, [e.target.name]: e.target.value });
 };

 const saveBillingProfile = async () => {
 try {
 await axios.post(`${API_URL}/account/billing-profile`, billingDetails, getAuthConfig());
 setSavedBilling(true);
 setTimeout(() => setSavedBilling(false), 2500);
 } catch (err) {
 console.warn('Failed to save billing profile', err?.message || err);
 }
 };

 const handlePaymentSuccess = (invoice) => {
 setIsProcessing(false);
 setShowInvoiceModal(false);
 setCartItems([]);
 setSuccessData(invoice); 
 };

 const confirmInvoiceCheckout = async () => {
 setIsProcessing(true);
 try {
 const res = await axios.post(`${API_URL}/checkout/process-invoice`, { billingDetails }, getAuthConfig());
 const invoiceData = res.data.data?.invoice || res.data.invoice;
 handlePaymentSuccess({ ...invoiceData, amountPaid: total, email: billingDetails.email });
 } catch (err) {
 console.error(err);
 setIsProcessing(false);
 showNotification('Could not create invoice request. Please try again.', 'error');
 }
 };

 // --- NEW: Balance Checkout Handler ---
 const handleBalanceCheckout = async () => {
 if (workspaceBalance < total) {
 showNotification("Insufficient balance. Please add funds first.", "error");
 return;
 }
 
 setIsProcessing(true);
 try {
 const res = await axios.post(`${API_URL}/checkout/process-balance`, { billingDetails }, getAuthConfig());
 const invoiceData = res.data.data?.invoice || res.data.invoice;
 handlePaymentSuccess({ ...invoiceData, amountPaid: total, email: billingDetails.email });
 } catch (err) {
 console.error(err);
 showNotification(err.response?.data?.error || "Payment failed. Please try again.", "error");
 setIsProcessing(false);
 }
 };

 const handleDownloadReceipt = async () => {
 if (!successData?.id) return;
 setIsDownloading(true);
 try {
 const response = await axios.get(`${API_URL}/admin/invoices/download/${successData.id}`, {
 ...getAuthConfig(),
 responseType: 'blob', 
 });
 
 const url = window.URL.createObjectURL(new Blob([response.data]));
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `Receipt-${successData.id}.pdf`);
 document.body.appendChild(link);
 link.click();
 link.parentNode.removeChild(link);
 } catch {
 showNotification('Failed to download receipt.', 'error');
 } finally {
 setIsDownloading(false);
 }
 };

 const isBillingComplete = 
 billingDetails.companyName.trim() !== '' &&
 billingDetails.firstName.trim() !== '' &&
 billingDetails.lastName.trim() !== '' &&
 billingDetails.email.trim() !== '';


 // --- 1. FULL SCREEN SUCCESS VIEW (Triggers when payment is done) ---
 if (successData) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-[#f9fafb] px-2 animate-in fade-in zoom-in-95 duration-500 pb-20">
 <div className="overflow-x-auto bg-white border border-[#e8e2e2] rounded-lg shadow-xl max-w-lg w-full p-8 text-center relative overflow-hidden">
 <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
 
 <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50/50">
 <CheckCircle2 size={21} />
 </div>
 
 <h2 className="text-xs md:text-xs font-black text-[#2a1b1b] tracking-tight" style={{ fontSize: '78%' }}>Payment Verified</h2>
 <p className="text-[#7a6b6b] sm:text-xs md:text-xs lg:text-xs mt-3 leading-relaxed">
 Your transaction was successful. We've sent a confirmation email to <strong className="text-[#2a1b1b]">{successData.email}</strong>.
 </p>

 <div className="bg-[#fcfbfb] border border-[#e8e2e2] rounded-lg p-6 mt-8 text-left space-y-3 shadow-inner">
 <div className="flex justify-between items-center border-b border-[#e8e2e2] pb-3 sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] font-medium">Reference ID</span>
 <span className="font-sans font-bold text-[#2a1b1b] bg-white px-2 py-1 border border-[#e8e2e2] rounded">{successData.id}</span>
 </div>
 <div className="flex justify-between items-center sm:text-xs md:text-xs lg:text-xs">
 <span className="text-[#7a6b6b] font-medium">Total Paid</span>
 <span className="font-black text-[#800000]">�{successData.amountPaid?.toFixed(2) || '0.00'}</span>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row gap-2 mt-8">
 <button 
 onClick={handleDownloadReceipt}
 disabled={isDownloading}
 className="flex-1 min-w-0 bg-white border-2 border-[#e8e2e2] hover:border-[#800000] text-[#2a1b1b] py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all flex items-center justify-center gap-2"
 >
 {isDownloading ? <Loader2 size={16} className="animate-spin text-[#800000]" /> : <Download size={16} className="text-[#800000]" />}
 Download Receipt
 </button>
 <button 
 onClick={() => window.location.href = '/dashboard'}
 className="flex-1 min-w-0 bg-[#800000] hover:bg-[#660000] text-white py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
 >
 Access Data <ArrowRight size={16} />
 </button>
 </div>
 </div>
 </div>
 );
 }


 // Check if guest has items in cart (should prompt login)
 const token = localStorage.getItem('slipz_token');
 const isGuest = !token;
 const hasLocalItems = getLocalCart().length > 0;
 const shouldPromptLogin = isGuest && hasLocalItems;

 return (
 <div className="flex flex-col h-full min-h-screen bg-surface font-sans pb-12 sm:text-xs md:text-xs lg:text-xs selection:bg-accent selection:text-surface relative" style={{ zoom: '1.22' }}>
{shouldPromptLogin && (
 <div className="bg-gradient-to-r from-accent/10 to-surface-soft border-b border-accent/20 px-2 lg:px-3 md:px-6 py-1.5.5">
 <div className="w-full max-w-full md:max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-start gap-2">
 <ShieldCheck size={16} className="text-accent mt-0.5 shrink-0" />
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold text-primary">Your saved items are ready</p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-muted mt-1">Sign in to complete your purchase and access your data.</p>
 </div>
 </div>
 <button
 onClick={() => window.location.href = '/auth?redirect=/cart'}
 className="shrink-0 bg-accent hover:bg-accent-hover text-surface px-3 py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all shadow-xs flex flex-col sm:flex-row items-center gap-2"
 >
 <LogIn size={16} /> Sign In Now
 </button>
 </div>
 </div>)}

 {/* Friendly Notification System */}
 {notification.visible && (
 <div className="fixed right-6 top-24 z-50 max-w-sm animate-in fade-in slide-in-from-top-6" style={{ transform: 'scale(0.9)' }}>
 <div className={`rounded-lg px-2 py-2 shadow-xl flex items-start gap-2 border ${
 notification.type === 'error' ? 'bg-white border-red-200 text-red-800' : 'bg-emerald-600 border-emerald-700 text-white'
 }`}>
 {notification.type === 'error' ? (
 <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
 ) : (
 <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
 )}
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold">{notification.type === 'error' ? 'Hold on' : 'Success'}</p>
 <p className={`mt-1 text-xs leading-snug ${notification.type === 'error' ? 'text-red-700' : 'text-emerald-50'}`}>
 {notification.message}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Invoice Modal */}
 {showInvoiceModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-2" style={{ transform: 'scale(0.9)' }}>
 <div className="overflow-x-auto bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
 <h3 className="text-xs md:text-xs font-bold text-[#2a1b1b]" style={{ fontSize: '78%' }}>Confirm Invoice Request</h3>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-2">
 Generate a formal invoice for <strong className="text-[#2a1b1b]">�{total.toFixed(2)}</strong>. Datasets will unlock automatically once your Wire Transfer clears.
 </p>
 <div className="mt-6 flex items-center justify-end gap-2">
 <button 
 onClick={() => setShowInvoiceModal(false)}
 disabled={isProcessing}
 className="px-2 py-2 sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] hover:bg-[#f5f2f2] rounded-lg transition-all"
 >
 Cancel
 </button>
 <button 
 onClick={confirmInvoiceCheckout}
 disabled={isProcessing}
 className="px-3 py-2 bg-[#800000] hover:bg-[#660000] text-white sm:text-xs md:text-xs lg:text-xs font-bold rounded-lg transition-all flex flex-col sm:flex-row items-center gap-2"
 >
 {isProcessing ? <Loader2 size={16} className="animate-spin text-white" /> : null}
 {isProcessing ? 'Generating...' : 'Confirm Request'}
 </button>
 </div>
 </div>
 </div>
 )}

{/* Dynamic Compact Header with Technical Grid Accents */}
 <div className="relative overflow-x-auto bg-white border-b border-theme px-2 lg:px-3 md:px-6 py-1.5.5 overflow-hidden">
 {/* Subtle sexy background lines */}
 <div 
 className="absolute inset-0 opacity-[0.03] pointer-events-none" 
 style={{
 backgroundImage: `
 linear-gradient(to right, var(--accent) 1px, transparent 1px),
 linear-gradient(to bottom, var(--accent) 1px, transparent 1px)`,
 backgroundSize: '28px 28px',
 }}
 />
 <div className="relative w-full max-w-full md:max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
 <div>
 <h1 className="text-xs md:text-xs font-bold tracking-tight text-[#2a1b1b] flex flex-col sm:flex-row items-center gap-2" style={{ fontSize: '78%' }}>
 Secure Checkout
 </h1>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-0.5">Review your packages and complete transaction.</p>
 </div>
 <div className="self-start md:self-auto flex flex-col sm:flex-row items-center gap-1.5 text-xs font-bold text-muted uppercase tracking-wider bg-surface-soft border border-theme px-2.5 py-1 rounded-md shadow-sm">
 <Lock size={16} className="text-accent" /> 256-bit Encrypted
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-6 px-2 lg:px-6 mt-8 w-full max-w-full md:max-w-7xl mx-auto items-start">
 <div className="lg:col-span-7 flex flex-col gap-3 md:gap-6">
 
 {/* Cart UI */}
 <div className="bg-surface border border-theme rounded-lg shadow-sm overflow-hidden">
 <div className="px-2 py-2 border-b border-theme bg-surface-soft flex items-center justify-between">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <h2 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">Order Summary{cartCount > 0 ? ` (${cartCount})` : ''}</h2>
 {/* Show merge button when local saved items exist */}
 {getLocalCart().length > 0 && (
 <button onClick={manualSyncLocalCart} disabled={isLoading} className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b] bg-white border border-[#e8e2e2] px-2 py-1 rounded-md hover:shadow-sm transition-all">
 Merge Saved
 </button>
 )}
 </div>
 {cartCount > 0 && (
 <button onClick={clearCart} className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#7a6b6b] hover:text-[#800000] transition-colors">
 Empty Cart
 </button>
 )}
 </div>

 {isLoading ? (
 <div className="p-8 text-center text-[#7a6b6b] sm:text-xs md:text-xs lg:text-xs flex flex-col items-center gap-2">
 <Loader2 className="animate-spin text-[#800000]" size={16} />
 Loading secure cart...
 </div>
 ) : cartCount === 0 && !hasLocalItems ? (
 <div className="p-8 text-center text-[#7a6b6b] sm:text-xs md:text-xs lg:text-xs">
 <p className="mb-3">Your workspace cart is empty.</p>
 <a href="/browse" className="text-[#800000] font-bold hover:underline">Continue shopping ?</a>
 </div>
 ) : (
 <div className="flex flex-col">
 {cartItems.map((item) => {
 const packageData = item.package || {};
 const quantity = Math.max(1, Number(item.quantity) || 1);
 const price = Number(packageData.price || 0);
 const itemTotal = price * quantity;

 return (
 <div key={item.id} className="p-4 border-b border-[#e8e2e2] last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group">
 <div className="flex items-start gap-2 flex-1 min-w-0">
 <div className="mt-1 text-[#800000]">
 {packageData.category === 'Email & Password' ? <Lock size={16} /> : packageData.category === 'Email Leads' ? <Mail size={16} /> : <Phone size={16} />}
 </div>
 <div>
 <h4 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">{packageData.brand}</h4>
 <span className="text-xs text-[#7a6b6b]">{packageData.category || 'Lead Package'}</span>
 </div>
 </div>

 <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 md:gap-6">
 <div className="flex items-center overflow-x-auto bg-white border border-[#d8cdcd] rounded-md shadow-sm">
 <button onClick={() => updateQty(item.id, -1)} disabled={item.quantity <= 1} className="w-8 h-8 flex items-center justify-center text-[#7a6b6b] hover:text-[#2a1b1b] border-r border-[#d8cdcd] disabled:opacity-50"><Minus size={16} /></button>
 <span className="w-6 text-center sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b]">{item.quantity}</span>
 <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-[#7a6b6b] hover:text-[#2a1b1b] border-l border-[#d8cdcd]"><Plus size={16} /></button>
 </div>
 <div className="flex flex-col sm:flex-row items-center gap-2 min-w-20 justify-end">
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold text-primary">�{itemTotal.toFixed(2)}</span>
 <button onClick={() => removeItem(item.id)} className="text-[#a09393] hover:text-[#800000] transition-colors"><X size={16} /></button>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {cartCount > 0 && (
 <div className="bg-[#fcfbfb] p-4 border-t border-[#e8e2e2] flex justify-end">
 <div className="w-full sm:w-56 space-y-2">
 <div className="flex justify-between sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b]"><span>Subtotal</span><span className="font-medium text-[#2a1b1b]">�{subtotal.toFixed(2)}</span></div>
 <div className="flex justify-between sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b]"><span>Processing Fee</span><span className="font-medium text-[#2a1b1b]">�{processingFee.toFixed(2)}</span></div>
 <div className="border-t border-[#d8cdcd] pt-2 mt-2 flex justify-between sm:text-xs md:text-xs lg:text-xs font-black text-[#2a1b1b]"><span>Total</span><span>�{total.toFixed(2)}</span></div>
 {shouldPromptLogin && (
 <p className="text-xs text-[#7a6b6b] italic mt-3 pt-3 border-t border-[#d8cdcd]">Sign in above to proceed with checkout</p>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Billing Form */}
 <div className="overflow-x-auto bg-white border border-[#d8cdcd] rounded-lg shadow-sm overflow-hidden">
 <div className="px-2 py-2 border-b border-[#e8e2e2] bg-[#fcfbfb] flex items-center justify-between">
 <h2 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">Billing Details</h2>
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <label className="sm:text-xs md:text-sm lg:text-sm text-[#7a6b6b] flex flex-col sm:flex-row items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={saveBillingToProfile} onChange={(e) => { setSaveBillingToProfile(e.target.checked); if (e.target.checked) saveBillingProfile(); }} className="w-4 h-4 cursor-pointer" />
 <span className="font-bold sm:text-xs md:text-xs lg:text-xs">Save to profile</span>
 </label>
 {savedBilling && <span className="sm:text-xs md:text-xs lg:text-xs text-emerald-600 font-bold">SAVED</span>}
 </div>
 </div>

 <form className="p-6 grid grid-cols-1 md:grid-cols-2 md:grid-cols-2 gap-3 md:gap-6">
 <div className="flex flex-col gap-1.5 md:col-span-2">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">Company Name</label>
 <div className="relative">
 <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09393]" />
 <input type="text" name="companyName" value={billingDetails.companyName} onChange={(e) => { handleInputChange(e); setSavedBilling(false); }} placeholder="Acme Corp" className="w-full pl-9 pr-4 py-2 border border-[#d8cdcd] rounded-md sm:text-xs md:text-xs lg:text-xs outline-none focus:border-[#800000] focus:ring-1 transition-all" />
 </div>
 </div>
 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">First Name</label>
 <input type="text" name="firstName" value={billingDetails.firstName} onChange={(e) => { handleInputChange(e); setSavedBilling(false); }} placeholder="Alex" className="w-full px-3 py-2 border border-[#d8cdcd] rounded-md sm:text-xs md:text-xs lg:text-xs outline-none focus:border-[#800000] focus:ring-1 transition-all" />
 </div>
 <div className="flex flex-col gap-1.5">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">Last Name</label>
 <input type="text" name="lastName" value={billingDetails.lastName} onChange={(e) => { handleInputChange(e); setSavedBilling(false); }} placeholder="Doe" className="w-full px-3 py-2 border border-[#d8cdcd] rounded-md sm:text-xs md:text-xs lg:text-xs outline-none focus:border-[#800000] focus:ring-1 transition-all" />
 </div>
 <div className="flex flex-col gap-1.5 md:col-span-2">
 <label className="sm:text-xs md:text-sm lg:text-sm font-bold text-[#2a1b1b]">Billing Email</label>
 <input type="email" name="email" value={billingDetails.email} onChange={(e) => { handleInputChange(e); setSavedBilling(false); }} placeholder="billing@acmecorp.com" className="w-full px-3 py-2 border border-[#d8cdcd] rounded-md sm:text-xs md:text-xs lg:text-xs outline-none focus:border-[#800000] focus:ring-1 transition-all" />
 </div>
 </form>
 </div>
 </div>

 <div className="lg:col-span-5 sticky top-7">
<div className="bg-surface border border-theme rounded-lg shadow-xs p-6">
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-primary mb-4">{shouldPromptLogin ? 'Login to Continue' : 'Payment Gateway'}</h3>

 {shouldPromptLogin ? (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
 <div className="bg-surface-soft border-2 border-accent rounded-lg p-6 text-center space-y-4">
 <div className="w-16 md:w-18 h-18 rounded-full flex items-center justify-center mx-auto bg-accent/10">
 <LogIn size={16} className="text-accent" />
 </div>
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold text-[#2a1b1b]">Ready to Checkout?</p>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] mt-2">You have {hasLocalItems} item{hasLocalItems > 1 ? 's' : ''} saved locally. Sign in to complete your purchase and unlock instant access to your data.</p>
 </div>
 <button
 onClick={() => window.location.href = '/auth?redirect=/cart'}
 className="w-full bg-accent hover:bg-accent-hover text-surface py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
 >
 <LogIn size={16} /> Sign In to Your Account
 </button>
 <p className="sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b]">Don't have an account? <a href="/auth?tab=register&redirect=/cart" className="text-[#800000] font-bold hover:underline">Create one now</a></p>
 </div>
 </div>
 ) : (
 <>
 <div className="flex p-1 bg-[#f5f2f2] border border-[#d8cdcd] rounded-lg mb-6">
 <button onClick={() => setPaymentMethod('balance')} className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-xs font-bold rounded-md transition-all ${paymentMethod === 'balance' ? 'bg-surface shadow-sm border border-theme text-primary' : 'text-muted'}`}><Wallet size={16} className={paymentMethod === 'balance' ? 'text-accent' : ''} /> Balance</button>
 <button onClick={() => setPaymentMethod('card')} className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-xs font-bold rounded-md transition-all ${paymentMethod === 'card' ? 'bg-surface shadow-sm border border-theme text-primary' : 'text-muted'}`}><CreditCard size={16} className={paymentMethod === 'card' ? 'text-accent' : ''} /> Card</button>
 <button onClick={() => setPaymentMethod('invoice')} className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-xs font-bold rounded-md transition-all ${paymentMethod === 'invoice' ? 'bg-surface shadow-sm border border-theme text-primary' : 'text-muted'}`}><FileText size={16} className={paymentMethod === 'invoice' ? 'text-accent' : ''} /> Invoice</button>
 </div>

 {paymentMethod === 'balance' && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
 <div className="bg-surface-soft border border-theme rounded-md p-4 sm:text-xs md:text-xs lg:text-xs text-primary">
 <div className="flex justify-between mb-2">
 <span className="text-muted">Workspace Balance:</span> 
 <span className="font-bold">�{workspaceBalance.toFixed(2)}</span>
 </div>
 <div className="flex justify-between mb-3">
 <span className="text-muted">Order Total:</span> 
 <span className="font-bold text-accent">- �{total.toFixed(2)}</span>
 </div>
 <div className="border-t border-theme pt-3 flex justify-between items-center">
 <span className="font-bold">Remaining Balance:</span>
 <span className={`font-black text-xs ${workspaceBalance >= total ? 'text-emerald-600' : 'text-accent'}`}>
 �{(workspaceBalance - total).toFixed(2)}
 </span>
 </div>
 </div>

 {workspaceBalance < total ? (
 <div className="text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 sm:text-xs md:text-xs lg:text-xs font-bold text-center flex items-center justify-center gap-2">
 <AlertCircle size={16} /> Insufficient funds. Please add funds to your workspace.
 </div>
 ) : (
 <button
 type="button"
 onClick={handleBalanceCheckout}
 disabled={isProcessing || cartCount === 0 || !isBillingComplete}
 className="w-full bg-[#800000] hover:bg-[#660000] text-white py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50"
 >
 {!isBillingComplete ? 'Please fill Billing Details' : (
 isProcessing ? <><Loader2 size={16} className="animate-spin"/> Processing...</> : <><Wallet size={16} /> Pay �{total.toFixed(2)} with Balance</>
 )}
 </button>
 )}
 </div>
 )}

 {paymentMethod === 'card' && (
 <div className="animate-in fade-in slide-in-from-bottom-2">
 <Elements stripe={stripePromise}>
 <CheckoutFormWrapper
 total={total}
 cartItems={cartItems}
 billingDetails={billingDetails}
 isProcessing={isProcessing}
 setIsProcessing={setIsProcessing}
 showNotification={showNotification}
 getAuthConfig={getAuthConfig}
 onSuccess={handlePaymentSuccess}
 />
 </Elements>
 </div>
 )}

 {paymentMethod === 'invoice' && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
 <div className="bg-[#fcfbfb] border border-[#e8e2e2] rounded-md p-4 sm:text-xs md:text-xs lg:text-xs text-[#7a6b6b] leading-relaxed">
 An invoice will be sent to your billing email. Data will be unlocked automatically upon receipt of payment via Wire Transfer or ACH.
 </div>
 <button
 type="button"
 onClick={() => setShowInvoiceModal(true)}
 disabled={isProcessing || cartCount === 0 || !isBillingComplete}
 className="w-full bg-accent hover:bg-accent-hover text-surface py-2 rounded-lg sm:text-xs md:text-xs lg:text-xs font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50"
 >
 {!isBillingComplete ? 'Please fill Billing Details' : 'Request Invoice Payment'}
 </button>
 </div>
 )}

 <div className="mt-6 pt-5 border-t border-theme flex items-start gap-2">
 <ShieldCheck size={16} className="text-accent shrink-0 mt-0.5" />
 <p className="sm:text-xs md:text-xs lg:text-xs text-muted leading-relaxed">
 Protected by industry-standard encryption. By completing this purchase, you agree to SlipZMarket's Terms of Service and GDPR/CCPA data regulations.
 </p>
 </div>
 </>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default Cart;

