export type Role = 'CUSTOMER' | 'DELIVERY' | 'OPERATOR' | 'MANAGER' | 'ADMIN';

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: Role;
  customerId?: string | null;
  employeeId?: string | null;
  branchIds?: string[];
}

export interface OrderSummary {
  id: string;
  bookingCode: string;
  status: string;
  totalAmount: string | number;
  currency: string;
  placedAt: string;
  customer: {
    user: {
      firstName: string;
      lastName: string | null;
      email: string;
      phone: string | null;
    };
  };
  branch: { name: string; code: string } | null;
  _count: { items: number };
}

export interface OrderDetail extends OrderSummary {
  customerNotes: string | null;
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  pickupAddress: Record<string, unknown>;
  returnAddress: Record<string, unknown> | null;
  items: Array<{
    id: string;
    serviceName: string;
    shoeCategory: string;
    shoeBrand: string | null;
    quantity: number;
    totalPrice: string | number;
    washingTask?: {
      id: string;
      status: string;
      operator?: { user: { firstName: string; lastName: string | null } } | null;
    } | null;
  }>;
  deliveries: Array<{
    id: string;
    type: string;
    status: string;
    employee?: { user: { firstName: string; lastName: string | null } } | null;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    note: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    amount: string | number;
    method: string;
    status: string;
    createdAt: string;
  }>;
}

export interface DashboardMetrics {
  orderCounts: Record<string, number>;
  todayOrders: number;
  activePickups: number;
  activeReturns: number;
  washingCounts: Record<string, number>;
  overdueTasks: number;
  collectedRevenue: number;
  completedPayments: number;
  failedDeliveries: number;
  generatedAt: string;
}

export interface Page<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface WashingTask {
  id: string;
  status: string;
  instructions: string | null;
  createdAt: string;
  order: {
    id: string;
    bookingCode: string;
    status: string;
    customer: { user: { firstName: string; lastName: string | null } };
  };
  orderItem: {
    serviceName: string;
    shoeCategory: string;
    shoeBrand: string | null;
    shoeColor: string | null;
  };
  operator?: {
    user: { firstName: string; lastName: string | null };
  } | null;
}

export interface Delivery {
  id: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  order: {
    bookingCode: string;
    status: string;
    customer: { user: { firstName: string; lastName: string | null } };
  };
  employee?: { user: { firstName: string; lastName: string | null } } | null;
  address?: Record<string, unknown> | null;
}

export interface PaymentRecord {
  id: string;
  amount: string | number;
  currency: string;
  method: string;
  status: string;
  transactionReference: string | null;
  createdAt: string;
  paidAt: string | null;
  order: {
    bookingCode: string;
    status: string;
    customer: { user: { firstName: string; lastName: string | null } };
  };
}
