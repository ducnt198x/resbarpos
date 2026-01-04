import { supabase } from './supabase';

export const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const processOrderCompletion = async (orderId: string, paymentMethod: string = 'Cash') => {
  try {
    // 1. Fetch Order Items to determine what to deduct from manual finished goods stock
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('quantity, menu_item_id')
      .eq('order_id', orderId);

    if (itemsError) throw itemsError;
    if (!orderItems) return;

    // 2. Deduct MANUAL STOCK from menu_items
    // This decouples sales from raw ingredient inventory. 
    for (const item of orderItems) {
      if (item.menu_item_id) {
         // Fetch current manual stock
         const { data: currentItem } = await supabase
            .from('menu_items')
            .select('stock')
            .eq('id', item.menu_item_id)
            .single();
            
         if (currentItem) {
             const newStock = Math.max(0, currentItem.stock - item.quantity);
             
             await supabase
                .from('menu_items')
                .update({ stock: newStock })
                .eq('id', item.menu_item_id);
         }
      }
    }

    // 3. Mark Order as Completed, Paid, and save Payment Method
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'Completed',
        paid: true,
        payment_method: paymentMethod
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.error('Error processing order completion:', error);
    throw error;
  }
};