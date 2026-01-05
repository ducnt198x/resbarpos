import React, { useEffect, useState, useRef } from 'react';
import { 
  Search, Plus, Edit, Trash2, Loader2, X, Image, 
  Save, ScrollText, Minus, ArrowDownUp, AlertCircle, 
  ShoppingCart, Upload, Utensils, Check,
  Armchair, DollarSign, CreditCard, ArrowRightLeft, Users,
  ShoppingBag, ChevronUp
} from 'lucide-react';
import { MenuItem, InventoryItem, MenuItemIngredient } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useCurrency } from '../CurrencyContext';
import { useTheme } from '../ThemeContext';

export const Menu: React.FC = () => {
  const { formatPrice } = useCurrency();
  const { t } = useTheme();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filters & Sorting
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<'name' | 'price-asc' | 'price-desc'>('name');
  
  // Cart / Order State
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderType, setOrderType] = useState<'Dine-in' | 'Takeaway'>('Dine-in');

  // Mobile Cart State
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Checkout Modal States
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'type-selection' | 'table-selection'>('type-selection');
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Add/Edit Item Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [newItem, setNewItem] = useState({
    name: '', category: 'Coffee', price: '', stock: '', description: '', image: '', status: 'In Stock' as 'In Stock' | 'Out of Stock' 
  });
  
  // Recipe State
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<MenuItemIngredient[]>([]);

  useEffect(() => {
    if (isSupabaseConfigured()) {
        fetchMenu();
        fetchInventory();
    } else {
        setLoading(false);
        setErrorMsg('Database not configured. Please go to Settings.');
    }
  }, []);

  const fetchMenu = async () => {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').order('name');
      if (error) throw error;
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        status: item.stock <= 0 ? 'Out of Stock' : (item.stock < 10 ? 'Low Stock' : 'In Stock')
      }));
      setItems(formattedData);
    } catch (error: any) {
      console.error('Error fetching menu:', error);
      setErrorMsg(error.message === 'Failed to fetch' ? 'Connection failed. Check Database Settings.' : error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
        const { data } = await supabase.from('inventory').select('*').order('name');
        if (data) {
            // @ts-ignore
            setInventoryItems(data);
        }
    } catch (e) { console.error(e); }
  };

  const fetchAvailableTables = async () => {
      const { data: allTables } = await supabase.from('tables').select('*');
      const { data: activeOrders } = await supabase.from('orders').select('table_id').in('status', ['Pending', 'Cooking']);
        
      if (allTables) {
          const occupiedIds = new Set(activeOrders?.map(o => o.table_id) || []);
          const available = allTables.filter(t => !occupiedIds.has(t.id) && t.id !== 'Takeaway' && t.id !== 'Counter');
          
          // NATURAL SORT (Fix: Sort available tables naturally)
          const sortedAvailable = available.sort((a, b) => 
              a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
          );

          setAvailableTables(sortedAvailable);
      }
  };

  const handleTakeawaySubmit = async () => {
      setIsProcessing(true);
      try {
          const orderId = `#TKW-${Date.now().toString().slice(-6)}`;
          const totalAmount = cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0);
          const { data: { user } } = await supabase.auth.getUser();
          const { error: orderError } = await supabase.from('orders').insert([{
              id: orderId, table_id: 'Takeaway', status: 'Pending', total_amount: totalAmount,
              staff_name: user?.user_metadata?.full_name || 'POS Terminal', user_id: user?.id, guests: 1
          }]);
          if (orderError) throw orderError;
          const itemsPayload = cart.map(c => ({ order_id: orderId, menu_item_id: c.item.id, quantity: c.qty, price: c.item.price }));
          await supabase.from('order_items').insert(itemsPayload);
          alert(`Takeaway order ${orderId} sent to kitchen!`);
          setCart([]); setShowCheckoutModal(false); setShowMobileCart(false);
      } catch (e: any) { alert('Error: ' + e.message); } finally { setIsProcessing(false); }
  };

  const handleDineInSubmit = async (tableId: string) => {
      setIsProcessing(true);
      try {
          const orderId = `#POS-${Date.now().toString().slice(-6)}`;
          const { data: { user } } = await supabase.auth.getUser();
          const { error: orderError } = await supabase.from('orders').insert([{
              id: orderId, table_id: tableId, status: 'Pending',
              total_amount: cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0),
              staff_name: user?.user_metadata?.full_name || 'POS Terminal', user_id: user?.id, guests: 2
          }]);
          if (orderError) throw orderError;
          const itemsPayload = cart.map(c => ({ order_id: orderId, menu_item_id: c.item.id, quantity: c.qty, price: c.item.price }));
          await supabase.from('order_items').insert(itemsPayload);
          alert(`Table ${tableId} order placed!`);
          setCart([]); setShowCheckoutModal(false); setShowMobileCart(false);
      } catch (e: any) { alert('Error: ' + e.message); } finally { setIsProcessing(false); }
  };

  const handleTypeSelection = async (type: 'Dine-in' | 'Takeaway') => {
      setOrderType(type);
      if (type === 'Dine-in') { await fetchAvailableTables(); setCheckoutStep('table-selection'); } 
      else { await handleTakeawaySubmit(); }
  };

  const initiateCheckout = () => {
      if (cart.length === 0) return;
      setOrderType('Dine-in'); setCheckoutStep('type-selection'); setShowCheckoutModal(true);
  };

  const addToCart = (item: MenuItem) => {
    if (item.stock <= 0) return;
    setCart(prev => {
        const existing = prev.find(i => i.item.id === item.id);
        if (existing) return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
        return [...prev, { item, qty: 1 }];
    });
  };
  const updateCartQty = (id: number, delta: number) => {
    setCart(prev => prev.map(i => {
        if (i.item.id === id) return { ...i, qty: Math.max(1, i.qty + delta) };
        return i;
    }));
  };
  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.item.id !== id));
  const cartTotal = cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const openAddModal = () => { setEditingId(null); setNewItem({ name: '', category: 'Coffee', price: '', stock: '50', description: '', image: '', status: 'In Stock' }); setRecipeIngredients([]); setShowModal(true); };
  const handleEditItem = async (item: MenuItem, e: React.MouseEvent) => { e.stopPropagation(); setEditingId(item.id); setNewItem({ name: item.name, category: item.category, price: String(item.price), stock: String(item.stock), description: item.description || '', image: item.image || '', status: item.stock > 0 ? 'In Stock' : 'Out of Stock' }); setShowModal(true); };
  const handleSaveItem = async () => { 
    if (!newItem.name || !newItem.price) return;
    try { setLoading(true); 
      const stockValue = newItem.status === 'Out of Stock' ? 0 : (Number(newItem.stock) || 0);
      let itemId = editingId;
      if (editingId) { await supabase.from('menu_items').update({ name: newItem.name, category: newItem.category, price: Number(newItem.price), stock: stockValue, description: newItem.description, image: newItem.image }).eq('id', editingId); } 
      else { await supabase.from('menu_items').insert([{ name: newItem.name, category: newItem.category, price: Number(newItem.price), stock: stockValue, description: newItem.description, image: newItem.image }]); }
      setShowModal(false); await fetchMenu();
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const handleDeleteItem = async (id: number, e: React.MouseEvent) => { e.stopPropagation(); if(confirm('Delete?')) { await supabase.from('menu_items').delete().eq('id', id); fetchMenu(); }};
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setNewItem(prev => ({ ...prev, image: reader.result as string })); }; reader.readAsDataURL(file); } };
  
  const processedItems = items.filter(item => (categoryFilter === 'All' || item.category === categoryFilter) && item.name.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => { if (sortConfig === 'price-asc') return a.price - b.price; if (sortConfig === 'price-desc') return b.price - a.price; return a.name.localeCompare(b.name); });

  const CartContent = () => (
      <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {cart.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-secondary opacity-50 gap-4"><ShoppingCart size={48} strokeWidth={1} /><p className="text-xs">{t('Cart is empty')}</p></div> : (
                  cart.map((c, idx) => (
                      <div key={idx} className="bg-background rounded-lg p-2 border border-border flex gap-2 group hover:border-secondary/30 transition-colors">
                          <div className="size-10 bg-surface rounded-md overflow-hidden shrink-0">{c.item.image ? <img src={c.item.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image size={14} className="text-secondary"/></div>}</div>
                          <div className="flex-1 flex flex-col justify-between">
                              <div className="flex justify-between items-start gap-1"><span className="text-xs font-bold text-text-main line-clamp-1 leading-tight">{c.item.name}</span><span className="text-xs font-bold text-text-main">{formatPrice(c.item.price * c.qty)}</span></div>
                              <div className="flex items-center gap-2 mt-1"><div className="flex items-center bg-surface rounded border border-border h-6"><button onClick={() => updateCartQty(c.item.id, -1)} className="px-1.5 hover:bg-border text-secondary hover:text-text-main h-full flex items-center"><Minus size={12}/></button><span className="text-xs font-bold text-text-main px-1.5 min-w-[20px] text-center">{c.qty}</span><button onClick={() => updateCartQty(c.item.id, 1)} className="px-1.5 hover:bg-border text-secondary hover:text-text-main h-full flex items-center"><Plus size={12}/></button></div><button onClick={() => removeFromCart(c.item.id)} className="text-[10px] text-red-500 hover:underline ml-auto px-1">Remove</button></div>
                          </div>
                      </div>
                  ))
              )}
          </div>
          <div className="p-3 lg:p-4 bg-background border-t border-border space-y-3">
              <div className="flex justify-between text-xs text-secondary"><span>{t('Subtotal')}</span><span>{formatPrice(cartTotal)}</span></div>
              <div className="flex justify-between items-end border-t border-border/50 pt-3"><span className="text-text-main font-bold text-sm">{t('Total Amount')}</span><span className="text-xl font-black text-primary">{formatPrice(cartTotal)}</span></div>
              <button onClick={initiateCheckout} disabled={cart.length === 0 || isProcessing} className="w-full py-3 bg-primary hover:bg-primary-hover text-background font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} {t('Confirm Order')}
              </button>
          </div>
      </>
  );

  return (
    <div className="flex h-full w-full bg-background overflow-hidden flex-col lg:flex-row transition-colors">
      
      {/* LEFT: Menu Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-border w-full">
        {/* Header */}
        <header className="bg-background/95 backdrop-blur z-10 border-b border-border px-4 py-3 lg:px-6 lg:py-4 landscape:py-2 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
                <div><h2 className="text-lg lg:text-2xl font-bold text-text-main flex items-center gap-2"><Utensils className="text-primary" /> {t('Menu')}</h2><p className="text-secondary text-xs lg:text-sm hidden sm:block">{t('Manage items')}</p></div>
                <button onClick={openAddModal} className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:border-primary hover:text-text-main text-secondary transition-all font-bold text-xs lg:text-sm"><Plus size={16} /> <span className="hidden sm:inline">{t('Add Item')}</span></button>
            </div>
            <div className="flex gap-2 lg:gap-3">
                 <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('Search...')} className="w-full bg-surface text-text-main pl-9 pr-4 py-2 rounded-xl border border-border focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm font-medium"/></div>
                 <button onClick={() => setSortConfig(prev => prev === 'name' ? 'price-asc' : prev === 'price-asc' ? 'price-desc' : 'name')} className="px-3 rounded-xl bg-surface border border-border text-secondary hover:text-text-main flex items-center gap-2"><ArrowDownUp size={16} /></button>
            </div>
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
                 {['All', 'Coffee', 'Non Coffee', 'Matcha', 'Food'].map(cat => (
                     <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-full font-bold text-xs lg:text-sm whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-primary text-background' : 'bg-surface text-secondary hover:text-text-main border border-border'}`}>{t(cat)}</button>
                 ))}
             </div>
        </header>

        {/* Scrollable Grid */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-6 custom-scrollbar bg-surface/50">
            {loading ? <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div> : errorMsg ? <div className="flex h-full items-center justify-center text-red-400 font-bold gap-2"><AlertCircle /> {errorMsg}</div> : (
                <div className="grid grid-cols-2 landscape:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-20 lg:pb-0 landscape:pb-4">
                    {processedItems.map((item) => (
                        <div key={item.id} onClick={() => addToCart(item)} className={`group bg-surface rounded-xl overflow-hidden border border-border hover:border-primary transition-all duration-200 cursor-pointer active:scale-95 flex flex-col ${item.stock <= 0 ? 'opacity-60 grayscale' : ''}`}>
                            <div className="aspect-[4/3] bg-background/50 relative overflow-hidden">
                                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-secondary bg-border/30"><Image size={32} /></div>}
                                <div className="absolute top-2 right-2 flex gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => handleEditItem(item, e)} className="p-1.5 bg-black/50 text-white rounded hover:bg-primary hover:text-background"><Edit size={14}/></button><button onClick={(e) => handleDeleteItem(item.id, e)} className="p-1.5 bg-black/50 text-white rounded hover:bg-red-500 hover:text-white"><Trash2 size={14}/></button></div>
                                {item.stock <= 0 && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-red-500 font-black rotate-[-12deg] border-2 border-red-500 px-2 py-1 rounded">SOLD OUT</span></div>}
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white font-bold border border-white/10">Stock: {item.stock}</div>
                            </div>
                            <div className="p-2.5 flex flex-col flex-1">
                                <h3 className="font-bold text-text-main text-xs lg:text-sm line-clamp-2 leading-tight mb-1">{item.name}</h3>
                                <div className="mt-auto flex justify-between items-center">
                                    <span className="text-primary font-bold text-xs lg:text-sm">{formatPrice(item.price)}</span>
                                    <button className="bg-primary/10 text-primary p-1 rounded hover:bg-primary hover:text-background transition-colors"><Plus size={16}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT: Desktop Cart */}
      <div className="hidden lg:flex w-80 bg-surface border-l border-border flex-col shadow-2xl shrink-0 z-20 h-full">
          <div className="h-14 lg:h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background shrink-0">
              <h3 className="font-bold text-text-main flex items-center gap-2 text-sm lg:text-base"><ShoppingCart className="text-primary" size={20} /> {t('Current Order')}</h3>
          </div>
          <CartContent />
      </div>

      {/* MOBILE FLOATING CART BAR */}
      <div className="lg:hidden fixed bottom-[80px] landscape:bottom-4 left-4 right-4 z-30 pointer-events-none">
        {cart.length > 0 && (
          <button 
            onClick={() => setShowMobileCart(true)}
            className="pointer-events-auto w-full bg-primary text-background p-3 rounded-xl shadow-2xl shadow-primary/30 flex items-center justify-between font-bold animate-in slide-in-from-bottom duration-300"
          >
             <div className="flex items-center gap-3">
                 <div className="bg-background/20 size-8 rounded-full flex items-center justify-center text-background font-black">
                    {cartCount}
                 </div>
                 <div className="flex flex-col items-start leading-none">
                    <span className="text-[10px] opacity-80">{t('Total')}</span>
                    <span className="text-base">{formatPrice(cartTotal)}</span>
                 </div>
             </div>
             <div className="flex items-center gap-1 text-sm">
                 {t('View Cart')} <ChevronUp size={20} />
             </div>
          </button>
        )}
      </div>

      {/* MOBILE FULLSCREEN CART MODAL */}
      {showMobileCart && (
         <div className="lg:hidden fixed inset-0 z-50 bg-surface flex flex-col animate-in slide-in-from-bottom duration-300">
             <div className="p-4 border-b border-border flex items-center justify-between bg-background">
                 <h2 className="text-lg font-bold text-text-main flex items-center gap-2"><ShoppingCart className="text-primary"/> {t('Your Cart')}</h2>
                 <button onClick={() => setShowMobileCart(false)} className="p-2 bg-border/50 rounded-full text-text-main"><X size={20} /></button>
             </div>
             <CartContent />
         </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
             <div className="p-5 border-b border-border flex justify-between items-center bg-surface shrink-0"><h3 className="text-xl font-bold text-text-main">{editingId ? t('Edit Item') : t('New Menu Item')}</h3><button onClick={() => setShowModal(false)} className="text-secondary hover:text-text-main"><X size={24} /></button></div>
             <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="w-full lg:w-1/3 space-y-2"><label className="text-xs font-bold text-secondary uppercase">Item Image</label><div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-background/80 transition-all relative overflow-hidden group">{newItem.image ? <img src={newItem.image} className="w-full h-full object-cover" /> : <div className="text-center p-4"><Upload className="mx-auto text-secondary mb-2" size={24} /><span className="text-xs text-secondary">Click to upload</span></div>}<input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} /></div></div>
                    <div className="flex-1 space-y-4">
                        <div><label className="block text-secondary text-xs font-bold mb-1.5">Item Name</label><input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} type="text" className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary" placeholder="e.g. Signature Cold Brew"/></div>
                        <div className="grid grid-cols-2 gap-4"><div><label className="block text-secondary text-xs font-bold mb-1.5">Category</label><select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-main focus:ring-1 focus:ring-primary"><option>Coffee</option><option>Non Coffee</option><option>Matcha</option><option>Food</option></select></div><div><label className="block text-secondary text-xs font-bold mb-1.5">Price</label><div className="relative"><input value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg pl-8 pr-4 py-3 text-text-main focus:ring-1 focus:ring-primary" placeholder="0"/><span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-xs">$</span></div></div></div>
                        <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg"><label className="block text-primary text-xs font-bold mb-1.5 uppercase">Manual Stock Counter</label><div className="flex items-center gap-2"><input value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:ring-1 focus:ring-primary font-bold" placeholder="Qty Available"/><span className="text-xs text-secondary w-24 leading-tight">Units ready to serve</span></div></div>
                        <div><label className="block text-secondary text-xs font-bold mb-1.5">Description</label><textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} rows={2} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main text-sm resize-none focus:ring-1 focus:ring-primary"/></div>
                    </div>
                </div>
             </div>
             <div className="p-4 border-t border-border bg-surface flex justify-end gap-3 shrink-0"><button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-lg border border-border text-text-main font-bold text-sm hover:bg-border">Cancel</button><button onClick={handleSaveItem} className="px-6 py-3 rounded-lg bg-primary text-background font-bold text-sm hover:bg-primary-hover flex items-center gap-2"><Save size={16} /> Save Item</button></div>
          </div>
        </div>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col animate-in scale-95 duration-200 overflow-hidden lg:max-w-lg h-auto">
             <div className="p-5 border-b border-border flex justify-between items-center bg-background/50">
               <h3 className="font-bold text-text-main text-lg">{t('Select Order Type')}</h3>
               <button onClick={() => setShowCheckoutModal(false)} className="text-secondary hover:text-text-main"><X size={20} /></button>
             </div>
             <div className="p-6">
                {checkoutStep === 'type-selection' && (
                   <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleTypeSelection('Dine-in')} className="flex flex-col items-center justify-center p-6 lg:p-8 bg-surface border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group disabled:opacity-50">
                         <div className="size-16 rounded-full bg-background border border-border flex items-center justify-center mb-4 group-hover:border-primary"><Utensils size={32} className="text-secondary group-hover:text-primary"/></div><h4 className="text-text-main font-bold text-lg">{t('Dine-in')}</h4>
                      </button>
                      <button onClick={() => handleTypeSelection('Takeaway')} className="flex flex-col items-center justify-center p-6 lg:p-8 bg-surface border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group disabled:opacity-50">
                         <div className="size-16 rounded-full bg-background border border-border flex items-center justify-center mb-4 group-hover:border-primary"><ShoppingBag size={32} className="text-secondary group-hover:text-primary"/></div><h4 className="text-text-main font-bold text-lg">{t('Takeaway')}</h4>
                      </button>
                   </div>
                )}
                {checkoutStep === 'table-selection' && (
                    <div className="space-y-4">
                       <p className="text-sm text-secondary">{t('Select table')}:</p>
                       <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                          {availableTables.map(t => (
                                <button key={t.id} onClick={() => setSelectedTableId(t.id)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${selectedTableId === t.id ? 'bg-primary text-background border-primary' : 'bg-background border-border text-text-main hover:border-primary/50'}`}>
                                   <Armchair size={24} /><span className="font-bold text-sm">{t.label}</span>
                                </button>
                          ))}
                       </div>
                       <button onClick={() => selectedTableId && handleDineInSubmit(selectedTableId)} disabled={!selectedTableId || isProcessing} className="w-full py-3 bg-primary text-background font-bold rounded-xl mt-4 hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2">{t('Confirm')}</button>
                    </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};