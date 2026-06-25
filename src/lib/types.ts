export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkuPrice {
  id: number;
  skuName: string;
  brand: string;
  costPrice: string;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPrice {
  id: number;
  customerId: number;
  skuName: string;
  price: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  totalAmount: string;
  stampImage: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  skuName: string;
  brand: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  total: string;
  createdAt: string;
}
