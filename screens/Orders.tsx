import React, { useState, useMemo, useEffect } from 'react';
import { Search, Clock, ChefHat, X, Check, Bell, Ban, Calendar, User, List, Printer } from 'lucide-react';
import { Order } from '../types';
import { useCurrency } from '../CurrencyContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../supabase';
import { processOrderCompletion } from '../utils';
import { PaymentModal } from '../components/PaymentModal';

// IMPORT MỚI: Service in ấn iframe
import { printOrderReceipt } from '../utils/printService';

type Tab = 'Pending' | 'Completed' | 'Cancelled';

interface OrderWithStaff extends Order {
  staffEmail?: string;
}

export const Orders: React.FC = () => {
  const { formatPrice } = useCurrency();
  const { t } = useTheme();
  const [orders, setOrders] = useState<OrderWithStaff[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithStaff | null>(null);

  // -- Payment Modal State --
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderForPayment, setOrderForPayment] = useState<OrderWithStaff | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState<Tab>('Pending');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffFilter, setStaffFilter] = useState('All Staff');
  const [staffList, setStaffList] = useState<string[]>([]);

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
            if (o.table_id === 'Takeaway') tableDisplay = 'Takeaway';
            else if (o.tables && o.tables.label) tableDisplay = o.tables.label;

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
             // FIX: Use Set to deduplicate staff names before adding to state
             const uniqueStaffs = Array.from(new Set(mapped.map((o:any) => o.staff))) as string[];
             // Prepend 'All Staff' here
             setStaffList(['All Staff', ...uniqueStaffs]);
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
      setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async (method: 'Cash' | 'Card' | 'Transfer', shouldPrint: boolean) => {
      if (!orderForPayment) return;
      setIsProcessingPayment(true);
      try {
          await processOrderCompletion(orderForPayment.id, method);
          
          const completedOrder = { 
            ...orderForPayment, 
            status: 'Completed', 
            payment_method: method 
          };

          if (shouldPrint) {
              console.log("Auto-printing bill for:", completedOrder.id);
              printOrderReceipt(completedOrder);
          }
          
          setIsPaymentModalOpen(false);
          setOrderForPayment(null);
          if (selectedOrder?.id === orderForPayment.id) setSelectedOrder(null);
          
          await fetchOrders();

      } catch (error: any) {
          alert("Payment failed: " + error.message);
      } finally {
          setIsProcessingPayment(false);
      }
  };

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
              onPrint={() => printOrderReceipt(orderForPayment)} 
              totalAmount={orderForPayment.total}
              orderId={orderForPayment.id}
              isProcessing={isProcessingPayment}
            />
        )}

        <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-background/95 backdrop-blur shrink-0 transition-colors">
            <div><h1 className="text-text-main text-2xl font-bold">{t('Orders')}</h1><p className="text-secondary text-sm">{t('Manage & Track')}</p></div>
            <div className="flex items-center gap-4">
                 <div className="bg-surface p-1 rounded-xl border border-border flex">
                     <button onClick={() => setActiveTab('Pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Pending' ? 'bg-primary text-background shadow-lg' : 'text-secondary hover:text-text-main'}`}>{t('Pending')}</button>
                     <button onClick={() => setActiveTab('Completed')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Completed' ? 'bg-primary text-background shadow-lg' : 'text-secondary hover:text-text-main'}`}>{t('Completed')}</button>
                     <button onClick={() => setActiveTab('Cancelled')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Cancelled' ? 'bg-primary text-background shadow-lg' : 'text-secondary hover:text-text-main'}`}>{t('Cancelled')}</button>
                 </div>
                 
                 <div className="relative"><Search className="absolute left-3 top-2.5 text-secondary" size={18}/><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-surface border border-border text-text-main pl-10 pr-4 py-2 rounded-lg text-sm w-48 focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder={t('Search ID...')}/></div>
            </div>
        </header>

        {activeTab !== 'Pending' && (
            <div className="p-4 border-b border-border bg-surface/50 flex flex-wrap gap-4 items-center min-h-[64px] animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                    
                    {/* START DATE */}
                    <div className="relative flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border hover:border-primary transition-colors group">
                        <Calendar size={16} className="text-secondary group-hover:text-primary transition-colors pointer-events-none"/>
                        <span className="text-sm font-bold text-text-main pointer-events-none">
                            {startDate.split('-').reverse().join('/')}
                        </span>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                        />
                    </div>

                    <span className="text-secondary font-bold">-</span>

                    {/* END DATE */}
                    <div className="relative flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border hover:border-primary transition-colors group">
                        <Calendar size={16} className="text-secondary group-hover:text-primary transition-colors pointer-events-none"/>
                        <span className="text-sm font-bold text-text-main pointer-events-none">
                            {endDate.split('-').reverse().join('/')}
                        </span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                        />
                    </div>

                    {/* Staff Filter */}
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border ml-2">
                        <User size={16} className="text-secondary"/>
                        <select 
                            value={staffFilter} 
                            onChange={e => setStaffFilter(e.target.value)} 
                            className="bg-surface border border-border text-text-main text-sm rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary cursor-pointer pr-4"
                        >
                            {staffList.map(s => (
                                <option 
                                    key={s} 
                                    value={s} 
                                    style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)' }}
                                >
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-secondary opacity-50">
                    <List size={48} />
                    <p className="mt-4 font-bold">{t('No orders found')}</p>
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
                                            {t('TAKE AWAY ORDER')}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between mb-4">
                                    <div className="flex items-center gap-3"><div className={`p-2 rounded ${getStatusColor(order.status)}`}><ChefHat size={20}/></div><div><h3 className="font-bold text-text-main">{order.id}</h3><div className="flex items-center gap-1 text-xs text-secondary"><Clock size={12}/> {order.time}</div></div></div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold border h-fit ${getStatusColor(order.status)}`}>{t(order.status)}</span>
                                </div>
                                
                                <div className="border-t border-border/50 py-3 space-y-1">
                                    <div className="flex justify-between text-sm"><span className="text-secondary">{t('Table')}</span><span className="text-text-main font-bold">{order.table}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-secondary">{t('Items')}</span><span className="text-text-main font-bold">{order.items.reduce((acc, i) => acc + i.quantity, 0)}</span></div>
                                    {order.payment_method && <div className="flex justify-between text-sm"><span className="text-secondary">{t('Payment')}</span><span className="text-primary font-bold">{t(order.payment_method)}</span></div>}
                                </div>
                                
                                <div className="flex items-center gap-2.5 mt-2 mb-3 bg-background/50 p-2 rounded-lg border border-border/30">
                                    <div className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-secondary shrink-0">
                                        <User size={14} />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-bold text-text-main truncate">{order.staff}</span>
                                        {order.staffEmail && <span className="text-xs text-secondary truncate">{order.staffEmail}</span>}
                                    </div>
                                </div>
                                
                                {activeTab === 'Pending' && (
                                    <div className="flex gap-2">
                                        <button onClick={(e) => {e.stopPropagation(); handleCancelOrder(order.id)}} className="flex-1 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg font-bold text-sm hover:bg-red-500/20 transition-colors">{t('Cancel')}</button>
                                        <button onClick={(e) => initiatePayment(order, e)} className="flex-1 py-2 bg-primary text-background rounded-lg font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20">{t('Confirm')}</button>
                                    </div>
                                )}

                                {activeTab === 'Completed' && (
                                  <div className="flex gap-2 mt-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); printOrderReceipt(order); }}
                                      className="w-full py-2 bg-background border border-border rounded-lg text-secondary hover:text-text-main hover:border-primary transition-colors font-bold text-xs flex items-center justify-center gap-2"
                                    >
                                      <Printer size={14} /> {t('Print Bill')}
                                    </button>
                                  </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* --- ORDER DETAILS MODAL --- */}
        {selectedOrder && !isPaymentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[80vh] animate-in scale-95 duration-200">
                    <div className="p-6 border-b border-border flex justify-between"><h2 className="text-xl font-bold text-text-main">Order {selectedOrder.id}</h2><button onClick={() => setSelectedOrder(null)}><X className="text-secondary hover:text-text-main"/></button></div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                        <div className="bg-background rounded-lg p-4 border border-border mb-4 flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                 <div className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary">
                                     <User size={20} />
                                 </div>
                                 <div>
                                     <p className="text-sm text-secondary">{t('Created by')}</p>
                                     <p className="text-text-main font-bold">{selectedOrder.staff}</p>
                                     {selectedOrder.staffEmail && <p className="text-xs text-secondary">{selectedOrder.staffEmail}</p>}
                                 </div>
                             </div>
                             <div className="text-right">
                                 <p className="text-sm text-secondary">{t('Table')}</p>
                                 <p className="text-text-main font-bold text-lg">{selectedOrder.table}</p>
                             </div>
                        </div>

                        {selectedOrder.items.map((item, i) => (
                            <div key={i} className="flex justify-between p-3 bg-background rounded-lg border border-border">
                                <div className="flex gap-3"><span className="bg-border px-2 rounded text-text-main font-bold text-sm flex items-center">{item.quantity}x</span><span className="text-text-main font-medium">{item.name}</span></div>
                                <span className="text-text-main font-bold">{formatPrice(item.price * item.quantity)}</span>
                            </div>
                        ))}
                    </div>
                    {activeTab === 'Pending' ? (
                        <div className="p-6 border-t border-border flex justify-end gap-3">
                             <button onClick={() => handleCancelOrder(selectedOrder.id)} className="px-6 py-3 border border-red-500 text-red-500 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-500/10 transition-colors"><Ban size={16}/> {t('Cancel Order')}</button>
                             <button onClick={() => initiatePayment(selectedOrder)} className="px-6 py-3 bg-primary text-background rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"><Check size={16}/> {t('Confirm')}</button>
                        </div>
                    ) : (
                       <div className="p-6 border-t border-border flex justify-end gap-3">
                          <button onClick={(e) => { e.stopPropagation(); printOrderReceipt(selectedOrder); }} className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors shadow-lg"><Printer size={16}/> {t('Print Bill')}</button>
                       </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};