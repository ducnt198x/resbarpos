export type View = 'login' | 'dashboard' | 'menu' | 'floorplan' | 'orders' | 'inventory' | 'settings';

export interface MenuItem {
  id: number;
  name: string;
  category: 'Coffee' | 'Non Coffee' | 'Food' | 'Matcha';
  price: number;
  image: string;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  description: string;
}

export interface MenuItemIngredient {
  id?: number;
  menu_item_id: number;
  inventory_item_id: string;
  quantity_required: number;
  inventory_name?: string;
  unit?: string;
}

export interface Order {
  id: string;
  table: string;
  time: string;
  staff: string;
  status: 'Pending' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';
  total: number;
  items: OrderItem[];
  note?: string;
  paid?: boolean;
  guests?: number;
  payment_method?: 'Cash' | 'Card' | 'Transfer';
  created_at?: string;
}

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  details?: string;
  image?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  max_stock: number;
  threshold: number;
  price: number;
  status: 'Good' | 'Low' | 'Critical';
  image?: string;
}