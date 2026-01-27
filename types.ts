export interface DeliveryRecord {
  date: string;
  note?: string;
}

export interface Person {
  id: string;
  name: string;
  familySize: number;
  address: string;
  phone: string;
  lastBasketDate?: string;
  notes?: string;
  history?: DeliveryRecord[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'unidade' | 'litro' | 'pacote';
  category: 'alimento' | 'higiene' | 'vestuario';
  minThreshold: number;
}

export interface BasketItemConfig {
  itemId: string;
  quantityRequired: number;
}

export interface BasketConfig {
  name: string;
  items: BasketItemConfig[];
}

export interface DeliveryEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  description?: string;
}

export type ViewState = 'dashboard' | 'people' | 'inventory' | 'baskets' | 'ai-assistant';