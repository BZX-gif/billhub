import { formatDate, formatTime } from "@/lib/format";
import { formatMoney, formatQuantity } from "@/lib/units";
import type { Bill, ReceiptWidth } from "@/lib/types";
import { cn } from "@/lib/cn";

export const RECEIPT_WIDTH_LABEL: Record<ReceiptWidth, string> = {
  "58mm": "58 mm thermal",
  "80mm": "80 mm thermal",
  a4: "A4 sheet",
};

/**
 * Pure receipt renderer used for both screen preview and printing.
 * Widths map to real paper sizes so the printed output is predictable.
 */
export function Receipt({
  bill,
  width = "80mm",
  className,
}: {
  bill: Bill;
  width?: ReceiptWidth;
  className?: string;
}) {
  const symbol = bill.shop.currencySymbol || "₹";
  const money = (value: number) => formatMoney(value, symbol);
  const isA4 = width === "a4";
  const paid = bill.total;
  const discountLabel =
    bill.discountType === "percent"
      ? `Discount (${formatQuantity(bill.discountValue)}%)`
      : "Discount";

  return (
    <article
      className={cn("receipt-sheet", className)}
      data-format={width}
      aria-label={`Receipt for bill ${bill.number}`}
    >
      {isA4 ? (
        <>
          <header className="flex items-start justify-between gap-8 border-b-2 border-[#1b6b4f] pb-5">
            <div className="min-w-0">
              <h1 className="text-[2em] font-semibold leading-tight">{bill.shop.shopName}</h1>
              {bill.shop.address ? (
                <p className="receipt-meta mt-1.5 max-w-[70mm] whitespace-pre-line">{bill.shop.address}</p>
              ) : null}
              {bill.shop.phone ? (
                <p className="receipt-meta mt-1">Phone: {bill.shop.phone}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-[#6b6457]">
                Invoice
              </p>
              <p className="mt-1 text-[1.25em] font-semibold">{bill.number}</p>
              <p className="receipt-meta mt-1">{formatDate(bill.createdAt)}</p>
              <p className="receipt-meta">{formatTime(bill.createdAt)}</p>
            </div>
          </header>

          <div className="mt-4 flex items-start justify-between gap-6">
            <div>
              <p className="text-[0.72em] font-semibold uppercase tracking-[0.18em] text-[#6b6457]">
                Billed to
              </p>
              <p className="mt-1 text-[1.05em] font-medium">{bill.customerName || "Walk-in customer"}</p>
            </div>
            <div className="text-right">
              <p className="text-[0.72em] font-semibold uppercase tracking-[0.18em] text-[#6b6457]">
                Items
              </p>
              <p className="mt-1 text-[1.05em] font-medium">{bill.itemCount}</p>
            </div>
          </div>

          <table className="receipt-a4-table mt-6">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item) => (
                <tr key={item.id}>
                  <td className="pr-4 font-medium">{item.name}</td>
                  <td className="whitespace-nowrap pl-4 text-right tabular-nums text-[#4b463c]">
                    {formatQuantity(item.quantity)} {item.unit}
                  </td>
                  <td className="whitespace-nowrap pl-4 text-right tabular-nums text-[#4b463c]">
                    {money(item.unitPrice)}
                  </td>
                  <td className="whitespace-nowrap pl-4 text-right font-semibold tabular-nums">
                    {money(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-[78mm] space-y-2">
              <div className="flex justify-between text-[0.95em] text-[#4b463c]">
                <span>Subtotal</span>
                <span className="tabular-nums">{money(bill.subtotal)}</span>
              </div>
              {bill.discountAmount > 0 ? (
                <div className="flex justify-between text-[0.95em] text-[#4b463c]">
                  <span>{discountLabel}</span>
                  <span className="tabular-nums">− {money(bill.discountAmount)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex items-end justify-between border-t border-[#dcd6c9] pt-3">
                <span className="text-[0.85em] font-semibold uppercase tracking-[0.16em] text-[#6b6457]">
                  Total payable
                </span>
                <span className="receipt-total font-semibold">{money(paid)}</span>
              </div>
            </div>
          </div>

          <footer className="mt-10 border-t border-[#e4dfd4] pt-5 text-center">
            <p className="font-medium">{bill.thankYouMessage}</p>
            <p className="mt-3 text-[0.72em] uppercase tracking-[0.18em] text-[#9a9384]">
              Powered by VoiceBill
            </p>
          </footer>
        </>
      ) : (
        <>
          <header className="text-center">
            <h1 className="text-[1.75em] font-semibold leading-tight">{bill.shop.shopName}</h1>
            {bill.shop.address ? (
              <p className="receipt-meta mt-0.5 whitespace-pre-line">{bill.shop.address}</p>
            ) : null}
            {bill.shop.phone ? <p className="receipt-meta">Ph: {bill.shop.phone}</p> : null}
          </header>

          <div className="receipt-rule" />

          <div className="receipt-meta space-y-0.5">
            <div className="flex justify-between gap-3">
              <span>Bill no.</span>
              <span className="font-semibold text-[#16130e]">{bill.number}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Date</span>
              <span className="text-right">
                {formatDate(bill.createdAt)} · {formatTime(bill.createdAt)}
              </span>
            </div>
            {bill.customerName ? (
              <div className="flex justify-between gap-3">
                <span>Customer</span>
                <span className="text-right font-medium text-[#16130e]">{bill.customerName}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <span>Items</span>
              <span>{bill.itemCount}</span>
            </div>
          </div>

          <div className="receipt-rule" />

          <ul>
            {bill.items.map((item) => (
              <li key={item.id} className="py-[1.6mm]">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold leading-snug">{item.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(item.amount)}</span>
                </div>
                <div className="receipt-meta mt-0.5 tabular-nums">
                  {formatQuantity(item.quantity)} {item.unit} × {money(item.unitPrice)}
                </div>
              </li>
            ))}
          </ul>

          <div className="receipt-rule" />

          <div className="space-y-[1mm]">
            <div className="flex justify-between receipt-meta">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(bill.subtotal)}</span>
            </div>
            {bill.discountAmount > 0 ? (
              <div className="flex justify-between receipt-meta">
                <span>{discountLabel}</span>
                <span className="tabular-nums">− {money(bill.discountAmount)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-[2mm] flex items-end justify-between gap-2 border-t border-[#16130e] pt-[2mm]">
            <span className="text-[0.95em] font-bold uppercase tracking-[0.08em]">Total</span>
            <span className="receipt-total font-semibold tabular-nums">{money(paid)}</span>
          </div>

          <div className="receipt-rule" />

          <p className="text-center font-medium leading-snug">{bill.thankYouMessage}</p>
          <p className="mt-[2mm] text-center text-[0.78em] uppercase tracking-[0.14em] text-[#9a9384]">
            Powered by VoiceBill
          </p>
        </>
      )}
    </article>
  );
}
