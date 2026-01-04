import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Layout, Save, Move, ShoppingBag, Trash2, CreditCard, Printer, Armchair, ChefHat, Loader2, Minus, Square, Circle, RectangleHorizontal, X, ArrowRightLeft, DollarSign, User, Merge, GripHorizontal, Scaling } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';
import { supabase } from '../supabase';
import { MenuItem } from '../types';
import { processOrderCompletion } from '../utils';

type TableStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Reserved';
type TableShape = 'round' | 'rect' | 'square';

interface OrderItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  detail?: string;
  isNew?: boolean;
}

interface TableData {
  id: string;
  label: string;
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  status: TableStatus;
  seats: number;
  guests: number;
  waiter?: string;
  timeElapsed?: string;
  orderId?: string;
  orderStatus?: string;
  items: OrderItem[];
  orderTotal?: number;
}

const TABLE_TEMPLATES = [
  { label: 'Small Round', shape: 'round', width: 80, height: 80, seats: 2, icon: Circle },
  { label: 'Standard Square', shape: 'square', width: 100, height: 100, seats: 4, icon: Square },
  { label: 'Rectangular 4', shape: 'rect', width: 120, height: 80, seats: 4, icon: RectangleHorizontal },
  { label: 'Large Dining', shape: 'rect', width: 160, height: 90, seats: 6, icon: RectangleHorizontal },
  { label: 'Big Round', shape: 'round', width: 140, height: 140, seats: 8, icon: Circle },
  { label: 'Long Bar', shape: 'rect', width: 200, height: 60, seats: 5, icon: RectangleHorizontal },
];

