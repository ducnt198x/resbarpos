import React from 'react';
import { Order } from '../types';
import { useCurrency } from '../CurrencyContext';

interface ReceiptProps {
  data: Order | null;
}

export const Receipt: React.FC<ReceiptProps> = ({ data }) => {
  const { formatPrice } = useCurrency();

  // "Always Mounted" Strategy
  // If no data, we return a hidden empty div.
  if (!data) {
    return <div className="hidden"></div>;
  }

  const calculateItemTotal = (price: number, qty: number) => price * qty;
  const total = data.total || 0;

  return (
    <div className="bg-white text-black p-4 w-[72mm] mx-auto text-[12px] font-mono leading-tight">
      {/* 
         GLOBAL PRINT STYLES 
         This CSS hides the entire React app (body *) and only reveals this specific component 
         when window.print() is called.
      */}
      <style>
        {`
          @media print {
            /* Hide everything in the body by default */
            body * {
              visibility: hidden;
              height: 0;
              overflow: hidden;
            }
            
            /* Explicitly show the receipt container and its children */
            #printable-receipt-area, #printable-receipt-area * {
              visibility: visible;
              height: auto;
              overflow: visible;
            }

            /* Position the receipt at the very top-left of the print paper */
            #printable-receipt-area {
              position: absolute !important;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
              background: white;
              color: black;
              z-index: 9999;
            }

            /* Printer Page Settings */
            @page { 
                size: 80mm auto; 
                margin: 0; 
            }
          }
        `}
      </style>
      
      {/* Header */}
      <div className="text-center mb-4">
        <div className="font-black text-xl mb-1">RESPO POS</div>
        <div className="text-[10px]">123 Culinary Ave, Food City</div>
        <div className="text-[10px]">Hotline: 0909-123-456</div>
      </div>

      <div className="border-b border-black border-dashed my-2"></div>

      {/* Info */}
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
            <span>Time:</span>
            <span>{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="flex justify-between">
            <span>Order #:</span>
            <span className="font-bold">{data.id}</span>
        </div>
        <div className="flex justify-between">
            <span>Table:</span>
            <span className="font-bold">{data.table}</span>
        </div>
        <div className="flex justify-between">
            <span>Staff:</span>
            <span>{data.staff}</span>
        </div>
      </div>

      <div className="border-b border-black border-dashed my-2"></div>

      {/* Items */}
      <div className="mb-2">
        <div className="flex justify-between font-bold mb-1 border-b border-black pb-1">
          <span className="w-[50%]">Item</span>
          <span className="w-[15%] text-center">Qty</span>
          <span className="w-[35%] text-right">Amt</span>
        </div>
        
        {data.items?.map((item, idx) => (
          <div key={idx} className="mb-1">
            <div className="font-bold">{item.name}</div>
            <div className="flex justify-between">
              <span className="text-[10px] italic">@{formatPrice(item.price)}</span>
              <span className="w-[15%] text-center">x{item.quantity}</span>
              <span className="w-[35%] text-right">
                {formatPrice(calculateItemTotal(item.price, item.quantity))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-b border-black border-dashed my-2"></div>

      {/* Totals */}
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatPrice(total)}</span>
        </div>
        <div className="flex justify-between font-black text-base mt-1">
          <span>TOTAL:</span>
          <span>{formatPrice(total)}</span>
        </div>
        <div className="flex justify-between mt-1 italic text-[10px]">
          <span>Method:</span>
          <span>{data.payment_method || 'Pending'}</span>
        </div>
      </div>

      <div className="border-b border-black border-dashed my-2"></div>

      {/* Footer */}
      <div className="text-center text-[10px]">
        <div className="font-bold mb-1">Wifi: RespoGuest / Pass: 12345678</div>
        <div>Thank you & See you again!</div>
      </div>
    </div>
  );
};