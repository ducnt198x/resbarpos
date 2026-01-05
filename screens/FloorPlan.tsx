import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Layout, Save, Move, ShoppingBag, Trash2, CreditCard, Printer, 
  Armchair, ChefHat, Loader2, Minus, Square, Circle, RectangleHorizontal, 
  X, Users, Type, AlertTriangle, Maximize2, ArrowRightLeft, Check, Grid, MoreHorizontal
} from 'lucide-react';
import { useCurrency } from '../CurrencyContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../supabase';
import { MenuItem } from '../types';
import { PaymentModal } from '../components/PaymentModal';
import { TransferModal } from '../components/TransferModal';
import { processOrderCompletion } from '../utils';
import { printOrderReceipt } from '../utils/printService';

// Local types
interface OrderItem { id: number; name: string; price: number; qty: number; isNew?: boolean; }
export type TableStatus = 'Available' | 'Occupied' | 'Reserved';
export type TableShape = 'square' | 'round' | 'rect';
export interface TableData { id: string; label: string; shape: TableShape; x: number; y: number; width: number; height: number; seats: number; status: TableStatus; guests?: number; orderId?: string; orderStatus?: string; orderTotal?: number; items: OrderItem[]; waiter?: string; timeElapsed?: string; }

const TABLE_TEMPLATES = [
  { label: 'Round (2)', shape: 'round', width: 80, height: 80, seats: 2, icon: Circle },
  { label: 'Square (4)', shape: 'square', width: 100, height: 100, seats: 4, icon: Square },
  { label: 'Rect (4)', shape: 'rect', width: 120, height: 80, seats: 4, icon: RectangleHorizontal },
  { label: 'Large (6)', shape: 'rect', width: 160, height: 90, seats: 6, icon: RectangleHorizontal },
  { label: 'Big Round (8)', shape: 'round', width: 140, height: 140, seats: 8, icon: Circle },
  { label: 'Bar (5)', shape: 'rect', width: 200, height: 60, seats: 5, icon: RectangleHorizontal },
];

