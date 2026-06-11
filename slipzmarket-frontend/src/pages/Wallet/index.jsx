import React, { useState } from 'react';
import { 
 Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, 
 QrCode, Copy, ShieldCheck, Activity, CreditCard, 
 Plus, CheckCircle2, AlertCircle, Zap, ExternalLink
} from 'lucide-react';

// --- MOCK WALLET DATA ---
const TRANSACTIONS = [
 { id: '0x8f2a...9b1c', type: 'DEPOSIT', method: 'BTC Network', amount: '+0.850 XMR', usd: '+$136.17', status: 'COMPLETED', date: 'Today, 14:22' },
 { id: '0x3a1c...4f2e', type: 'WITHDRAWAL', method: 'External XMR', amount: '-1.500 XMR', usd: '-$240.30', status: 'PENDING', date: 'Yesterday, 09:12' },
 { id: '0x7e4b...1a9d', type: 'TOP-UP', method: 'Visa •••• 4242', amount: '+5.000 XMR', usd: '+$801.00', status: 'COMPLETED', date: 'Oct 24, 11:05' },
 { id: '0x1c9d...2b4a', type: 'WITHDRAWAL', method: 'External XMR', amount: '-0.250 XMR', usd: '-$40.05', status: 'FAILED', date: 'Oct 21, 16:45' },
];

const LINKED_CARDS = [
 { id: 1, type: 'Visa', last4: '4242', expiry: '12/26', isDefault: true },
 { id: 2, type: 'Mastercard', last4: '8891', expiry: '08/25', isDefault: false },
];

