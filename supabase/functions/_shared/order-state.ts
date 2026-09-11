// supabase/functions/_shared/order-state.ts
//
// Order lifecycle state machine. The full graph exists now so Phase 2 adds zero schema
// changes; Phase 1 only drives paid -> preorder_hold (+ the cancelled/refunded terminals).
// Messages bind to TRANSITIONS via the registry in order-messages.ts, never to a global flag.
//
// in_production (2026-09-10, Lulu print-on-demand): the order has been handed to the
// printer, who prints, packs and ships it. Distinct from label_created because no label
// of OURS exists; the dashboard would otherwise say "label created" about an order with
// no label. Enum value added by migration 20260911000000.

export type OrderStatus =
  | 'paid'
  | 'preorder_hold'
  | 'ready_to_fulfill'
  | 'label_created'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

// Allowed edges. cancelled/refunded are reachable from any non-terminal state.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // paid -> ready_to_fulfill is the retail / print-on-demand edge (an in-stock or
  // Lulu order skips the preorder hold). It was missing on the first production
  // order, ET-1026 on 2026-09-11: the order recorded, the transition was silently
  // ignored, no confirmation went out and the Lulu job refused the order.
  paid: ['preorder_hold', 'ready_to_fulfill', 'cancelled', 'refunded'],
  preorder_hold: ['ready_to_fulfill', 'cancelled', 'refunded'],
  ready_to_fulfill: ['label_created', 'in_production', 'cancelled', 'refunded'],
  label_created: ['shipped', 'cancelled', 'refunded'],
  in_production: ['shipped', 'cancelled', 'refunded'],
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
