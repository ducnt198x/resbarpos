import React, { useState, useMemo, useEffect } from 'react';
import { Search, Clock, ChefHat, X, Check, Bell, Ban, Calendar, User, List, Printer } from 'lucide-react';
import { Order } from '../types';
import { useCurrency } from '../CurrencyContext';
import { supabase } from '../supabase';
import { processOrderCompletion } from '../utils';
import { Receipt } from '../components/Receipt';
import { PaymentModal } from '../components/PaymentModal';

type Tab = 'Pending' | 'Completed' | 'Cancelled';

interface OrderWithStaff extends Order {
  staffEmail?: string;
}

export const Orders: React.FC = () => {
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<OrderWithStaff[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // -- Selection State --
  const [selectedOrder, setSelectedOrder] = useState<OrderWithStaff | null>(null);
  
  // -- Printing State --
  // We utilize a simple state to pass data to the hidden receipt component.
  const [printData, setPrintData] = useState<OrderWithStaff | null>(null);

  // -- Payment Modal State --
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderForPayment, setOrderForPayment] = useState<OrderWithStaff | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [now, setNow] = useState(new Date());

  // Tab State
  const [activeTab, setActiveTab] = useState<Tab>('Pending');
  
  // Filters
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffFilter, setStaffFilter] = useState('All Staff');
  const [staffList, setStaffList] = useState<string[]>([]);

  // --- NATIVE PRINT LOGIC ---
  const triggerPrint = (order: OrderWithStaff) => {
      // 1. Set the data for the hidden receipt component
      setPrintData(order);
      
      // 2. Wait for React to re-render the Receipt with new data
      // Then call the browser's native print window.
      // The CSS in Receipt.tsx will handle hiding the app and showing only the receipt.
      setTimeout(() => {
          window.print();
      }, 200);
  };

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, [activeTab, startDate, endDate]); 

  const fetchOrders = async () => {
    let query = supabase
      .from('orders')
      .select(`
        *, 
        order_items(id, quantity, price, menu_items(name)),
        tables(label),
        users(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (activeTab === 'Pending') {
        query = query.in('status', ['Pending', 'Cooking', 'Ready']);
    } else if (activeTab === 'Completed') {
        query = query.eq('status', 'Completed')
                     .gte('created_at', `${startDate}T00:00:00`)
                     .lte('created_at', `${endDate}T23:59:59`);
    } else {
        query = query.eq('status', 'Cancelled')
                     .gte('created_at', `${startDate}T00:00:00`)
                     .lte('created_at', `${endDate}T23:59:59`);
    }

    const { data } = await query;
    if (data) {
        const mapped = data.map((o: any) => {
            let tableDisplay = 'Unknown';
            if (o.table_id === 'Takeaway') {
                tableDisplay = 'Takeaway';
            } else if (o.tables && o.tables.label) {
                tableDisplay = o.tables.label;
            }

            const staffName = o.users?.full_name || o.staff_name || 'Unknown Staff';
            const staffEmail = o.users?.email || '';

            return {
                id: o.id, 
                table: tableDisplay, 
                time: new Date(o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                rawTime: o.created_at, 
                staff: staffName, 
                staffEmail: staffEmail,
                status: o.status, 
                total: o.total_amount, 
                payment_method: o.payment_method,
                items: o.order_items.map((oi: any) => ({
                    id: oi.id, 
                    name: Array.isArray(oi.menu_items) ? oi.menu_items[0]?.name : oi.menu_items?.name || 'Unknown', 
                    price: oi.price, 
                    quantity: oi.quantity
                }))
            };
        });
        setOrders(mapped);
        
        if (activeTab !== 'Pending') {
             const staffs = Array.from(new Set(mapped.map((o:any) => o.staff))) as string[];
             setStaffList(['All Staff', ...staffs]);
        }
    }
  };

  const handleCancelOrder = async (id: string) => {
      if(!window.confirm("Are you sure you want to cancel this order?")) return;
      await supabase.from('orders').update({ status: 'Cancelled' }).eq('id', id);
      fetchOrders(); 
      if (selectedOrder?.id === id) setSelectedOrder(null);
  };

  // --- ACTIONS ---

  const initiatePayment = (order: OrderWithStaff, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setOrderForPayment(order);
      setPrintData(order); // Pre-load print data just in case
      setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async (method: 'Cash' | 'Card' | 'Transfer') => {
      if (!orderForPayment) return;
      setIsProcessingPayment(true);
      try {
          await processOrderCompletion(orderForPayment.id, method);
          
          setIsPaymentModalOpen(false);
          setOrderForPayment(null);
          
          // Refresh list
          await fetchOrders();
          
          // Auto-print receipt after payment
          const updatedOrder = { ...orderForPayment, status: 'Completed', payment_method: method } as OrderWithStaff;
          triggerPrint(updatedOrder);

      } catch (error: any) {
          alert("Payment failed: " + error.message);
      } finally {
          setIsProcessingPayment(false);
      }
  };

  // --- HELPERS ---
  const isDelayed = (o: any) => !['Completed', 'Cancelled'].includes(o.status) && (now.getTime() - new Date(o.rawTime).getTime() > 15 * 60000);
  const getStatusColor = (s: string) => s === 'Pending' ? 'text-yellow-500 border-yellow-500 bg-yellow-500/10' : s === 'Cooking' ? 'text-orange-500 border-orange-500 bg-orange-500/10' : s === 'Ready' ? 'text-blue-500 border-blue-500 bg-blue-500/10' : s === 'Completed' ? 'text-green-500 border-green-500 bg-green-500/10' : 'text-red-500 border-red-500 bg-red-500/10';

  const filtered = useMemo(() => orders.filter(o => 
      (staffFilter === 'All Staff' || o.staff === staffFilter) &&
      (o.id.toLowerCase().includes(searchQuery.toLowerCase()) || o.table.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [orders, searchQuery, staffFilter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative print:hidden">
        
        {/* Payment Modal */}
        {orderForPayment && (
            <PaymentModal 
              isOpen={isPaymentModalOpen}
              onClose={() => setIsPaymentModalOpen(false)}
              onConfirm={handlePaymentConfirm}
              onPrint={() => triggerPrint(orderForPayment)}
              totalAmount={orderForPayment.total}
              orderId={orderForPayment.id}
              isProcessing={isProcessingPayment}
            />
        )}

        <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-background/95 backdrop-blur shrink-0">
            <div><h1 className="text-white text-2xl font-bold">Orders</h1><p className="text-secondary text-sm">Manage & Track</p></div>
            <div className="flex items-center gap-4">
                 <div className="bg-surface p-1 rounded-xl border border-border flex">
                     <button onClick={() => setActiveTab('Pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Pending' ? 'bg-primary text-background shadow-lg' : 'text-secondary hover:text-white'}`}>Pending</button>
                     <button onClick={() => setActiveTab('Completed')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Completed' ? 'bg-primary text-background shadow-lg' : 'text-secondary hover:text-white'}`}>Completed</button>
                     <button onClick={() => setActiveTab('Cancelled')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Cancelled' ? 'bg-primary text-background shadow-lg' : 'text-secondary hover:text-white'}`}>Cancelled</button>
                 </div>
                 
                 <div className="relative"><Search className="absolute left-3 top-2.5 text-secondary" size={18}/><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-surface border border-border text-white pl-10 pr-4 py-2 rounded-lg text-sm w-48 focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="Search ID..."/></div>
            </div>
        </header>

        {activeTab !== 'Pending' && (
            <div className="p-4 border-b border-border bg-surface/50 flex flex-wrap gap-4 items-center min-h-[64px] animate-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border"><Calendar size={16} className="text-secondary"/><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-white text-sm outline-none"/><span className="text-secondary">-</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-sm outline-none"/></div>
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border"><User size={16} className="text-secondary"/><select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="bg-transparent text-white text-sm outline-none appearance-none pr-4 cursor-pointer">{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-secondary opacity-50">
                    <List size={48} />
                    <p className="mt-4 font-bold">No orders found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(order => {
                        const delayed = isDelayed(order);
                        const isTakeaway = order.table === 'Takeaway';
                        return (
                            <div key={order.id} onClick={() => setSelectedOrder(order)} className={`bg-surface border rounded-xl p-5 relative cursor-pointer hover:shadow-xl transition-all overflow-hidden ${delayed ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse' : 'border-border hover:border-primary'}`}>
                                {delayed && <div className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-lg z-10"><Bell size={12}/></div>}
                                
                                {isTakeaway && (
                                    <div className="bg-amber-500/20 text-amber-500 border-b border-amber-500/30 px-2 py-1.5 -mx-5 -mt-5 mb-4 text-center">
                                        <span className="text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                            Take Away Order
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between mb-4">
                                    <div className="flex items-center gap-3"><div className={`p-2 rounded ${getStatusColor(order.status)}`}><ChefHat size={20}/></div><div><h3 className="font-bold text-white">{order.id}</h3><div className="flex items-center gap-1 text-xs text-secondary"><Clock size={12}/> {order.time}</div></div></div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold border h-fit ${getStatusColor(order.status)}`}>{order.status}</span>
                                </div>
                                
                                <div className="border-t border-border/50 py-3 space-y-1">
                                    <div className="flex justify-between text-sm"><span className="text-secondary">Table</span><span className="text-white font-bold">{order.table}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-secondary">Items</span><span className="text-white font-bold">{order.items.reduce((acc, i) => acc + i.quantity, 0)}</span></div>
                                    {order.payment_method && <div className="flex justify-between text-sm"><span className="text-secondary">Payment</span><span className="text-primary font-bold">{order.payment_method}</span></div>}
                                </div>
                                
                                <div className="flex items-center gap-2.5 mt-2 mb-3 bg-background/50 p-2 rounded-lg border border-border/30">
                                    <div className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-secondary shrink-0">
                                        <User size={14} />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-bold text-white truncate">{order.staff}</span>
                                        {order.staffEmail && <span className="text-xs text-secondary truncate">{order.staffEmail}</span>}
                                    </div>
                                </div>
                                
                                {activeTab === 'Pending' && (
                                    <div className="flex gap-2">
                                        <button onClick={(e) => {e.stopPropagation(); handleCancelOrder(order.id)}} className="flex-1 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg font-bold text-sm hover:bg-red-500/20 transition-colors">Cancel</button>
                                        <button onClick={(e) => initiatePayment(order, e)} className="flex-1 py-2 bg-primary text-background rounded-lg font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20">Confirm</button>
                                    </div>
                                )}

                                {activeTab === 'Completed' && (
                                  <div className="flex gap-2 mt-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); triggerPrint(order); }}
                                      className="w-full py-2 bg-background border border-border rounded-lg text-secondary hover:text-white hover:border-primary transition-colors font-bold text-xs flex items-center justify-center gap-2"
                                    >
                                      <Printer size={14} /> Print Bill
                                    </button>
                                  </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* --- ORDER DETAILS MODAL (View Only) --- */}
        {selectedOrder && !isPaymentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[80vh] animate-in scale-95 duration-200">
                    <div className="p-6 border-b border-border flex justify-between"><h2 className="text-xl font-bold text-white">Order {selectedOrder.id}</h2><button onClick={() => setSelectedOrder(null)}><X className="text-secondary hover:text-white"/></button></div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                        <div className="bg-background rounded-lg p-4 border border-border mb-4 flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                 <div className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary">
                                     <User size={20} />
                                 </div>
                                 <div>
                                     <p className="text-sm text-secondary">Created by</p>
                                     <p className="text-white font-bold">{selectedOrder.staff}</p>
                                     {selectedOrder.staffEmail && <p className="text-xs text-secondary">{selectedOrder.staffEmail}</p>}
                                 </div>
                             </div>
                             <div className="text-right">
                                 <p className="text-sm text-secondary">Table</p>
                                 <p className="text-white font-bold text-lg">{selectedOrder.table}</p>
                             </div>
                        </div>

                        {selectedOrder.items.map((item, i) => (
                            <div key={i} className="flex justify-between p-3 bg-background rounded-lg border border-border">
                                <div className="flex gap-3"><span className="bg-border px-2 rounded text-white font-bold text-sm flex items-center">{item.quantity}x</span><span className="text-white font-medium">{item.name}</span></div>
                                <span className="text-white font-bold">{formatPrice(item.price * item.quantity)}</span>
                            </div>
                        ))}
                    </div>
                    {activeTab === 'Pending' ? (
                        <div className="p-6 border-t border-border flex justify-end gap-3">
                             <button onClick={() => handleCancelOrder(selectedOrder.id)} className="px-6 py-3 border border-red-500 text-red-500 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-500/10 transition-colors"><Ban size={16}/> Cancel Order</button>
                             <button onClick={() => initiatePayment(selectedOrder)} className="px-6 py-3 bg-primary text-background rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"><Check size={16}/> Confirm Order</button>
                        </div>
                    ) : (
                       <div className="p-6 border-t border-border flex justify-end gap-3">
                          <button onClick={(e) => { e.stopPropagation(); triggerPrint(selectedOrder); }} className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors shadow-lg"><Printer size={16}/> Print Bill</button>
                       </div>
                    )}
                </div>
            </div>
        )}

        {/* --- ALWAYS MOUNTED RECEIPT (HIDDEN via Fixed Positioning) --- */}
        {/* The ID 'printable-receipt-area' matches the CSS selector in Receipt.tsx to make it visible during print */}
        <div id="printable-receipt-area" style={{ position: 'fixed', top: '-10000px', left: '-10000px' }}>
             <Receipt data={printData} />
        </div>
    </div>
  );
};