export const FloorPlan: React.FC = () => {
  const { formatPrice } = useCurrency();
  const { t } = useTheme();
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  
  // --- EDIT MODE & DIRTY STATE ---
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Drag/Resize State
  const containerRef = useRef<HTMLDivElement>(null);
  const tablesRef = useRef<TableData[]>([]); 
  
  const dragState = useRef<{ 
    activeId: string | null; 
    mode: 'move' | 'resize' | null; 
    startX: number; 
    startY: number; 
    initialX: number; 
    initialY: number; 
    initialW: number; 
    initialH: number; 
    containerW: number; 
    containerH: number; 
    offsetX: number; 
    offsetY: number;
  }>({ 
    activeId: null, mode: null, startX: 0, startY: 0, 
    initialX: 0, initialY: 0, initialW: 0, initialH: 0, 
    containerW: 0, containerH: 0, offsetX: 0, offsetY: 0,
  });
  
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);

  // Modal States
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('All');
  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const [guestCount, setGuestCount] = useState<number>(1);
  
  // Payment States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Transfer/Merge States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);

  useEffect(() => { tablesRef.current = tables; }, [tables]);
  
  // Reset guest count when table selection changes
  useEffect(() => {
      if (selectedTableId) {
          const table = tables.find(t => t.id === selectedTableId);
          if (table) {
              setGuestCount(table.guests && table.guests > 0 ? table.guests : 1);
          }
      }
  }, [selectedTableId, tables]);

  useEffect(() => {
    fetchUserRole(); 
    fetchData();

    // GLOBAL MOUSE EVENTS FOR DRAGGING (ONLY ACTIVE IN EDIT MODE)
    const handleGlobalMouseMove = (e: MouseEvent) => { 
        if (!isEditMode) return; // Strict Lock

        const { activeId, mode, containerW, containerH, offsetX, offsetY, startX, startY, initialW, initialH } = dragState.current;
        if (!activeId || !mode) return;

        if (mode === 'move') {
            let xPx = e.clientX - (containerRef.current?.getBoundingClientRect().left || 0) - offsetX;
            let yPx = e.clientY - (containerRef.current?.getBoundingClientRect().top || 0) - offsetY;
            
            const currentTable = tablesRef.current.find(t => t.id === activeId);
            const tW = currentTable?.width || 100; 
            const tH = currentTable?.height || 100;
            xPx = Math.max(0, Math.min(xPx, containerW - tW)); 
            yPx = Math.max(0, Math.min(yPx, containerH - tH));
            
            const xPerc = (xPx / containerW) * 100; 
            const yPerc = (yPx / containerH) * 100;
            
            setTables(prev => prev.map(t => t.id === activeId ? { ...t, x: xPerc, y: yPerc } : t));
        } else if (mode === 'resize') {
             const deltaX = e.clientX - startX; 
             const deltaY = e.clientY - startY;
             const newWidth = Math.max(60, initialW + deltaX); 
             const newHeight = Math.max(60, initialH + deltaY);
             setTables(prev => prev.map(t => t.id === activeId ? { ...t, width: newWidth, height: newHeight } : t));
        }
    };

    const handleGlobalMouseUp = async () => { 
        if (!isEditMode) return;
        const { activeId, mode } = dragState.current;
        if (activeId && mode) {
           setHasUnsavedChanges(true);
        }
        dragState.current = { ...dragState.current, activeId: null, mode: null }; 
        setActiveInteractionId(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove); 
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    const channels = supabase.channel('floorplan-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
             if (!isEditMode) fetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
        .subscribe();
        
    return () => { 
        supabase.removeChannel(channels); 
        window.removeEventListener('mousemove', handleGlobalMouseMove); 
        window.removeEventListener('mouseup', handleGlobalMouseUp); 
    };
  }, [isEditMode]);

  const fetchUserRole = async () => { const { data: { user } } = await supabase.auth.getUser(); if (user) { if (user.email === 'ducnt198x@gmail.com') { setRole('admin'); } else { const { data } = await supabase.from('users').select('role').eq('id', user.id).single(); if (data) setRole(data.role); } } };
  const fetchData = async () => { await Promise.all([fetchTables(), fetchMenuItems()]); setLoading(false); };
  
  const fetchTables = async () => {
    if (hasUnsavedChanges && isEditMode) return;

    const { data: tablesData } = await supabase.from('tables').select('*'); if (!tablesData) return;
    const { data: activeOrders } = await supabase.from('orders').select(`id, table_id, status, created_at, staff_name, guests, total_amount, order_items (id, quantity, price, menu_item_id, menu_items (name))`).in('status', ['Pending', 'Cooking', 'Ready']); 
    
    const mergedTables: TableData[] = tablesData.map((t: any) => {
        const activeOrder = activeOrders?.find((o: any) => o.table_id === t.id);
        let items: OrderItem[] = [];
        if (activeOrder && activeOrder.order_items) { items = activeOrder.order_items.map((oi: any) => { let itemName = 'Unknown'; if (oi.menu_items) { itemName = Array.isArray(oi.menu_items) ? oi.menu_items[0]?.name : oi.menu_items.name; } return { id: oi.menu_item_id, name: itemName || 'Unknown', price: oi.price, qty: oi.quantity }; }); }
        return { id: t.id, label: t.label, shape: t.shape, x: Number(t.x), y: Number(t.y), width: Number(t.width), height: Number(t.height), seats: t.seats, status: activeOrder ? 'Occupied' : 'Available', guests: activeOrder ? (activeOrder.guests || 2) : 0, waiter: activeOrder?.staff_name || '', orderId: activeOrder?.id, orderStatus: activeOrder?.status, orderTotal: activeOrder?.total_amount || 0, items: items, timeElapsed: activeOrder ? getTimeElapsed(activeOrder.created_at) : undefined };
    });
    setTables(mergedTables);
  };
  
  const fetchMenuItems = async () => { const { data } = await supabase.from('menu_items').select('*'); if (data) setMenuItems(data as MenuItem[]); };
  const getTimeElapsed = (startTime: string) => { const start = new Date(startTime).getTime(); const now = new Date().getTime(); const diff = Math.floor((now - start) / 1000 / 60); return `${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, '0')}`; };
  
  const selectedTable = useMemo(() => tables.find(t => t.id === selectedTableId), [tables, selectedTableId]);
  const activeEditingTable = useMemo(() => tables.find(t => t.id === editingTableId), [tables, editingTableId]);
  
  const calculateTotal = (items: OrderItem[]) => items.reduce((acc, item) => acc + (item.price * item.qty), 0);
  
  // --- INTERACTIONS (Strict Mode Locking) ---
  const handleTableDoubleClick = (e: React.MouseEvent, table: TableData) => { 
      e.stopPropagation(); 
      if (role !== 'admin') return; 
      setIsEditMode(true); 
      setEditingTableId(table.id); 
      setSelectedTableId(table.id); 
  };
  
  const handleTableClick = (e: React.MouseEvent, table: TableData) => { 
      e.stopPropagation(); 
      if (isEditMode) { 
          setEditingTableId(table.id); 
      } else { 
          // LIVE MODE: Select table to show Floating Panel
          setEditingTableId(null); 
          setSelectedTableId(table.id); 
      } 
  };
  
  const handleMouseDownDrag = (e: React.MouseEvent, table: TableData) => { 
      // STRICT LOCK: Absolutely no drag logic in Live Mode
      if (!isEditMode) return; 

      e.stopPropagation(); 
      if (!containerRef.current) return; 
      
      const containerRect = containerRef.current.getBoundingClientRect(); 
      const tableRect = e.currentTarget.getBoundingClientRect(); 
      
      dragState.current = { 
          activeId: table.id, 
          mode: 'move', 
          startX: e.clientX, 
          startY: e.clientY, 
          initialX: table.x, 
          initialY: table.y, 
          initialW: table.width, 
          initialH: table.height, 
          containerW: containerRect.width, 
          containerH: containerRect.height, 
          offsetX: e.clientX - tableRect.left, 
          offsetY: e.clientY - tableRect.top,
      }; 
      setEditingTableId(table.id);
      setActiveInteractionId(table.id);
  };
  
  const handleBackgroundClick = () => { 
      if (isEditMode) { setEditingTableId(null); } else { setSelectedTableId(null); } 
  };
  
  const handleResizeStart = (e: React.MouseEvent, table: TableData) => { 
      e.stopPropagation(); e.preventDefault(); 
      if (!isEditMode) return; 
      dragState.current = { activeId: table.id, mode: 'resize', startX: e.clientX, startY: e.clientY, initialX: table.x, initialY: table.y, initialW: table.width, initialH: table.height, containerW: 0, containerH: 0, offsetX: 0, offsetY: 0 }; 
      setActiveInteractionId(table.id); 
  };

  const handleUpdateGuestCount = async (delta: number) => {
      const newCount = Math.max(1, guestCount + delta);
      setGuestCount(newCount);
      
      if (selectedTable?.status === 'Occupied' && selectedTable.orderId) {
          await supabase.from('orders').update({ guests: newCount }).eq('id', selectedTable.orderId);
          fetchTables(); 
      }
  };

  const handleSaveAllChanges = async () => { 
      if (!hasUnsavedChanges) { setIsEditMode(false); setEditingTableId(null); return; }
      setIsSaving(true);
      try {
          const updates = tables.map(t => ({ id: t.id, label: t.label, x: t.x, y: t.y, width: t.width, height: t.height, shape: t.shape, seats: t.seats }));
          const { error } = await supabase.from('tables').upsert(updates);
          if (error) throw error;
          setHasUnsavedChanges(false); setIsEditMode(false); setEditingTableId(null);
      } catch (e: any) { alert("Failed to save layout: " + e.message); } finally { setIsSaving(false); }
  };

  const handleAddTable = async (template?: any) => { 
      let nextNum = tables.length + 1; let label = `T-${nextNum}`; 
      while (tables.some(t => t.label === label)) { nextNum++; label = `T-${nextNum}`; } 
      const newId = `T-${Date.now()}`; const defaults = template || { label: 'New', shape: 'square', width: 100, height: 100, seats: 4 }; 
      const newTable = { id: newId, label: defaults.label === 'New' ? label : defaults.label, shape: defaults.shape, x: 45, y: 45, width: defaults.width, height: defaults.height, seats: defaults.seats, status: 'Available', guests: 0, items: [] } as TableData; 
      setTables(prev => [...prev, newTable]); 
      if (isEditMode) { setEditingTableId(newId); setHasUnsavedChanges(true); }
  };
  
  const handleDeleteTable = async (id: string, e?: React.MouseEvent) => { 
      if (e) { e.preventDefault(); e.stopPropagation(); } 
      if (!window.confirm("Delete this table?")) return;
      const tableToDelete = tables.find(t => t.id === id); if (!tableToDelete) return; 
      if (tableToDelete.status === 'Occupied') { alert("Cannot delete occupied table!"); return; } 
      const { error } = await supabase.from('tables').delete().eq('id', id); if (error) { alert(`FAILED: ${error.message}`); return; } 
      setTables(prev => prev.filter(t => t.id !== id)); if (editingTableId === id) setEditingTableId(null); setSelectedTableId(null); 
  };
  
  const handleUpdateTableProps = (id: string, field: keyof TableData, value: any, e?: React.MouseEvent) => { 
      if (e) { e.preventDefault(); e.stopPropagation(); }
      setTables(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t)); setHasUnsavedChanges(true);
  };

  const handleOpenNewOrder = () => { 
      if (!selectedTableId) return; 
      const table = tables.find(t => t.id === selectedTableId); 
      if (table && table.items.length > 0) { 
          setCurrentOrderItems([...table.items]); 
      } else { 
          setCurrentOrderItems([]); 
      } 
      setShowMenuModal(true); 
  };

  const handleAddToOrder = (item: MenuItem) => { setCurrentOrderItems(prev => { const existing = prev.find(i => i.id === item.id); if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i); return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, isNew: true }]; }); };
  const handleUpdateOrderQty = (id: number, delta: number) => { setCurrentOrderItems(prev => prev.map(item => { if (item.id === id) { return { ...item, qty: Math.max(1, item.qty + delta) }; } return item; })); };
  const handleRemoveFromOrder = (id: number) => { setCurrentOrderItems(prev => prev.filter(item => item.id !== id)); };
  
  const handleConfirmOrder = async () => { 
      if (!selectedTableId) return; 
      const table = tables.find(t => t.id === selectedTableId); 
      const totalAmount = calculateTotal(currentOrderItems); 
      const orderId = table?.orderId || `#${Date.now().toString().slice(-6)}`; 
      
      const { data: { user } } = await supabase.auth.getUser();

      if (!table?.orderId) { 
          if (currentOrderItems.length === 0) return; 
          const { error } = await supabase.from('orders').insert([{ 
              id: orderId, 
              table_id: selectedTableId, 
              status: 'Pending', 
              total_amount: totalAmount, 
              staff_name: user?.user_metadata?.full_name || 'Current Staff', 
              user_id: user?.id, 
              guests: guestCount 
          }]); 
          if (error) { alert("Failed"); return; } 
      } else { 
          await supabase.from('orders').update({ total_amount: totalAmount, guests: guestCount }).eq('id', orderId); 
          await supabase.from('order_items').delete().eq('order_id', orderId); 
      } 
      if (currentOrderItems.length > 0) { 
          const orderItemsDb = currentOrderItems.map(i => ({ order_id: orderId, menu_item_id: i.id, quantity: i.qty, price: i.price })); 
          await supabase.from('order_items').insert(orderItemsDb); 
      } 
      await fetchTables(); 
      setShowMenuModal(false); 
      setSelectedTableId(null); 
  };
  
  const handleOpenPayment = () => { 
      if (!selectedTableId || !selectedTable?.orderId) return; 
      setShowPaymentModal(true); 
  };

  const handlePaymentConfirm = async (method: 'Cash' | 'Card' | 'Transfer', shouldPrint: boolean) => {
      if (!selectedTable || !selectedTable.orderId) return;
      setIsProcessingPayment(true);
      try {
          await processOrderCompletion(selectedTable.orderId, method);
          
          if (shouldPrint) {
              const fullOrder = {
                  id: selectedTable.orderId,
                  table: selectedTable.label,
                  staff: selectedTable.waiter || 'Staff',
                  items: selectedTable.items,
                  total: calculateTotal(selectedTable.items),
                  created_at: new Date().toISOString(),
                  payment_method: method
              };
              printOrderReceipt(fullOrder);
          }
          
          setShowPaymentModal(false);
          setSelectedTableId(null);
          await fetchTables();
      } catch (error: any) {
          alert("Payment failed: " + error.message);
      } finally {
          setIsProcessingPayment(false);
      }
  };

  const handleOpenTransfer = () => {
      if (!selectedTableId) return;
      setShowTransferModal(true);
  };

  const handleTransferConfirm = async (targetTableId: string, mode: 'move' | 'merge') => {
      if (!selectedTable || !selectedTable.orderId) return;
      setIsProcessingTransfer(true);
      try {
          if (mode === 'move') {
              // MOVE LOGIC: Update order's table_id to target
              const { error } = await supabase
                .from('orders')
                .update({ table_id: targetTableId })
                .eq('id', selectedTable.orderId);
              if (error) throw error;
          } else {
              // MERGE LOGIC:
              // 1. Get target table order
              const targetTable = tables.find(t => t.id === targetTableId);
              if (!targetTable || !targetTable.orderId) throw new Error("Target table has no order to merge into");
              
              // 2. Move items from current order to target order
              const { error: moveItemsError } = await supabase
                .from('order_items')
                .update({ order_id: targetTable.orderId })
                .eq('order_id', selectedTable.orderId);
              if (moveItemsError) throw moveItemsError;

              // 3. Update target order total
              const newTotal = (targetTable.orderTotal || 0) + (selectedTable.orderTotal || 0);
              await supabase.from('orders').update({ total_amount: newTotal }).eq('id', targetTable.orderId);

              // 4. Delete current order (empty shell)
              await supabase.from('orders').delete().eq('id', selectedTable.orderId);
          }
          
          await fetchTables();
          setShowTransferModal(false);
          setSelectedTableId(null);
      } catch (error: any) {
          alert(`Transfer failed: ${error.message}`);
      } finally {
          setIsProcessingTransfer(false);
      }
  };

  const filteredMenu = menuItems.filter(item => (menuCategory === 'All' || item.category === menuCategory) && item.name.toLowerCase().includes(menuSearch.toLowerCase()));

  const getTableClasses = (t: TableData, isSelected: boolean) => {
    let classes = `absolute flex flex-col items-center justify-center transition-all select-none rounded-2xl `;
    classes += isEditMode ? 'cursor-move ' : 'cursor-pointer ';
    if (t.status === 'Available') {
        classes += "bg-[#f8fafc] border-2 border-dashed border-[#cbd5e1] text-[#64748b] shadow-sm hover:border-[#10B981] hover:text-[#10B981] hover:shadow-md hover:bg-white ";
        classes += "dark:bg-[#1a2c26]/40 dark:border-[#19e6a2]/30 dark:text-[#93c8b6] dark:hover:border-[#19e6a2] dark:hover:bg-[#19e6a2]/10 ";
    } else {
        classes += "bg-white border-2 border-[#10B981] text-[#065f46] shadow-[0_8px_24px_rgba(16,185,129,0.25)] ";
        classes += "dark:bg-[#052e16] dark:border-[#19e6a2] dark:text-white dark:shadow-[0_0_20px_rgba(25,230,162,0.15)] ";
    }
    if (isEditMode && editingTableId === t.id) {
        classes = `absolute flex flex-col items-center justify-center rounded-2xl bg-white/90 dark:bg-[#1a2c26]/80 border-2 border-primary shadow-[0_0_15px_rgba(16,185,129,0.3)] dark:shadow-[0_0_15px_rgba(25,230,162,0.3)] z-20 cursor-move text-primary select-none`;
    }
    if (isSelected) {
        classes += "ring-2 ring-offset-2 ring-[#10B981] ring-offset-[#F8FAFC] dark:ring-offset-[#0d1815] z-30 scale-105 ";
    }
    if (activeInteractionId === t.id) {
        classes += ' z-50 shadow-2xl scale-[1.02] ';
    }
    return classes;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative transition-colors bg-background">
      <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-background shrink-0 z-30">
        <div className="flex items-center gap-4">
          <h2 className="text-text-main text-lg lg:text-xl font-bold">{t('Main Hall')}</h2>
          {isEditMode ? 
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20"><Layout size={16} /><span className="text-xs font-bold uppercase hidden sm:inline">{t('Editor Mode')}</span></div>
                {hasUnsavedChanges && <div className="text-primary text-xs font-bold animate-pulse flex items-center gap-1"><AlertTriangle size={12}/> Unsaved</div>}
             </div>
             : 
             <div className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20"><span className="block size-2 rounded-full bg-primary animate-pulse"></span><span className="text-xs font-bold uppercase hidden sm:inline">{t('Live')}</span></div>
          }
        </div>
        <div className="flex items-center gap-4">
          {role === 'admin' && (
             <button 
                onClick={() => isEditMode ? handleSaveAllChanges() : setIsEditMode(true)} 
                disabled={isSaving}
                className={`flex items-center gap-2 px-3 lg:px-4 h-9 lg:h-10 rounded-lg text-xs lg:text-sm font-bold transition-all
                    ${isEditMode 
                        ? (hasUnsavedChanges ? 'bg-primary hover:bg-primary-hover text-background shadow-lg shadow-primary/20' : 'bg-surface hover:bg-border text-text-main border border-border') 
                        : 'bg-surface hover:bg-border text-text-main border border-border'
                    }
                `}
             >
                {isEditMode ? 
                    (isSaving ? <><Loader2 size={18} className="animate-spin"/> {t('Save Changes')}...</> : <><Save size={18}/> {hasUnsavedChanges ? t('Save Changes') : t('Done')}</>) 
                    : <><Layout size={18} /> {t('Edit Layout')}</>
                }
             </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div 
            ref={containerRef} 
            onClick={handleBackgroundClick} 
            className="flex-1 overflow-auto custom-scrollbar select-none relative" 
            style={{ 
                backgroundImage: 'linear-gradient(var(--color-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid) 1px, transparent 1px)', 
                backgroundSize: '40px 40px', 
                backgroundColor: 'var(--color-floor-bg)', 
                minHeight: '1000px', 
                minWidth: '1000px' 
            }}
        >
            {tables.map(t => {
                const isSelected = selectedTableId === t.id && !isEditMode;
                return (
                  <div 
                      key={t.id} 
                      onMouseDown={(e) => handleMouseDownDrag(e, t)}
                      onClick={(e) => handleTableClick(e, t)}
                      onDoubleClick={(e) => handleTableDoubleClick(e, t)}
                      style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.width}px`, height: `${t.height}px` }} 
                      className={getTableClasses(t, isSelected)}
                  >
                    {(isEditMode && editingTableId === t.id) && <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-inherit pointer-events-none"><Move className="text-primary opacity-50" size={32} /></div>}
                    {!isEditMode && editingTableId !== t.id && t.status === 'Occupied' && <div className="absolute -top-3 flex items-center gap-1 bg-surface px-2 py-0.5 rounded-full border border-border shadow-sm"><span className={`size-2 rounded-full ${t.orderStatus === 'Ready' ? 'bg-green-500 animate-pulse' : t.orderStatus === 'Cooking' ? 'bg-primary' : 'bg-yellow-500'}`} /><span className="text-[10px] font-bold text-text-main uppercase">{t.orderStatus}</span></div>}
                    
                    <span className={`text-xl font-bold`}>{t.label}</span>
                    
                    {!isEditMode && t.status === 'Occupied' && <div className="mt-1 text-xs font-bold bg-black/10 px-2 py-0.5 rounded text-current">{formatPrice(calculateTotal(t.items))}</div>}
                    {isEditMode && editingTableId === t.id && ( 
                        <div 
                            className="absolute bottom-0 right-0 z-20 p-1 cursor-nwse-resize text-primary hover:bg-primary/20 rounded-tl" 
                            onMouseDown={(e) => handleResizeStart(e, t)}
                        >
                            <Maximize2 size={20} strokeWidth={2.5} />
                        </div> 
                    )}
                  </div>
                );
            })}

            {/* --- ACTION PANEL (Smart Position & Responsive) --- */}
            {!isEditMode && selectedTable && (
               <div 
                 onClick={(e) => e.stopPropagation()}
                 className={`
                    z-50 animate-in duration-200
                    fixed bottom-0 left-0 right-0 w-full rounded-t-2xl border-t border-primary/20 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] pb-safe slide-in-from-bottom
                    lg:absolute lg:bottom-auto lg:left-auto lg:right-auto lg:w-auto lg:rounded-2xl lg:border lg:shadow-2xl lg:pb-0 lg:zoom-in-95
                 `}
                 style={
                    window.innerWidth >= 1024 ? {
                        top: `${selectedTable.y}%`,
                        // 30/70 Rule for Positioning
                        // If x < 30%, show on RIGHT side
                        left: selectedTable.x < 30
                            ? `calc(${selectedTable.x}% + ${selectedTable.width}px + 12px)`
                            : 'auto',
                        // If x >= 30%, show on LEFT side (calculated from right edge)
                        right: selectedTable.x >= 30
                            ? `calc((100% - ${selectedTable.x}%) + 12px)`
                            : 'auto'
                    } : {}
                 }
               >
                 <div className="bg-surface/95 dark:bg-[#1a2c26]/95 backdrop-blur-xl p-4 lg:min-w-[300px] flex flex-col gap-4 lg:rounded-2xl">
                    {/* Mobile Handle */}
                    <div className="lg:hidden w-12 h-1.5 bg-border rounded-full mx-auto -mt-2 mb-2" />
                    
                    {/* Header */}
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                        <div>
                           <h3 className="text-xl font-bold text-text-main">{selectedTable.label}</h3>
                           <p className="text-xs text-secondary font-medium">{t(selectedTable.status)} • {selectedTable.timeElapsed || '0m'}</p>
                        </div>
                        <span className={`size-3 rounded-full ${selectedTable.status === 'Occupied' ? 'bg-primary shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-secondary/50'}`}></span>
                    </div>

                    {/* Guest Control */}
                    <div className="flex items-center justify-between bg-background/50 p-2 rounded-xl border border-border/50">
                        <span className="text-xs font-bold text-secondary uppercase ml-1">{t('Guests')}</span>
                        <div className="flex items-center gap-3">
                           <button onClick={() => handleUpdateGuestCount(-1)} className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"><Minus size={16}/></button>
                           <span className="font-bold text-lg w-4 text-center text-text-main">{guestCount}</span>
                           <button onClick={() => handleUpdateGuestCount(1)} className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"><Plus size={16}/></button>
                        </div>
                    </div>
                    
                    {/* Active Order Preview */}
                    {selectedTable.items.length > 0 && (
                        <div className="max-h-[120px] overflow-y-auto custom-scrollbar bg-background/30 rounded-lg p-2 space-y-1">
                           {selectedTable.items.map((item, idx) => (
                               <div key={idx} className="flex justify-between text-xs">
                                   <span className="text-text-main"><span className="font-bold">{item.qty}x</span> {typeof item.name === 'string' ? item.name : 'Item'}</span>
                                   <span className="font-bold text-text-main">{formatPrice(item.price * item.qty)}</span>
                               </div>
                           ))}
                           <div className="border-t border-border/30 pt-1 mt-1 flex justify-between font-bold text-sm text-primary">
                               <span>{t('Total')}</span>
                               <span>{formatPrice(calculateTotal(selectedTable.items))}</span>
                           </div>
                        </div>
                    )}

                    {/* Main Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleOpenNewOrder} 
                            className={`h-12 bg-surface hover:bg-background border border-border hover:border-primary text-text-main rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${selectedTable.status === 'Occupied' ? 'col-span-1' : 'col-span-2'}`}
                        >
                            <Plus size={18} className="text-primary" /> {t('Add Items')}
                        </button>
                        
                        {/* Only show Pay and Split/Merge if the table is Occupied */}
                        {selectedTable.status === 'Occupied' && (
                            <>
                                <button 
                                    onClick={handleOpenPayment} 
                                    disabled={selectedTable.items.length === 0}
                                    className="col-span-1 h-12 bg-primary hover:bg-primary-hover text-background rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                                >
                                    <CreditCard size={18} /> {t('Pay')}
                                </button>
                                <button onClick={handleOpenTransfer} className="col-span-2 h-9 bg-transparent border border-border/50 text-secondary hover:text-text-main hover:bg-surface rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                    <ArrowRightLeft size={14} /> {t('Split / Merge Table')}
                                </button>
                            </>
                        )}
                    </div>
                 </div>
               </div>
            )}

            {/* --- EDITOR TOOLBAR (Restored) --- */}
            {isEditMode && activeEditingTable && (
               <div 
                 style={{ 
                   left: `${activeEditingTable.x}%`, 
                   top: `${activeEditingTable.y}%`,
                   width: `${activeEditingTable.width}px`,
                   height: `${activeEditingTable.height}px`
                 }} 
                 className="absolute z-50 pointer-events-none"
               >
                 <div 
                   onMouseDown={(e) => e.stopPropagation()}
                   onClick={(e) => e.stopPropagation()}
                   className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 w-[240px] bg-surface/95 backdrop-blur-md border border-primary/20 rounded-xl shadow-2xl p-3 flex flex-col gap-3 animate-in zoom-in-95 duration-200
                     ${activeEditingTable.y < 50 ? 'top-[105%] origin-top' : 'bottom-[105%] origin-bottom'}
                   `}
                 >
                    <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                        <Type size={16} className="text-secondary" />
                        <input 
                          type="text" 
                          value={activeEditingTable.label}
                          onChange={(e) => handleUpdateTableProps(activeEditingTable.id, 'label', e.target.value)}
                          className="flex-1 bg-transparent border-b border-secondary/20 text-text-main font-bold text-sm focus:border-primary outline-none px-1 py-0.5 placeholder-secondary/50"
                          placeholder="Name"
                        />
                        <button onClick={(e) => handleDeleteTable(activeEditingTable.id, e)} className="text-red-500 hover:text-white hover:bg-red-500 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>
                    </div>

                    <div>
                        <span className="text-[10px] uppercase font-bold text-secondary mb-1 block">{t('Shape')}</span>
                        <div className="flex gap-1 bg-background/50 p-1 rounded-lg border border-primary/10">
                            {[
                            { val: 'square', icon: Square },
                            { val: 'round', icon: Circle },
                            { val: 'rect', icon: RectangleHorizontal }
                            ].map((opt) => (
                            <button 
                                key={opt.val}
                                onClick={(e) => handleUpdateTableProps(activeEditingTable.id, 'shape', opt.val, e)}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${activeEditingTable.shape === opt.val ? 'bg-primary text-background shadow-sm' : 'text-secondary hover:text-primary hover:bg-primary/10'}`}
                            >
                                <opt.icon size={16} />
                            </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <span className="text-[10px] uppercase font-bold text-secondary mb-1 block">{t('Seats')}</span>
                        <div className="flex items-center justify-between bg-background/50 p-1.5 rounded-lg px-2 border border-primary/10">
                            <span className="text-xs font-bold text-secondary flex items-center gap-1"><Users size={12}/> {t('Guests')}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={(e) => handleUpdateTableProps(activeEditingTable.id, 'seats', Math.max(1, activeEditingTable.seats - 1), e)} className="size-6 flex items-center justify-center rounded bg-background border border-primary/20 text-text-main hover:bg-primary hover:text-background transition-colors"><Minus size={14}/></button>
                                <span className="text-sm font-bold text-text-main w-4 text-center">{activeEditingTable.seats}</span>
                                <button onClick={(e) => handleUpdateTableProps(activeEditingTable.id, 'seats', activeEditingTable.seats + 1, e)} className="size-6 flex items-center justify-center rounded bg-background border border-primary/20 text-text-main hover:bg-primary hover:text-background transition-colors"><Plus size={14}/></button>
                            </div>
                        </div>
                    </div>
                 </div>
               </div>
            )}
        </div>

        {isEditMode && (
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center z-40 animate-in slide-in-from-bottom-10">
              <div className="bg-surface/90 backdrop-blur-xl border border-primary/20 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4">
                  {TABLE_TEMPLATES.map((tpl, idx) => (
                      <button key={idx} onClick={() => handleAddTable(tpl)} className="group relative flex flex-col items-center gap-1 transition-all hover:scale-110 active:scale-95">
                         <div className="size-10 rounded-xl bg-background border border-primary/20 flex items-center justify-center text-secondary group-hover:text-primary group-hover:border-primary group-hover:bg-primary/10 transition-colors"><tpl.icon size={20} /></div>
                         <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface px-2 py-1 rounded text-[10px] text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-primary/20">{tpl.label}</span>
                      </button>
                  ))}
                  <div className="w-px h-8 bg-primary/20 mx-2"></div>
                  <button onClick={() => handleAddTable()} className="size-10 rounded-full bg-primary text-background flex items-center justify-center hover:bg-primary-hover transition-all hover:scale-110 shadow-lg shadow-primary/20" title="Add Custom Table"><Plus size={24} /></button>
              </div>
           </div>
        )}
      </div>

      {/* --- MENU MODAL --- */}
      {showMenuModal && (
          <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in slide-in-from-bottom-5 duration-200">
              <div className="flex-1 flex overflow-hidden">
                  {/* LEFT: MENU GRID */}
                  <div className="w-full lg:w-[70%] flex flex-col border-r border-border">
                       <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface/50">
                           <h2 className="text-xl font-bold text-text-main flex items-center gap-2"><ShoppingBag className="text-primary" /> {t('Menu')}</h2>
                           <div className="flex items-center gap-2">
                               {['All', 'Coffee', 'Non Coffee', 'Matcha', 'Food'].map(cat => (
                                   <button key={cat} onClick={() => setMenuCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${menuCategory === cat ? 'bg-primary text-background' : 'bg-surface border border-border text-secondary hover:text-text-main'}`}>{t(cat)}</button>
                               ))}
                           </div>
                       </div>
                       <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
                           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                               {filteredMenu.map(item => (
                                   <button key={item.id} onClick={() => handleAddToOrder(item)} disabled={item.stock <= 0} className={`bg-surface border border-border rounded-2xl p-3 flex flex-col gap-3 hover:border-primary transition-all text-left group shadow-sm ${item.stock <= 0 ? 'opacity-50 grayscale' : ''}`}>
                                       <div className="aspect-[4/3] bg-background rounded-xl overflow-hidden relative">
                                           {item.image ? <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center text-xs text-secondary">No Image</div>}
                                           {item.stock <= 0 && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-black text-white uppercase tracking-widest">Sold Out</div>}
                                       </div>
                                       <div>
                                           <h4 className="font-bold text-text-main text-sm line-clamp-1">{item.name}</h4>
                                           <p className="text-primary font-bold text-sm mt-1">{formatPrice(item.price)}</p>
                                       </div>
                                   </button>
                               ))}
                           </div>
                       </div>
                  </div>
                  
                  {/* RIGHT: CART */}
                  <div className="w-full lg:w-[30%] bg-surface flex flex-col h-full shadow-2xl relative z-10">
                       <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-background">
                           <h3 className="font-bold text-text-main">{t('Current Order')}</h3>
                           <button onClick={() => setShowMenuModal(false)} className="size-8 rounded-full bg-border/50 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"><X size={18} /></button>
                       </div>
                       
                       <div className="p-4 bg-primary/5 border-b border-primary/10 flex justify-between items-center">
                           <div className="flex flex-col">
                               <span className="text-xs font-bold text-secondary uppercase">{t('Table')}</span>
                               <span className="text-lg font-black text-text-main">{selectedTable?.label}</span>
                           </div>
                           <div className="text-right">
                               <span className="text-xs font-bold text-secondary uppercase">{t('Guests')}</span>
                               <span className="text-lg font-black text-text-main block">{guestCount}</span>
                           </div>
                       </div>

                       <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {currentOrderItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-secondary opacity-50 space-y-4">
                                    <ShoppingBag size={48} strokeWidth={1} />
                                    <p>{t('Cart is empty')}</p>
                                </div>
                            ) : (
                                currentOrderItems.map(item => (
                                    <div key={item.id} className="bg-background rounded-xl p-3 flex items-center gap-3 border border-border shadow-sm">
                                        <div className="flex flex-col items-center gap-1 bg-surface border border-border rounded-lg p-1">
                                            <button onClick={() => handleUpdateOrderQty(item.id, 1)} className="hover:text-primary"><Plus size={14}/></button>
                                            <span className="font-bold text-text-main text-xs">{item.qty}</span>
                                            <button onClick={() => handleUpdateOrderQty(item.id, -1)} className="hover:text-primary"><Minus size={14}/></button>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-text-main font-bold text-sm line-clamp-1">{item.name}</p>
                                            <p className="text-primary text-xs font-medium">{formatPrice(item.price)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-text-main font-bold">{formatPrice(item.price * item.qty)}</p>
                                            <button onClick={() => handleRemoveFromOrder(item.id)} className="text-[10px] text-red-500 hover:underline">Remove</button>
                                        </div>
                                    </div>
                                ))
                            )}
                       </div>

                       <div className="p-6 bg-background border-t border-border space-y-4 mt-auto shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                           <div className="flex justify-between text-xl font-bold text-text-main">
                               <span>{t('Total')}</span>
                               <span className="text-primary">{formatPrice(calculateTotal(currentOrderItems))}</span>
                           </div>
                           <button onClick={handleConfirmOrder} className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                               <Check size={20} /> {t('Confirm Order')}
                           </button>
                       </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- PAYMENT MODAL --- */}
      {showPaymentModal && selectedTable && selectedTable.orderId && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
          onPrint={() => {
              const fullOrder = {
                  id: selectedTable.orderId,
                  table: selectedTable.label,
                  staff: selectedTable.waiter || 'Staff',
                  items: selectedTable.items,
                  total: calculateTotal(selectedTable.items),
                  created_at: new Date().toISOString()
              };
              printOrderReceipt(fullOrder);
          }}
          totalAmount={calculateTotal(selectedTable.items)}
          orderId={selectedTable.orderId}
          isProcessing={isProcessingPayment}
        />
      )}

      {/* --- TRANSFER MODAL --- */}
      {showTransferModal && selectedTable && (
          <TransferModal
            isOpen={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            onConfirm={handleTransferConfirm}
            currentTable={selectedTable}
            allTables={tables}
            isProcessing={isProcessingTransfer}
          />
      )}
    </div>
  );
};