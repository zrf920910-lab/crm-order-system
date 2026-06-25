import { pgTable, serial, varchar, decimal, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).default(''),
  address: text('address').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const skuPrices = pgTable('sku_prices', {
  id: serial('id').primaryKey(),
  skuCode: varchar('sku_code', { length: 100 }).notNull().unique(),
  skuName: varchar('sku_name', { length: 255 }).notNull(),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).default('0'),
  unit: varchar('unit', { length: 50 }).default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customerPrices = pgTable('customer_prices', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).default('0'),
  stampImage: text('stamp_image').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  skuName: varchar('sku_name', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});
