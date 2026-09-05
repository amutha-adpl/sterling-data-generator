/**
 * Turn a Sterling error into something actionable.
 *
 * Sterling's messages describe what went wrong inside the OMS, not what to
 * change in the payload. These hints map the codes we have actually hit to the
 * fix on this side.
 */
import type { OmsApiError } from './api.js';

interface Hint {
  code: string;
  hint: string;
}

const HINTS: readonly Hint[] = [
  {
    code: 'YCP0427',
    hint: 'The session was not accepted. The app re-logs in and retries automatically; if it keeps failing, disconnect and log in again.',
  },
  {
    code: 'YCP0428',
    hint: 'API Security Violation: the payload contains an element that is not in the createOrder input template for your user group. Open "Show request" and compare it with that template - or connect with a login whose group has order permissions.',
  },
  {
    code: 'YCP0429',
    hint: 'Data security violation: your user group is not permitted to act on this data. Check the data security group configuration.',
  },
  {
    code: 'YFS10491',
    hint: 'Payment Type not set up for seller. Turn off "Include <PaymentMethods>" (it is off by default), or set a PaymentType that is configured for this SellerOrganizationCode.',
  },
  {
    code: 'YFS10011',
    hint: 'No Notification Type. The payload asks Sterling to notify on shipment but no notification type is configured. Remove NotifyAfterShipmentFlag or set it to N.',
  },
];

/** Advice for a known code, or undefined when we have nothing useful to add. */
export function hintFor(error: OmsApiError | undefined): string | undefined {
  if (!error) return undefined;
  const match = HINTS.find((entry) => entry.code === error.code);
  if (match) return match.hint;

  const text = `${error.code} ${error.description}`.toLowerCase();
  if (text.includes('not a valid item') || text.includes('invalid item')) {
    return 'The ItemID does not exist in this enterprise. Use an item ID from your catalogue.';
  }
  if (text.includes('customer')) {
    return 'The CustomerID or BillToID does not exist in this enterprise. Use a customer that is registered in the OMS.';
  }
  if (text.includes('node') || text.includes('shipnode')) {
    return 'The ShipNode or ReceivingNode does not exist. Use a node configured in this enterprise.';
  }
  if (text.includes('uom') || text.includes('unit of measure')) {
    return 'The UnitOfMeasure is not valid for this item. Check the item master.';
  }
  return undefined;
}