import React, { useEffect, useState, useRef } from 'react';
import { 
  Search, Plus, Edit, Trash2, Loader2, X, Image, 
  Save, ScrollText, Minus, ArrowDownUp, AlertCircle, 
  ShoppingCart, Upload, Utensils, Check,
  Armchair, DollarSign, CreditCard, ArrowRightLeft, Users,
  ShoppingBag
} from 'lucide-react';
import { MenuItem, InventoryItem, MenuItemIngredient } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useCurrency } from '../CurrencyContext';

export const Menu: React.FC = () => {
  const { formatPrice } = useCurrency();
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

  // --- Checkout Logic (Refactored) ---

  const fetchAvailableTables = async () => {
      // Fetch all tables
      const { data: allTables } = await supabase.from('tables').select('*');
      
      // Fetch occupied tables (Pending or Cooking orders)
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('table_id')
        .in('status', ['Pending', 'Cooking']);
        
      if (allTables) {
          const occupiedIds = new Set(activeOrders?.map(o => o.table_id) || []);
          
          // Filter: Not occupied AND Not virtual tables
          const available = allTables.filter(t => 
             !occupiedIds.has(t.id) && 
             t.id !== 'Takeaway' && 
             t.id !== 'Counter'
          );
          setAvailableTables(available);
      }
  };

  // Submit Logic: Takeaway (Immediate Pending Order)
  const handleTakeawaySubmit = async () => {
      setIsProcessing(true);
      try {
          const orderId = `#TKW-${Date.now().toString().slice(-6)}`;
          const totalAmount = cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0);
          
          // Get User for user_id foreign key
          const { data: { user } } = await supabase.auth.getUser();

          // 1. Create PENDING Order (Takeaway)
          const { error: orderError } = await supabase.from('orders').insert([{
              id: orderId,
              table_id: 'Takeaway',
              status: 'Pending', // Status is Pending, waiting for kitchen
              total_amount: totalAmount,
              staff_name: user?.user_metadata?.full_name || 'POS Terminal',
              user_id: user?.id, // Added user_id
              guests: 1
          }]);
          
          if (orderError) throw orderError;

          // 2. Insert Items
          const itemsPayload = cart.map(c => ({
              order_id: orderId,
              menu_item_id: c.item.id,
              quantity: c.qty,
              price: c.item.price
          }));
          await supabase.from('order_items').insert(itemsPayload);

          // Success & Reset
          alert(`Takeaway order ${orderId} sent to kitchen!`);
          setCart([]);
          setShowCheckoutModal(false);
      } catch (e: any) {
          alert('Error: ' + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // Submit Logic: Dine-in
  const handleDineInSubmit = async (tableId: string) => {
      setIsProcessing(true);
      try {
          const orderId = `#POS-${Date.now().toString().slice(-6)}`;
          
          // Get User for user_id foreign key
          const { data: { user } } = await supabase.auth.getUser();

          // Create Pending Order
          const { error: orderError } = await supabase.from('orders').insert([{
              id: orderId,
              table_id: tableId,
              status: 'Pending',
              total_amount: cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0),
              staff_name: user?.user_metadata?.full_name || 'POS Terminal',
              user_id: user?.id, // Added user_id
              guests: 2
          }]);
          
          if (orderError) throw orderError;

          // Insert Items
          const itemsPayload = cart.map(c => ({
              order_id: orderId,
              menu_item_id: c.item.id,
              quantity: c.qty,
              price: c.item.price
          }));
          await supabase.from('order_items').insert(itemsPayload);

          alert(`Table ${tableId} order placed!`);
          setCart([]);
          setShowCheckoutModal(false);
      } catch (e: any) {
          alert('Error: ' + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // Handle Type Selection from Modal
  const handleTypeSelection = async (type: 'Dine-in' | 'Takeaway') => {
      setOrderType(type);
      if (type === 'Dine-in') {
          await fetchAvailableTables();
          setCheckoutStep('table-selection');
      } else {
          // Immediate submit for Takeaway
          await handleTakeawaySubmit();
      }
  };

  const initiateCheckout = () => {
      if (cart.length === 0) return;
      setOrderType('Dine-in'); // Reset default
      setCheckoutStep('type-selection');
      setShowCheckoutModal(true);
  };

  // --- Cart Helpers ---
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

  // --- CRUD & Filtering (Existing logic maintained) ---
  const openAddModal = () => {
      setEditingId(null);
      setNewItem({ name: '', category: 'Coffee', price: '', stock: '50', description: '', image: '', status: 'In Stock' });
      setRecipeIngredients([]);
      setShowModal(true);
  };
  const handleEditItem = async (item: MenuItem, e: React.MouseEvent) => {
      e.stopPropagation(); setEditingId(item.id);
      setNewItem({ name: item.name, category: item.category, price: String(item.price), stock: String(item.stock), description: item.description || '', image: item.image || '', status: item.stock > 0 ? 'In Stock' : 'Out of Stock' });
      const { data } = await supabase.from('menu_item_ingredients').select('*').eq('menu_item_id', item.id);
      if (data) {
          const mappedIngredients = data.map((row: any) => {
              const inv = inventoryItems.find(i => String(i.id) === String(row.inventory_item_id));
              return { menu_item_id: item.id, inventory_item_id: row.inventory_item_id, quantity_required: row.quantity_required, inventory_name: inv?.name, unit: inv?.unit };
          });
          setRecipeIngredients(mappedIngredients);
      } else { setRecipeIngredients([]); }
      setShowModal(true);
  };
  const handleSaveItem = async () => {
    if (!newItem.name || !newItem.price) return;
    try {
      setLoading(true);
      const stockValue = newItem.status === 'Out of Stock' ? 0 : (Number(newItem.stock) || 0);
      let itemId = editingId;
      if (editingId) {
          const { error } = await supabase.from('menu_items').update({ name: newItem.name, category: newItem.category, price: Number(newItem.price), stock: stockValue, description: newItem.description, image: newItem.image }).eq('id', editingId);
          if (error) throw error;
          await supabase.from('menu_item_ingredients').delete().eq('menu_item_id', editingId);
      } else {
          const { data, error } = await supabase.from('menu_items').insert([{ name: newItem.name, category: newItem.category, price: Number(newItem.price), stock: stockValue, description: newItem.description, image: newItem.image }]).select().single();
          if (error) throw error;
          itemId = data.id;
      }
      if (itemId && recipeIngredients.length > 0) {
          const ingredientsToInsert = recipeIngredients.map(ing => ({ menu_item_id: itemId, inventory_item_id: ing.inventory_item_id, quantity_required: Number(ing.quantity_required) }));
          await supabase.from('menu_item_ingredients').insert(ingredientsToInsert);
      }
      setShowModal(false); await fetchMenu();
    } catch (error) { console.error('Error saving item:', error); alert('Failed to save item'); } finally { setLoading(false); }
  };
  const handleDeleteItem = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try { setLoading(true); await supabase.from('menu_items').delete().eq('id', id); await fetchMenu(); } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) { const reader = new FileReader(); reader.onloadend = () => { setNewItem(prev => ({ ...prev, image: reader.result as string })); }; reader.readAsDataURL(file); }
  };
  const processedItems = items.filter(item => (categoryFilter === 'All' || item.category === categoryFilter) && item.name.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => { if (sortConfig === 'price-asc') return a.price - b.price; if (sortConfig === 'price-desc') return b.price - a.price; return a.name.localeCompare(b.name); });

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      
      {/* LEFT: Menu Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-border">
        <header className="bg-background/95 backdrop-blur z-10 border-b border-border px-6 py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div><h2 className="text-2xl font-bold text-white flex items-center gap-2"><Utensils className="text-primary" /> Menu</h2><p className="text-secondary text-sm">Manage items and manual stock</p></div>
                <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:border-primary hover:text-white text-secondary transition-all font-bold text-sm"><Plus size={18} /> Manage Item</button>
            </div>
            <div className="flex gap-3">
                 <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search menu..." className="w-full bg-surface text-white pl-10 pr-4 py-2.5 rounded-xl border border-border focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm font-medium"/></div>
                 <button onClick={() => setSortConfig(prev => prev === 'name' ? 'price-asc' : prev === 'price-asc' ? 'price-desc' : 'name')} className="px-3 rounded-xl bg-surface border border-border text-secondary hover:text-white flex items-center gap-2"><ArrowDownUp size={18} /><span className="hidden sm:inline text-xs font-bold">{sortConfig === 'name' ? 'Name' : sortConfig === 'price-asc' ? 'Price: Low' : 'Price: High'}</span></button>
            </div>
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">{['All', 'Coffee', 'Non Coffee', 'Matcha', 'Food'].map(cat => (<button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-primary text-background' : 'bg-surface text-secondary hover:text-white border border-border'}`}>{cat}</button>))}</div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0d1815]">
            {loading ? <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div> : errorMsg ? <div className="flex h-full items-center justify-center text-red-400 font-bold gap-2"><AlertCircle /> {errorMsg}</div> : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {processedItems.map((item) => (
                        <div key={item.id} onClick={() => addToCart(item)} className={`group bg-surface rounded-xl overflow-hidden border border-border hover:border-primary transition-all duration-200 cursor-pointer active:scale-95 flex flex-col ${item.stock <= 0 ? 'opacity-60 grayscale' : ''}`}>
                            <div className="aspect-[4/3] bg-black/20 relative overflow-hidden">
                                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-secondary bg-border/30"><Image size={32} /></div>}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => handleEditItem(item, e)} className="p-1.5 bg-black/50 text-white rounded hover:bg-primary hover:text-background"><Edit size={14}/></button><button onClick={(e) => handleDeleteItem(item.id, e)} className="p-1.5 bg-black/50 text-white rounded hover:bg-red-500 hover:text-white"><Trash2 size={14}/></button></div>
                                {item.stock <= 0 && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-red-500 font-black rotate-[-12deg] border-2 border-red-500 px-2 py-1 rounded">SOLD OUT</span></div>}
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white font-bold border border-white/10">Stock: {item.stock}</div>
                            </div>
                            <div className="p-3 flex flex-col flex-1"><div className="flex justify-between items-start mb-1"><h3 className="font-bold text-white text-sm line-clamp-2 leading-tight">{item.name}</h3><span className="text-primary font-bold text-sm whitespace-nowrap">{formatPrice(item.price)}</span></div><p className="text-secondary text-xs line-clamp-2 mb-2">{item.description}</p></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className="w-[380px] bg-surface border-l border-border flex flex-col shadow-2xl shrink-0 z-20">
          <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background">
              <h3 className="font-bold text-white flex items-center gap-2"><ShoppingCart className="text-primary" /> Current Order</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {cart.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-secondary opacity-50 gap-4"><ShoppingCart size={48} strokeWidth={1} /><p className="text-sm">No items added yet</p></div> : (
                  cart.map((c, idx) => (
                      <div key={idx} className="bg-background rounded-lg p-3 border border-border flex gap-3 group hover:border-secondary/30 transition-colors">
                          <div className="size-12 bg-surface rounded-md overflow-hidden shrink-0">{c.item.image ? <img src={c.item.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image size={16} className="text-secondary"/></div>}</div>
                          <div className="flex-1 flex flex-col justify-between">
                              <div className="flex justify-between items-start"><span className="text-sm font-bold text-white line-clamp-1">{c.item.name}</span><span className="text-sm font-bold text-white">{formatPrice(c.item.price * c.qty)}</span></div>
                              <div className="flex items-center gap-3 mt-1"><div className="flex items-center bg-surface rounded border border-border h-6"><button onClick={() => updateCartQty(c.item.id, -1)} className="px-2 hover:bg-border text-secondary hover:text-white h-full flex items-center"><Minus size={12}/></button><span className="text-xs font-bold text-white px-1 min-w-[20px] text-center">{c.qty}</span><button onClick={() => updateCartQty(c.item.id, 1)} className="px-2 hover:bg-border text-secondary hover:text-white h-full flex items-center"><Plus size={12}/></button></div><button onClick={() => removeFromCart(c.item.id)} className="text-xs text-red-500 hover:underline ml-auto">Remove</button></div>
                          </div>
                      </div>
                  ))
              )}
          </div>
          <div className="p-6 bg-background border-t border-border space-y-4">
              <div className="flex justify-between text-sm text-secondary"><span>Subtotal</span><span>{formatPrice(cartTotal)}</span></div>
              <div className="flex justify-between items-end border-t border-border/50 pt-4"><span className="text-white font-bold">Total Amount</span><span className="text-2xl font-black text-primary">{formatPrice(cartTotal)}</span></div>
              <button onClick={initiateCheckout} disabled={cart.length === 0 || isProcessing} className="w-full py-3.5 bg-primary hover:bg-primary-hover text-background font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Check size={20} />} Confirm Order
              </button>
          </div>
      </div>

      {/* Add/Edit Item Modal (Existing) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
             <div className="p-5 border-b border-border flex justify-between items-center bg-surface"><h3 className="text-xl font-bold text-white">{editingId ? 'Edit Item' : 'New Menu Item'}</h3><button onClick={() => setShowModal(false)} className="text-secondary hover:text-white"><X size={24} /></button></div>
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex gap-6">
                    <div className="w-1/3 space-y-2"><label className="text-xs font-bold text-secondary uppercase">Item Image</label><div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-background/80 transition-all relative overflow-hidden group">{newItem.image ? <img src={newItem.image} className="w-full h-full object-cover" /> : <div className="text-center p-4"><Upload className="mx-auto text-secondary mb-2" size={24} /><span className="text-xs text-secondary">Click to upload</span></div>}<input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} /></div></div>
                    <div className="flex-1 space-y-4">
                        <div><label className="block text-secondary text-xs font-bold mb-1.5">Item Name</label><input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} type="text" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary" placeholder="e.g. Signature Cold Brew"/></div>
                        <div className="grid grid-cols-2 gap-4"><div><label className="block text-secondary text-xs font-bold mb-1.5">Category</label><select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary"><option>Coffee</option><option>Non Coffee</option><option>Matcha</option><option>Food</option></select></div><div><label className="block text-secondary text-xs font-bold mb-1.5">Price</label><div className="relative"><input value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg pl-8 pr-4 py-2 text-white focus:ring-1 focus:ring-primary" placeholder="0"/><span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-xs">$</span></div></div></div>
                        <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg"><label className="block text-primary text-xs font-bold mb-1.5 uppercase">Manual Stock Counter</label><div className="flex items-center gap-2"><input value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary font-bold" placeholder="Qty Available"/><span className="text-xs text-secondary w-24 leading-tight">Units ready to serve</span></div></div>
                        <div><label className="block text-secondary text-xs font-bold mb-1.5">Description</label><textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} rows={2} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white text-sm resize-none focus:ring-1 focus:ring-primary"/></div>
                    </div>
                </div>
             </div>
             <div className="p-4 border-t border-border bg-surface flex justify-end gap-3"><button onClick={() => setShowModal(false)} className="px-6 py-2 rounded-lg border border-border text-white font-bold text-sm hover:bg-border">Cancel</button><button onClick={handleSaveItem} className="px-6 py-2 rounded-lg bg-primary text-background font-bold text-sm hover:bg-primary-hover flex items-center gap-2"><Save size={16} /> Save Item</button></div>
          </div>
        </div>
      )}

      {/* --- CHECKOUT MODAL --- */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col animate-in scale-95 duration-200 overflow-hidden">
             
             {/* Header */}
             <div className="p-5 border-b border-border flex justify-between items-center bg-background/50">
               <h3 className="font-bold text-white text-lg">
                  {checkoutStep === 'type-selection' && 'Select Order Type'}
                  {checkoutStep === 'table-selection' && 'Select Table (Dine-in)'}
               </h3>
               <button onClick={() => setShowCheckoutModal(false)} className="text-secondary hover:text-white"><X size={20} /></button>
             </div>

             {/* Content */}
             <div className="p-6">
                
                {/* Step 1: Type Selection */}
                {checkoutStep === 'type-selection' && (
                   <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => handleTypeSelection('Dine-in')}
                        disabled={isProcessing}
                        className="flex flex-col items-center justify-center p-8 bg-surface border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group disabled:opacity-50"
                      >
                         <div className="size-16 rounded-full bg-background border border-border flex items-center justify-center mb-4 group-hover:border-primary">
                            <Utensils size={32} className="text-secondary group-hover:text-primary"/>
                         </div>
                         <h4 className="text-white font-bold text-lg">Dine-in</h4>
                         <p className="text-secondary text-sm text-center mt-1">Serve at table</p>
                      </button>
                      <button 
                        onClick={() => handleTypeSelection('Takeaway')}
                        disabled={isProcessing}
                        className="flex flex-col items-center justify-center p-8 bg-surface border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group disabled:opacity-50"
                      >
                         <div className="size-16 rounded-full bg-background border border-border flex items-center justify-center mb-4 group-hover:border-primary">
                            {isProcessing && orderType === 'Takeaway' ? <Loader2 size={32} className="animate-spin text-primary" /> : <ShoppingBag size={32} className="text-secondary group-hover:text-primary"/>}
                         </div>
                         <h4 className="text-white font-bold text-lg">Takeaway</h4>
                         <p className="text-secondary text-sm text-center mt-1">Pack to go</p>
                      </button>
                   </div>
                )}

                {/* Step 2: Table Selection (Dine-in only) */}
                {checkoutStep === 'table-selection' && (
                    <div className="space-y-4">
                       <p className="text-sm text-secondary">Select an available table to assign this order.</p>
                       <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                          {availableTables.length === 0 ? (
                             <div className="col-span-3 text-center py-8 text-secondary">No tables available</div>
                          ) : (
                             availableTables.map(t => (
                                <button 
                                  key={t.id}
                                  onClick={() => setSelectedTableId(t.id)}
                                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all
                                    ${selectedTableId === t.id 
                                      ? 'bg-primary text-background border-primary' 
                                      : 'bg-background border-border text-white hover:border-primary/50'}`}
                                >
                                   <Armchair size={24} />
                                   <span className="font-bold">{t.label}</span>
                                </button>
                             ))
                          )}
                       </div>
                       <button 
                          onClick={() => selectedTableId && handleDineInSubmit(selectedTableId)}
                          disabled={!selectedTableId || isProcessing}
                          className="w-full py-3 bg-primary text-background font-bold rounded-xl mt-4 hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                          {isProcessing ? <Loader2 className="animate-spin" /> : <Check size={18} />}
                          Confirm Table & Order
                       </button>
                    </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};