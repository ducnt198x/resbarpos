import React, { useState } from 'react';
import { X, DollarSign, CreditCard, ArrowRightLeft, Check, Loader2, Printer } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: 'Cash' | 'Card' | 'Transfer') => void;
  onPrint: () => void; // New prop for printing
  totalAmount: number;
  orderId: string;
  isProcessing: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onPrint,
  totalAmount,
  orderId,
  isProcessing
}) => {
  const { formatPrice } = useCurrency();
  const [method, setMethod] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="font-bold text-white text-xl">Confirm Payment</h3>
          <button onClick={onClose} disabled={isProcessing}>
            <X size={20} className="text-secondary hover:text-white"/>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="text-center relative">
            <p className="text-secondary text-sm mb-1">Total to Pay</p>
            <p className="text-4xl font-bold text-white">{formatPrice(totalAmount)}</p>
            <p className="text-sm text-secondary mt-2">Order {orderId}</p>
            
            {/* Print Bill Button */}
            <button 
              onClick={onPrint}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-surface border border-border rounded-lg text-secondary hover:text-white hover:border-primary transition-colors flex flex-col items-center gap-1"
              title="Print Bill"
            >
                <Printer size={16} />
                <span className="text-[10px] font-bold">Bill</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {['Cash', 'Card', 'Transfer'].map((m) => (
              <button 
                key={m} 
                onClick={() => setMethod(m as any)} 
                disabled={isProcessing}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${method === m ? 'bg-primary text-background border-primary' : 'bg-background border-border text-secondary hover:border-primary/50'}`}
              >
                {m === 'Cash' ? <DollarSign size={24}/> : m === 'Card' ? <CreditCard size={24}/> : <ArrowRightLeft size={24}/>}
                <span className="text-xs font-bold mt-2">{m}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-border">
          <button 
            onClick={() => onConfirm(method)} 
            disabled={isProcessing}
            className="w-full py-4 bg-primary text-background font-bold rounded-xl text-lg hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <Check size={20} />}
            Complete Order
          </button>
        </div>
      </div>
    </div>
  );
};