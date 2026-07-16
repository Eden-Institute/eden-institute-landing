// supabase/functions/_shared/order-state.ts
//
// Order lifecycle state machine. The full graph exists now so Phase 2 adds zero schema
// changes; Phase 1 only drives paid -> preorder_hold (+ the cancelled/refunded terminals).
// Messages bind to TRANSITIONS via the registry in order-messages.ts, never to a global flag.

export type OrderStatus =
  | 'paid'
  | 'preorder_hold'
  | 'ready_to_fulfill'
  | 'label_created'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

// Allowed edges. cancelled/refunded are reachable from any non-terminal state.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  paid: ['preorder_hold', 'cancelled', 'refunded'],
  preorder_hold: ['ready_to_fulfill', 'cancelled', 'refunded'],
  ready_to_fulfill: ['label_created', 'cancelled', 'refunded'],
  label_created: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const TERMINAL: OrderStatus[] = ['cancelled', 'refunded'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(s: OrderStatus): boolean {
  return TERMINAL.includes(s);
}
