import { pgTable, serial, varchar, decimal, integer, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).default(''),
  address: text('address').default(''),
  notes: text('notes').default(''),
  deleted: boolean('deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const skuPrices = pgTable('sku_prices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  skuName: varchar('sku_name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 100 }).default(''),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).default('0'),
  unit: varchar('unit', { length: 50 }).default(''),
  deleted: boolean("deleted").default(false),
  params: text('params').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customerPrices = pgTable('customer_prices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  skuName: varchar('sku_name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
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
  skuName: varchar('sku_name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 100 }).default(''),
  unit: varchar('unit', { length: 50 }).default(''),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).default('0'),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});
