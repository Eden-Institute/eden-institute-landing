// supabase/functions/_shared/order-state.ts
//
// Order lifecycle state machine. The full graph exists since Phase 1 so Phase 2 adds
// ZERO enum changes; Phase 2 only adds two edges:
//   paid -> ready_to_fulfill        (in-stock checkout: product.is_preorder = false)
//   label_created -> ready_to_fulfill (label voided/refunded; order re-enters the queue)
// Messages bind to TRANSITIONS via the edge-keyed registry in order-messages.ts, never
// to a global flag.

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
  paid: ['preorder_hold', 'ready_to_fulfill', 'cancelled', 'refunded'],
  preorder_hold: ['ready_to_fulfill', 'cancelled', 'refunded'],
  ready_to_fulfill: ['label_created', 'cancelled', 'refunded'],
  label_created: ['shipped', 'ready_to_fulfill', 'cancelled', 'refunded'],
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