const Wallet = () => {
 const [copied, setCopied] = useState(false);
 const walletAddress = "44AFFq5kSiGBoZ...9xPT6Mptq8";

 const handleCopy = () => {
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 return (
 <div className="animate-fade-in flex flex-col h-full font-sans pb-12 selection:bg-accent selection:text-surface" style={{ zoom: '1.22' }}>
 
 {/* --- HEADER --- */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-8 pt-4">
 <div>
 <div className="flex flex-col sm:flex-row items-center gap-2 mb-2">
 <ShieldCheck size={16} className="text-apollo-blue" />
 <span className="text-xs font-sans text-apollo-blue font-bold tracking-widest uppercase">Vault Secured</span>
 </div>
 <h1 className="text-xs md:text-xs lg:text-xs font-black tracking-tighter text-slate-900" style={{ fontSize: '78%' }}>
 Wallet & Funds
 </h1>
 </div>

 <div className="flex flex-col sm:flex-row items-center gap-2">
 <button className="bg-slate-900 hover:bg-apollo-blue text-white px-3 md:px-6 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-sm hover:shadow-xs flex flex-col sm:flex-row items-center gap-2">
 <ArrowDownRight size={16} /> Withdraw
 </button>
 </div>
 </div>

 {/* --- BENTO BOX GRID --- */}
 <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
 
 {/* 1. MASTER BALANCE CARD (Col Span 1 or 2 depending on screen) */}
 <div className="md:col-span-2 lg:col-span-2 overflow-x-auto bg-white rounded-3xl p-1 relative overflow-hidden group shadow-sm border border-slate-200">
 
 {/* Aesthetic Blur Overlays */}
 <div className="absolute top-0 right-0 w-full md:w-38 h-64 bg-apollo-blue/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
 <div className="absolute bottom-0 left-0 w-29 h-48 bg-emerald-500/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/4 pointer-events-none" />
 
 <div className="relative z-10 h-full flex flex-col justify-between p-6 md:p-7">
 <div className="flex justify-between items-start mb-8">
 <span className="text-xs font-sans font-bold text-slate-600 tracking-widest border border-slate-200 bg-slate-50/80 px-3 py-1 rounded-full backdrop-blur-md flex flex-col sm:flex-row items-center gap-1.5">
 <WalletIcon size={16} className="text-apollo-blue" /> TOTAL LIQUIDITY
 </span>
 <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 flex flex-col sm:flex-row items-center gap-1">
 <Activity size={16} /> Syncing
 </span>
 </div>

 <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-semibold text-slate-500 mb-1">Available Monero</p>
 <div className="flex items-baseline gap-2 mb-2">
 <h2 className="text-xs md:text-xs md:text-xs font-black text-slate-900 tracking-tighter" style={{ fontSize: '78%' }}>2.450</h2>
 <span className="text-xs md:text-xs font-bold text-apollo-blue" style={{ fontSize: '78%' }}>XMR</span>
 </div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-sans font-bold text-slate-400 flex flex-col sm:flex-row items-center gap-2">
 ≈ $392.50 USD <span className="text-xs text-emerald-500 bg-emerald-50 px-1.5 rounded">+2.4% Today</span>
 </p>
 </div>

 {/* Quick Conversion/Top-up Button */}
 <button className="bg-white border border-slate-200 hover:border-apollo-blue text-slate-900 hover:text-apollo-blue px-3 py-2 rounded-lg sm:text-xs md:text-sm lg:text-sm font-bold transition-all shadow-sm hover:shadow-xs flex items-center justify-center gap-2 group/btn">
 <Plus size={16} /> Top Up Balance
 </button>
 </div>
 </div>
 </div>

 {/* 2. RECEIVE / DEPOSIT NODE (Square Bento) */}
 <div className="overflow-x-auto bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
 <div className="w-full flex justify-between items-start mb-4">
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-slate-900 uppercase tracking-widest">Receive XMR</h3>
 <QrCode size={16} className="text-slate-400" />
 </div>
 
 {/* Mock QR Code Frame */}
 <div className="w-32 h-32 overflow-x-auto bg-white border-2 border-slate-100 rounded-lg p-2 mb-4 shadow-sm relative group cursor-pointer">
 <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=44AFFq5kSiGBoZ9xPT6Mptq8&color=0f172a" alt="Wallet QR" className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
 <div className="absolute inset-0 overflow-x-auto bg-white/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm rounded-lg">
 <ExternalLink size={16} className="text-slate-900" />
 </div>
 </div>

 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Your Wallet Address</p>
 
 <button 
 onClick={handleCopy}
 className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 hover:border-apollo-blue rounded-lg p-3 transition-colors"
 >
 <span className="text-xs font-sans font-bold text-slate-700 mr-2">{walletAddress}</span>
 {copied ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <Copy size={16} className="text-slate-400 shrink-0" />}
 </button>
 </div>

 {/* 3. LINKED PAYMENT METHODS */}
 <div className="overflow-x-auto bg-white border border-slate-200 rounded-3xl p-6 flex flex-col shadow-sm">
 <div className="flex justify-between items-center mb-6">
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-slate-900 uppercase tracking-widest">Linked Cards</h3>
 <button className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full transition-colors border border-slate-200">
 <Plus size={16} />
 </button>
 </div>

 <div className="space-y-3 flex-1 min-w-0">
 {LINKED_CARDS.map((card) => (
 <div key={card.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-apollo-blue/30 transition-colors cursor-pointer group">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <div className="w-6 h-6 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center">
 <CreditCard size={16} className="text-slate-700" />
 </div>
 <div>
 <p className="sm:text-xs md:text-xs lg:text-xs font-bold text-slate-900">{card.type} •••• {card.last4}</p>
 <p className="text-xs font-sans font-bold text-slate-500 tracking-widest">EXP {card.expiry}</p>
 </div>
 </div>
 {card.isDefault && (
 <span className="sm:text-xs md:text-xs lg:text-xs font-bold bg-slate-900 text-white px-2 py-1 rounded uppercase tracking-widest">Default</span>
 )}
 </div>
 ))}
 </div>
 
 <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
 <Zap size={16} className="text-amber-500 shrink-0 mt-0.5" />
 <p className="text-xs font-bold text-amber-800 uppercase tracking-widest leading-relaxed">
 Fiat deposits via credit card incur a 2.9% + $0.30 processing fee.
 </p>
 </div>
 </div>

 {/* 4. WALLET ACTIVITY LEDGER (Col Span 2) */}
 <div className="md:col-span-2 lg:col-span-2 overflow-x-auto bg-white border border-slate-200 rounded-3xl p-6 flex flex-col shadow-sm">
 <div className="flex justify-between items-center mb-6">
 <h3 className="sm:text-xs md:text-xs md:text-sm lg:text-sm font-bold text-slate-900 uppercase tracking-widest">Transfer History</h3>
 <button className="text-xs font-bold text-apollo-blue hover:text-slate-900 uppercase tracking-widest transition-colors">
 View All
 </button>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-slate-100">
 <th className="pb-3 text-xs font-sans font-bold text-slate-400 uppercase tracking-widest">Transaction</th>
 <th className="pb-3 text-xs font-sans font-bold text-slate-400 uppercase tracking-widest">Method</th>
 <th className="pb-3 text-xs font-sans font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
 <th className="pb-3 text-xs font-sans font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {TRANSACTIONS.map((txn, i) => (
 <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
 <td className="py-2 pr-4">
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
 txn.type === 'DEPOSIT' || txn.type === 'TOP-UP' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
 }`}>
 {txn.type === 'DEPOSIT' || txn.type === 'TOP-UP' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
 </div>
 <div>
 <p className="text-xs font-bold text-slate-900">{txn.type}</p>
 <p className="text-xs font-sans text-slate-500">{txn.date}</p>
 </div>
 </div>
 </td>
 <td className="py-2 pr-4">
 <span className="text-xs font-semibold text-slate-600">{txn.method}</span>
 <p className="text-xs font-sans text-slate-400 mt-0.5">{txn.id}</p>
 </td>
 <td className="py-2 text-right pr-4">
 <p className={`text-xs font-sans font-bold ${txn.amount.startsWith('+') ? 'text-emerald-600' : 'text-slate-900'}`}>
 {txn.amount}
 </p>
 <p className="text-xs font-sans font-bold text-slate-400">{txn.usd}</p>
 </td>
 <td className="py-2 text-right">
 <span className={`inline-flex flex-col sm:flex-row items-center gap-1 text-xs font-bold px-2 py-1 rounded border uppercase tracking-widest ${
 txn.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
 txn.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
 'bg-red-50 text-red-600 border-red-100'
 }`}>
 {txn.status === 'COMPLETED' && <CheckCircle2 size={16} />}
 {txn.status === 'PENDING' && <Activity size={16} />}
 {txn.status === 'FAILED' && <AlertCircle size={16} />}
 {txn.status}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 </div>
 </div>
 );
};

export default Wallet;