export const FloorPlan: React.FC = () => {
  const { formatPrice } = useCurrency();
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  
  // Admin / Edit State
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [editingTableId, setEditingTableId] = useState<string | null>(null); // Specific table being resized/edited
  const [isEditMode, setIsEditMode] = useState(false); // General layout moving mode

  // --- OPTIMIZED DRAG/RESIZE STATE ---
  // We use Refs for interaction data to avoid re-binding event listeners on every render
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Stores the latest tables state for the Event Listeners to access without dependencies
  const tablesRef = useRef<TableData[]>([]);
  
  // Tracks the active interaction details
  const dragState = useRef<{
    activeId: string | null;
    mode: 'move' | 'resize' | null;
    startX: number;
    startY: number;
    initialX: number; // For move (css left)
    initialY: number; // For move (css top)
    initialW: number; // For resize
    initialH: number; // For resize
    containerW: number;
    containerH: number;
    offsetX: number; // Mouse offset relative to element
    offsetY: number;
  }>({
    activeId: null,
    mode: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    initialW: 0,
    initialH: 0,
    containerW: 0,
    containerH: 0,
    offsetX: 0,
    offsetY: 0
  });

  // UI State just for showing visual feedback (cursor, active class)
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);

  // Menu / New Order State
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('All');
  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const [guestCount, setGuestCount] = useState<number>(2);

  // Table Operations (Transfer/Merge) State
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');

  // Sync Ref with State
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    fetchUserRole();
    fetchData();
    
    // Global Event Listeners (Bound ONCE)
    const handleGlobalMouseMove = (e: MouseEvent) => {
        const { activeId, mode, containerW, containerH, offsetX, offsetY, startX, startY, initialW, initialH } = dragState.current;
        
        if (!activeId || !mode) return;

        if (mode === 'move') {
            // Visual Update ONLY (No DB Call)
            // Calculate new position as percentage
            let xPx = e.clientX - (containerRef.current?.getBoundingClientRect().left || 0) - offsetX;
            let yPx = e.clientY - (containerRef.current?.getBoundingClientRect().top || 0) - offsetY;
            
            // Constrain
            // Find current table dims for constraint
            const currentTable = tablesRef.current.find(t => t.id === activeId);
            const tW = currentTable?.width || 100;
            const tH = currentTable?.height || 100;

            xPx = Math.max(0, Math.min(xPx, containerW - tW));
            yPx = Math.max(0, Math.min(yPx, containerH - tH));

            const xPerc = (xPx / containerW) * 100;
            const yPerc = (yPx / containerH) * 100;

            setTables(prev => prev.map(t => t.id === activeId ? { ...t, x: xPerc, y: yPerc } : t));
        } 
        else if (mode === 'resize') {
             // Visual Update ONLY
             const deltaX = e.clientX - startX;
             const deltaY = e.clientY - startY;

             const newWidth = Math.max(50, initialW + deltaX);
             const newHeight = Math.max(50, initialH + deltaY);

             setTables(prev => prev.map(t => t.id === activeId ? { ...t, width: newWidth, height: newHeight } : t));
        }
    };

    const handleGlobalMouseUp = async () => {
        const { activeId, mode } = dragState.current;
        
        if (activeId && mode) {
            // DB Update happens HERE (Once on drop)
            // Retrieve the latest coordinates/dims from the REF (which matches the latest visual state)
            const finalTableState = tablesRef.current.find(t => t.id === activeId);
            
            if (finalTableState) {
                if (mode === 'move') {
                    await supabase.from('tables').update({ x: finalTableState.x, y: finalTableState.y }).eq('id', activeId);
                } else if (mode === 'resize') {
                    await supabase.from('tables').update({ width: finalTableState.width, height: finalTableState.height }).eq('id', activeId);
                }
            }
        }

        // Reset
        dragState.current = { ...dragState.current, activeId: null, mode: null };
        setActiveInteractionId(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    // Realtime Subscriptions
    const channels = supabase.channel('floorplan-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    return () => { 
        supabase.removeChannel(channels); 
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         if (user.email === 'ducnt198x@gmail.com') {
             setRole('admin');
         } else {
             const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
             if (data) setRole(data.role);
         }
      }
  };

  const fetchData = async () => {
    await Promise.all([fetchTables(), fetchMenuItems()]);
    setLoading(false);
  };

  const fetchTables = async () => {
    const { data: tablesData } = await supabase.from('tables').select('*');
    if (!tablesData) return;

    const { data: activeOrders } = await supabase
        .from('orders')
        .select(`id, table_id, status, created_at, staff_name, guests, total_amount, order_items (id, quantity, price, menu_item_id, menu_items (name))`)
        .in('status', ['Pending', 'Cooking', 'Ready']); 

    const mergedTables: TableData[] = tablesData.map((t: any) => {
        const activeOrder = activeOrders?.find((o: any) => o.table_id === t.id);
        let items: OrderItem[] = [];
        if (activeOrder && activeOrder.order_items) {
            items = activeOrder.order_items.map((oi: any) => {
                let itemName = 'Unknown';
                if (oi.menu_items) {
                     itemName = Array.isArray(oi.menu_items) ? oi.menu_items[0]?.name : oi.menu_items.name;
                }
                return { id: oi.menu_item_id, name: itemName || 'Unknown', price: oi.price, qty: oi.quantity };
            });
        }

        return {
            id: t.id, label: t.label, shape: t.shape, x: Number(t.x), y: Number(t.y), width: Number(t.width), height: Number(t.height), seats: t.seats,
            status: activeOrder ? 'Occupied' : 'Available',
            guests: activeOrder ? (activeOrder.guests || 2) : 0,
            waiter: activeOrder?.staff_name || '',
            orderId: activeOrder?.id,
            orderStatus: activeOrder?.status,
            orderTotal: activeOrder?.total_amount || 0,
            items: items,
            timeElapsed: activeOrder ? getTimeElapsed(activeOrder.created_at) : undefined
        };
    });
    setTables(mergedTables);
  };

  const fetchMenuItems = async () => {
    const { data } = await supabase.from('menu_items').select('*');
    if (data) setMenuItems(data as MenuItem[]);
  };

  const getTimeElapsed = (startTime: string) => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / 1000 / 60); 
      return `${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, '0')}`;
  };

  const selectedTable = useMemo(() => tables.find(t => t.id === selectedTableId), [tables, selectedTableId]);
  const calculateTotal = (items: OrderItem[]) => items.reduce((acc, item) => acc + (item.price * item.qty), 0);
  
  // Validation Helper
  const checkLabelUnique = (newLabel: string, excludeId?: string) => {
      const exists = tables.some(t => t.label.toLowerCase() === newLabel.toLowerCase() && t.id !== excludeId);
      if (exists) {
          alert('Table Name already exists! Please choose a unique name.');
          return false;
      }
      return true;
  };

  // --- Interaction Actions ---

  const handleTableClick = (e: React.MouseEvent, table: TableData) => {
      e.stopPropagation();
      // Single Click: Always select for quick actions (Staff & Admin)
      // If we were editing another table, stop editing it
      if (editingTableId && editingTableId !== table.id) {
          setEditingTableId(null);
      }
      setSelectedTableId(table.id);
  };

  const handleTableDoubleClick = (e: React.MouseEvent, table: TableData) => {
      e.stopPropagation();
      // Double Click: Admin Only -> Enter Edit Mode for this table
      if (role === 'admin') {
          setEditingTableId(table.id);
          setSelectedTableId(table.id); // Ensure it's selected too
      }
  };

  const handleBackgroundClick = () => {
      setSelectedTableId(null);
      setEditingTableId(null);
  };

  // --- Moving Logic (Start) ---
  const handleMouseDownMove = (e: React.MouseEvent, table: TableData) => {
    // Only allow move if global Edit Mode is ON or if this specific table is in edit mode
    if (!isEditMode && editingTableId !== table.id) return;
    
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
        offsetY: e.clientY - tableRect.top
    };
    setActiveInteractionId(table.id);
  };

  // --- Resizing Logic (Start) ---
  const handleResizeStart = (e: React.MouseEvent, table: TableData) => {
      e.stopPropagation();
      e.preventDefault(); 
      
      dragState.current = {
        activeId: table.id,
        mode: 'resize',
        startX: e.clientX,
        startY: e.clientY,
        initialX: table.x,
        initialY: table.y,
        initialW: table.width,
        initialH: table.height,
        containerW: 0, 
        containerH: 0,
        offsetX: 0,
        offsetY: 0
      };
      setActiveInteractionId(table.id);
  };

  // --- CRUD Logic ---

  const handleSaveLayout = async () => {
      const dbTables = tables.map(t => ({ id: t.id, label: t.label, shape: t.shape, x: t.x, y: t.y, width: t.width, height: t.height, seats: t.seats }));
      const { error } = await supabase.from('tables').upsert(dbTables);
      if (!error) { setIsEditMode(false); alert("Layout saved!"); }
  };

  const handleAddTable = async (template?: any) => {
    // Generate a unique label
    let nextNum = tables.length + 1;
    let label = `T-${nextNum}`;
    while (!checkLabelUnique(label)) {
        nextNum++;
        label = `T-${nextNum}`;
    }

    const newId = `T-${Math.floor(Math.random() * 10000)}`;
    const defaults = template || { label: 'New', shape: 'square', width: 100, height: 100, seats: 4 };
    
    // If template has a specific label (not 'New'), check it
    if (defaults.label !== 'New' && !checkLabelUnique(defaults.label)) {
        return; // Validation failed inside checkLabelUnique (alert shown)
    }

    const newTable = { 
        id: newId, 
        label: defaults.label === 'New' ? label : defaults.label, 
        shape: defaults.shape, 
        x: 45, y: 45, 
        width: defaults.width, height: defaults.height, 
        seats: defaults.seats 
    };
    
    setTables(prev => [...prev, { ...newTable, status: 'Available', guests: 0, items: [] } as TableData]);
    await supabase.from('tables').insert([newTable]);
  };

  const handleDeleteTable = async (id: string, e?: React.MouseEvent) => {
    // FIX: Aggressively stop propagation to prevent the click from triggering 
    // the drag listener (onMouseDown) of the parent div.
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    }
    
    console.log("Delete interaction triggered for:", id);
    
    const tableToDelete = tables.find(t => t.id === id);
    if (!tableToDelete) {
        console.error("Table not found locally:", id);
        return;
    }

    if (!window.confirm(`Are you sure you want to delete table "${tableToDelete.label}"?`)) return;

    // 1. Check if Occupied
    if (tableToDelete.status === 'Occupied') {
        alert("Cannot delete an occupied table! Please complete or cancel active orders first.");
        return;
    }

    console.log("Attempting to delete table:", id);

    // 2. Perform Delete
    const { error } = await supabase.from('tables').delete().eq('id', id);

    // 3. Handle Result
    if (error) {
        console.error("Supabase Delete Error:", error);
        // Expanded error alert for debugging RLS vs Constraints
        alert(`FAILED to delete: ${error.message} (Code: ${error.code})\n\nHint: If Code is 42501, it's a permission (RLS) issue.`);
        return;
    }

    console.log("Delete successful for table:", id);

    // 4. Update UI (Only on success)
    if (dragState.current.activeId === id) {
        dragState.current = {
            activeId: null, mode: null, startX: 0, startY: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0, containerW: 0, containerH: 0, offsetX: 0, offsetY: 0
        };
        setActiveInteractionId(null);
    }

    setTables(prev => prev.filter(t => t.id !== id));
    setSelectedTableId(null);
    setEditingTableId(null);
  };

  const handleUpdateTableProps = (id: string, field: keyof TableData, value: any) => {
    if (field === 'label') {
        if (!checkLabelUnique(value, id)) return;
    }
    setTables(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    // Optional: Auto-save props or require "Save Layout"
    if (field === 'label' || field === 'seats' || field === 'shape') {
        supabase.from('tables').update({ [field]: value }).eq('id', id);
    }
  };

  // --- Order Logic (Existing) ---
  const handleOpenNewOrder = () => {
    if (!selectedTableId) { alert("Please select a table first."); return; }
    const table = tables.find(t => t.id === selectedTableId);
    if (table && table.items.length > 0) {
        setCurrentOrderItems([...table.items]);
        setGuestCount(table.guests || 2);
    } else {
        setCurrentOrderItems([]);
        setGuestCount(table?.guests || 2);
    }
    setShowMenuModal(true);
  };

  const handleAddToOrder = (item: MenuItem) => {
    setCurrentOrderItems(prev => {
        const existing = prev.find(i => i.id === item.id);
        if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
        return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, isNew: true }];
    });
  };

  const handleUpdateOrderQty = (id: number, delta: number) => {
    setCurrentOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, qty: Math.max(1, item.qty + delta) };
      }
      return item;
    }));
  };

  const handleRemoveFromOrder = (id: number) => {
    setCurrentOrderItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmOrder = async () => {
      if (!selectedTableId) return;
      const table = tables.find(t => t.id === selectedTableId);
      const totalAmount = calculateTotal(currentOrderItems);
      const orderId = table?.orderId || `#${Date.now().toString().slice(-6)}`;
      
      if (!table?.orderId) {
          if (currentOrderItems.length === 0) return; 
          
          // Get User for user_id foreign key
          const { data: { user } } = await supabase.auth.getUser();

          const { error } = await supabase.from('orders').insert([{ 
              id: orderId, 
              table_id: selectedTableId, 
              status: 'Pending', 
              total_amount: totalAmount, 
              staff_name: user?.user_metadata?.full_name || 'Current Staff', 
              user_id: user?.id, // Added user_id
              guests: guestCount 
          }]);
          
          if (error) { alert("Failed to create order"); return; }
      } else {
           await supabase.from('orders').update({ total_amount: totalAmount, guests: guestCount }).eq('id', orderId);
           await supabase.from('order_items').delete().eq('order_id', orderId);
      }
      
      if (currentOrderItems.length > 0) {
        const orderItemsDb = currentOrderItems.map(i => ({ order_id: orderId, menu_item_id: i.id, quantity: i.qty, price: i.price }));
        const { error: itemsError } = await supabase.from('order_items').insert(orderItemsDb);
        if (itemsError) console.error(itemsError);
      }
      
      await fetchTables(); 
      setShowMenuModal(false); 
  };

  const handleOpenPayment = () => {
      if (!selectedTableId || !selectedTable?.orderId) return;
      setPaymentMethod('Cash');
      setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
      if (!selectedTable?.orderId) return;
      try {
          await processOrderCompletion(selectedTable.orderId, paymentMethod);
          setShowPaymentModal(false);
          setSelectedTableId(null);
          await fetchTables();
      } catch (error) {
          alert("Error processing payment.");
      }
  };

  const handleOpenTransferModal = () => {
      if (!selectedTableId) return;
      setShowTransferModal(true);
  };

  const handleTransferMerge = async (targetTable: TableData) => {
    if (!selectedTable || !selectedTable.orderId) return;
    setLoading(true);

    try {
        if (targetTable.status === 'Available') {
            const { error } = await supabase.from('orders').update({ table_id: targetTable.id }).eq('id', selectedTable.orderId);
            if (error) throw error;
        } else if (targetTable.status === 'Occupied' && targetTable.orderId) {
            const sourceOrderId = selectedTable.orderId;
            const targetOrderId = targetTable.orderId;
            const sourceTotal = selectedTable.orderTotal || 0;
            const targetTotal = targetTable.orderTotal || 0;
            const { error: itemsError } = await supabase.from('order_items').update({ order_id: targetOrderId }).eq('order_id', sourceOrderId);
            if (itemsError) throw itemsError;
            const { error: updateError } = await supabase.from('orders').update({ total_amount: sourceTotal + targetTotal }).eq('id', targetOrderId);
            if (updateError) throw updateError;
            const { error: deleteError } = await supabase.from('orders').delete().eq('id', sourceOrderId);
            if (deleteError) throw deleteError;
        }
        setShowTransferModal(false);
        setSelectedTableId(null);
        await fetchTables();
    } catch (error: any) {
        alert('Operation failed: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  const filteredMenu = menuItems.filter(item => (menuCategory === 'All' || item.category === menuCategory) && item.name.toLowerCase().includes(menuSearch.toLowerCase()));
  const availableTargets = tables.filter(t => t.id !== selectedTableId && t.id !== 'Takeaway' && t.id !== 'Counter');

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1815] overflow-hidden">
      <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-white text-xl font-bold">Main Hall</h2>
          {isEditMode ? <div className="flex items-center gap-2 text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20"><Layout size={16} /><span className="text-xs font-bold uppercase">Editor</span></div> : <div className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20"><span className="block size-2 rounded-full bg-primary animate-pulse"></span><span className="text-xs font-bold uppercase">Live</span></div>}
        </div>
        <div className="flex items-center gap-4">
          {role === 'admin' && (
             <button onClick={() => isEditMode ? handleSaveLayout() : setIsEditMode(true)} className={`flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-bold transition-colors ${isEditMode ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-surface hover:bg-border text-white border border-border'}`}>{isEditMode ? <Save size={18} /> : <Layout size={18} />}<span>{isEditMode ? 'Save Layout' : 'Edit Layout'}</span></button>
          )}
          {!isEditMode && <button onClick={handleOpenNewOrder} className="flex items-center gap-2 px-4 h-10 rounded-lg bg-primary hover:bg-primary-hover text-background text-sm font-bold transition-colors"><Plus size={20} /><span>New Order</span></button>}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div ref={containerRef} onClick={handleBackgroundClick} className="flex-1 p-8 relative overflow-hidden custom-scrollbar select-none" style={{ backgroundImage: isEditMode ? 'linear-gradient(#3a5c50 1px, transparent 1px), linear-gradient(90deg, #3a5c50 1px, transparent 1px)' : 'linear-gradient(#24473b 1px, transparent 1px), linear-gradient(90deg, #24473b 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundColor: '#0d1815' }}>
            {tables.map(t => (
                <div 
                    key={t.id} 
                    onMouseDown={(e) => handleMouseDownMove(e, t)}
                    onClick={(e) => handleTableClick(e, t)}
                    onDoubleClick={(e) => handleTableDoubleClick(e, t)}
                    style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.width}px`, height: `${t.height}px` }} 
                    className={`absolute transition-colors duration-200 flex flex-col items-center justify-center border-2 shadow-lg backdrop-blur-sm z-0 
                        ${t.shape === 'round' ? 'rounded-full' : 'rounded-xl'} 
                        ${selectedTableId === t.id ? 'ring-4 ring-offset-2 ring-offset-background z-10' : ''} 
                        ${(isEditMode || editingTableId === t.id) ? 'bg-surface/80 border-dashed border-orange-500/50 hover:border-orange-500 cursor-move' : t.status === 'Occupied' ? 'bg-surface/90 border-primary shadow-primary/10 ring-primary' : 'bg-surface/50 border-border border-dashed hover:border-secondary text-secondary cursor-pointer'}
                        ${activeInteractionId === t.id ? 'z-50 shadow-2xl scale-[1.02]' : ''}
                    `}
                >
                  
                  {/* EDIT MODE INDICATOR / MOVE ICON */}
                  {(isEditMode || editingTableId === t.id) && <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 rounded-inherit pointer-events-none"><Move className="text-white" size={24} /></div>}
                  
                  {/* STATUS INDICATOR (Normal Mode) */}
                  {!isEditMode && editingTableId !== t.id && t.status === 'Occupied' && <div className="absolute -top-3 flex items-center gap-1 bg-surface px-2 py-0.5 rounded-full border border-border shadow-sm"><span className={`size-2 rounded-full ${t.orderStatus === 'Ready' ? 'bg-green-500 animate-pulse' : t.orderStatus === 'Cooking' ? 'bg-orange-500' : 'bg-yellow-500'}`} /><span className="text-[10px] font-bold text-white uppercase">{t.orderStatus}</span></div>}
                  
                  <span className={`text-xl font-bold ${(t.status === 'Available' || isEditMode || editingTableId === t.id) ? 'text-secondary' : 'text-white'}`}>{t.label}</span>
                  {!isEditMode && editingTableId !== t.id && t.status === 'Occupied' && <div className="mt-1 text-xs text-white font-bold bg-primary/20 px-2 py-0.5 rounded">{formatPrice(calculateTotal(t.items))}</div>}

                  {/* ADMIN EDIT CONTROLS */}
                  {editingTableId === t.id && (
                      <>
                        <button 
                            onMouseDown={(e) => e.stopPropagation()} // STOP DRAG Propagation
                            onClick={(e) => handleDeleteTable(t.id, e)} // Trigger delete
                            className="absolute -top-3 -right-3 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors z-[9999] cursor-pointer pointer-events-auto"
                            title="Delete Table"
                        >
                            <Trash2 size={14} strokeWidth={3} />
                        </button>
                        <div 
                            className="absolute bottom-1 right-1 cursor-nwse-resize text-orange-500 z-20 p-1 hover:bg-orange-500/20 rounded"
                            onMouseDown={(e) => handleResizeStart(e, t)}
                        >
                            <Scaling size={20} />
                        </div>
                      </>
                  )}

                  {/* QUICK ACTION POPOVER (Only when selected, not editing) */}
                  {!isEditMode && !editingTableId && selectedTableId === t.id && t.status === 'Occupied' && (
                      <div 
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-[#1a2c26] border border-cyan-500/50 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: '12px' }}
                      >
                         <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a2c26] border-t border-l border-cyan-500/50 rotate-45 transform" />

                         <div className="p-4 relative z-10">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-bold text-white text-lg leading-none">{t.orderId}</h4>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                                        <User size={12} />
                                        <span>Khách: {t.guests}</span>
                                    </div>
                                </div>
                                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                    ĐANG PHỤC VỤ
                                </span>
                            </div>
                            <div className="h-px bg-cyan-500/20 my-3" />
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-gray-400 text-sm font-medium">Tạm tính:</span>
                                <span className="text-xl font-bold text-white">{formatPrice(calculateTotal(t.items))}</span>
                            </div>
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button onClick={handleOpenNewOrder} className="h-9 rounded-lg bg-surface border border-border text-white text-xs font-bold hover:bg-border transition-colors flex items-center justify-center gap-1.5 shadow-sm"><Plus size={14} /> Thêm món</button>
                                    <button onClick={handleOpenPayment} className="h-9 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-900/20"><CreditCard size={14} /> Thanh toán</button>
                                </div>
                                <button onClick={handleOpenTransferModal} className="w-full h-8 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"><ArrowRightLeft size={12} /> Chuyển / Ghép bàn</button>
                            </div>
                         </div>
                      </div>
                  )}
                </div>
            ))}
        </div>

        {/* SIDEBAR */}
        <aside className="w-96 bg-background border-l border-border flex flex-col shadow-2xl z-20 transition-all">
          {/* EDIT TABLE PROPERTIES SIDEBAR (Shows when Edit Mode is Global OR Specific Table Edit) */}
          {(isEditMode || editingTableId) ? (
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {/* Determine which table to edit: Either selected or currently being edited */}
                 {(editingTableId || selectedTableId) ? (() => {
                     const activeEditTable = tables.find(t => t.id === (editingTableId || selectedTableId));
                     if (!activeEditTable) return null;
                     return (
                       <div className="space-y-4 animate-in slide-in-from-right duration-200">
                          <div className="flex justify-between items-center"><div><h4 className="font-bold text-white text-lg">Edit Table</h4><p className="text-xs text-secondary">ID: {activeEditTable.id}</p></div><button onClick={() => { setEditingTableId(null); setSelectedTableId(null); }} className="text-xs text-secondary hover:text-white underline mr-4">Close</button></div>
                          <div className="space-y-4 p-5 bg-surface rounded-xl border border-border"><div className="space-y-2"><label className="text-[10px] text-secondary uppercase font-bold tracking-wider">Label (Must be Unique)</label><input type="text" value={activeEditTable.label} onChange={(e) => handleUpdateTableProps(activeEditTable.id, 'label', e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary" /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><label className="text-[10px] text-secondary uppercase font-bold tracking-wider">Seats</label><input type="number" value={activeEditTable.seats} onChange={(e) => handleUpdateTableProps(activeEditTable.id, 'seats', parseInt(e.target.value))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm outline-none" /></div><div className="space-y-2"><label className="text-[10px] text-secondary uppercase font-bold tracking-wider">Shape</label><select value={activeEditTable.shape} onChange={(e) => handleUpdateTableProps(activeEditTable.id, 'shape', e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="rect">Rectangle</option><option value="square">Square</option><option value="round">Round</option></select></div></div></div>
                          <button onClick={() => handleDeleteTable(activeEditTable.id)} className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-bold"><Trash2 size={18} /> Delete Table</button>
                       </div>
                     );
                 })() : (
                   <div className="space-y-4"><h4 className="font-bold text-white text-sm uppercase tracking-wider">Add Table Template</h4><div className="grid grid-cols-2 gap-3">{TABLE_TEMPLATES.map((tpl, idx) => (<button key={idx} onClick={() => handleAddTable(tpl)} className="flex flex-col items-center justify-center gap-2 p-4 bg-surface border border-border hover:border-orange-500 hover:bg-surface/80 rounded-xl transition-all group"><div className="text-secondary group-hover:text-orange-500"><tpl.icon size={28} strokeWidth={1.5} /></div><div className="text-center"><p className="text-xs font-bold text-white">{tpl.label}</p></div></button>))}</div><button onClick={() => handleAddTable()} className="w-full py-3 mt-4 rounded-xl border border-dashed border-secondary/50 text-secondary hover:text-white hover:border-white transition-all flex items-center justify-center gap-2 font-bold"><Plus size={20} /> Custom Empty Table</button></div>
                 )}
               </div>
          ) : (
            // STANDARD SIDEBAR (Active Order)
            selectedTable ? (
            <>
              <div className="p-6 border-b border-border bg-surface">
                <div className="flex justify-between items-start"><div><h3 className="text-2xl font-bold text-white mb-1">Table {selectedTable.label}</h3><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedTable.status === 'Occupied' ? 'bg-primary text-background' : 'bg-gray-600 text-white'}`}>{selectedTable.status}</span></div></div>
              </div>
              {selectedTable.status === 'Occupied' ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                     <div className="flex justify-between items-center px-2 mb-1"><span className="text-xs font-bold text-secondary uppercase">Guests</span><span className="text-xs font-bold text-white bg-surface border border-border px-2 py-0.5 rounded">{selectedTable.guests}</span></div>
                     {selectedTable.items.map((item, i) => (<div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border"><div className="size-6 bg-border rounded flex items-center justify-center text-xs font-bold">{item.qty}</div><div className="flex-1 text-sm font-medium text-white">{typeof item.name === 'string' ? item.name : 'Unknown'}</div><div className="text-sm font-bold text-white">{formatPrice(item.price * item.qty)}</div></div>))}
                  </div>
                  <div className="p-6 bg-surface border-t border-border space-y-4">
                     <div className="flex justify-between items-end"><span className="text-secondary">Total</span><span className="text-2xl font-black text-primary">{formatPrice(calculateTotal(selectedTable.items))}</span></div>
                     <div className="grid grid-cols-2 gap-3"><button onClick={handleOpenNewOrder} className="col-span-2 h-12 bg-primary text-background rounded-lg font-bold hover:bg-primary-hover flex items-center justify-center gap-2"><Plus size={18}/> Edit Order</button><button onClick={handleOpenPayment} className="h-10 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"><CreditCard size={16}/> Pay</button><button className="h-10 border border-border text-white rounded-lg font-bold hover:bg-border flex items-center justify-center gap-2"><Printer size={16}/> Bill</button></div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4"><div className="size-20 bg-surface border border-border rounded-full flex items-center justify-center text-secondary"><Armchair size={40} /></div><div><h3 className="text-white font-bold text-lg">Empty Table</h3><p className="text-secondary text-sm">Ready for service</p></div><button onClick={handleOpenNewOrder} className="w-full bg-primary text-background font-bold py-3 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center justify-center gap-2"><ChefHat size={18}/> Check In & Order</button></div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-secondary"><p>Select a table to view details</p></div>
          ))}
        </aside>
      </div>

      {/* --- MENU MODAL (Edit Order) --- */}
      {showMenuModal && (
          <div className="fixed inset-0 z-50 bg-background/95 flex animate-in slide-in-from-bottom-10 duration-200">
              <div className="flex-1 flex flex-col border-r border-border">
                  <div className="h-16 flex items-center justify-between px-6 border-b border-border"><h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingBag className="text-primary" /> {selectedTable?.status === 'Occupied' ? 'Edit Order' : 'New Order'}</h2><div className="flex gap-2"><input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} className="bg-surface border-none rounded-lg px-4 py-2 text-sm text-white w-64 focus:ring-1 focus:ring-primary" placeholder="Search menu..." /></div></div>
                  <div className="p-4 flex gap-2 overflow-x-auto border-b border-border">{['All', 'Coffee', 'Non Coffee', 'Matcha', 'Food'].map(cat => (<button key={cat} onClick={() => setMenuCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-bold ${menuCategory === cat ? 'bg-white text-background' : 'bg-surface text-secondary'}`}>{cat}</button>))}</div>
                  <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start">{filteredMenu.map(item => (<button key={item.id} onClick={() => handleAddToOrder(item)} disabled={item.stock <= 0} className={`bg-surface border border-border rounded-xl p-3 flex flex-col gap-2 hover:border-primary transition-all text-left ${item.stock <= 0 ? 'opacity-50 grayscale' : ''}`}><div className="aspect-square bg-background rounded-lg overflow-hidden relative">{item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">No Image</div>}{item.stock <= 0 && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-bold text-red-500">SOLD OUT</div>}</div><div><h4 className="font-bold text-white text-sm line-clamp-1">{item.name}</h4><p className="text-primary font-bold text-sm">{formatPrice(item.price)}</p></div></button>))}</div>
              </div>
              <div className="w-96 bg-surface flex flex-col border-l border-border shadow-2xl">
                  <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-background/50"><div><h3 className="font-bold text-white">Order Items</h3></div><button onClick={() => setShowMenuModal(false)}><X size={20} className="text-secondary" /></button></div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      <div className="bg-background rounded-lg p-3 border border-border mb-2"><div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-secondary uppercase">Guests</span><div className="flex items-center gap-3"><button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="text-white hover:text-primary"><Minus size={14}/></button><span className="text-white font-bold">{guestCount}</span><button onClick={() => setGuestCount(guestCount + 1)} className="text-white hover:text-primary"><Plus size={14}/></button></div></div></div>
                      {currentOrderItems.map(item => (<div key={item.id} className="bg-background rounded-lg p-3 flex items-center gap-3 border border-border"><div className="flex flex-col items-center gap-1"><button onClick={() => handleUpdateOrderQty(item.id, 1)}><Plus size={14}/></button><span className="font-bold text-white text-sm">{item.qty}</span><button onClick={() => handleUpdateOrderQty(item.id, -1)}><Minus size={14}/></button></div><div className="flex-1"><p className="text-white font-bold text-sm">{item.name}</p><p className="text-primary text-xs">{formatPrice(item.price)}</p></div><div className="text-right"><p className="text-white font-bold">{formatPrice(item.price * item.qty)}</p><button onClick={() => handleRemoveFromOrder(item.id)} className="text-secondary text-xs">Remove</button></div></div>))}
                  </div>
                  <div className="p-6 bg-background border-t border-border space-y-4"><div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-border"><span>Total</span><span className="text-primary">{formatPrice(calculateTotal(currentOrderItems))}</span></div><button onClick={handleConfirmOrder} className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary-hover">Save Changes</button></div>
              </div>
          </div>
      )}

      {/* --- PAYMENT MODAL --- */}
      {showPaymentModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col animate-in scale-95 duration-200">
                  <div className="p-6 border-b border-border flex justify-between items-center"><h3 className="font-bold text-white text-xl">Payment</h3><button onClick={() => setShowPaymentModal(false)}><X size={20} className="text-secondary hover:text-white"/></button></div>
                  <div className="p-6 space-y-6">
                      <div className="text-center"><p className="text-secondary text-sm mb-1">Total Amount</p><p className="text-4xl font-bold text-white">{formatPrice(calculateTotal(selectedTable?.items || []))}</p></div>
                      <div className="grid grid-cols-3 gap-3">
                          {['Cash', 'Card', 'Transfer'].map(method => (
                              <button key={method} onClick={() => setPaymentMethod(method as any)} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${paymentMethod === method ? 'bg-primary text-background border-primary' : 'bg-background border-border text-secondary hover:border-primary/50'}`}>
                                  {method === 'Cash' ? <DollarSign size={24}/> : method === 'Card' ? <CreditCard size={24}/> : <ArrowRightLeft size={24}/>}
                                  <span className="text-xs font-bold mt-2">{method}</span>
                              </button>
                          ))}
                      </div>
                  </div>
                  <div className="p-6 border-t border-border"><button onClick={handleConfirmPayment} className="w-full py-4 bg-primary text-background font-bold rounded-xl text-lg hover:bg-primary-hover shadow-lg shadow-primary/20">Confirm Payment</button></div>
              </div>
          </div>
      )}

      {/* --- TABLE OPERATIONS MODAL (Transfer / Merge) --- */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in scale-95 duration-200">
                <div className="p-5 border-b border-border flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-white text-xl">Table Operations</h3>
                        <p className="text-secondary text-sm">Transfer order to an empty table OR Merge with an occupied table</p>
                    </div>
                    <button onClick={() => setShowTransferModal(false)} className="text-secondary hover:text-white"><X size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                        {availableTargets.map(t => {
                            const isAvailable = t.status === 'Available';
                            return (
                                <button 
                                    key={t.id}
                                    onClick={() => handleTransferMerge(t)}
                                    className={`p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-3 h-32 group
                                        ${isAvailable 
                                            ? 'bg-background border-border hover:border-primary hover:bg-primary/5' 
                                            : 'bg-red-500/5 border-red-500/20 hover:border-red-500 hover:bg-red-500/10'}`}
                                >
                                    <div className={isAvailable ? 'text-white' : 'text-red-500'}>
                                        {isAvailable ? <ArrowRightLeft size={24} /> : <Merge size={24} />}
                                    </div>
                                    <div className="text-center">
                                        <p className={`font-bold text-lg ${isAvailable ? 'text-white' : 'text-red-500'}`}>{t.label}</p>
                                        <p className="text-xs font-bold uppercase mt-1">
                                            {isAvailable ? <span className="text-primary">Transfer Here</span> : <span className="text-red-400">Merge Here</span>}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                        {availableTargets.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-10 text-secondary">
                                <Armchair size={48} className="opacity-20 mb-4" />
                                <p>No other tables available for operations.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};