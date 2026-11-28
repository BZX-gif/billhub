# VoiceBill

**Speak. Review. Bill.** A voice-first billing app for Indian kirana shops.

Say “3 kilo chini aur 2 kilo aata”, check the matched lines and prices, then print or save the receipt. Everything
runs in the browser: no account, no server, no API key, and no voice recording ever leaves the device.

## What it does

- **Dashboard** — greeting with the shop name, a large New Bill action, today's sales, today's bill count, items sold,
  recent bills (tap to reopen the receipt) and shortcuts.
- **New Bill** — a big microphone as the main control, Hindi/English recognition, live interim text, a “reading your
  items” state, multiple sentences per bill, a typed fallback, quick-add chips, per-line quantity/unit/price editing,
  optional discount, live totals and a review dialog before saving.
- **Products** — full CRUD for name, price, unit (kg, gram, litre, ml, piece, packet, dozen) and spoken aliases.
  Search by product or alias, edit prices, delete, and load or remove the clearly-labelled sample catalogue.
- **Bill History** — search by bill number, customer or item, All / Today / 7 days / custom date filters, totals per
  day, receipt preview, reprint, and delete with confirmation.
- **Settings** — shop name/address/phone (snapshotted onto each bill), currency symbol, default receipt width,
  recognition language, thank-you message, auto-add behaviour, JSON export/import backup, sample management and a
  full data reset.
- **Receipts** — a real receipt for 58 mm, 80 mm thermal paper and A4 (A4 uses a full invoice layout), with bill
  number, date/time, items, quantity, unit price, line totals, subtotal, discount, final amount and thank-you message.
  Printing uses the browser print dialog; “Save as PDF” is the same dialog with the PDF destination, so there is no
  fake PDF button.

## Tech

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 with a warm off-white / charcoal / deep-green design system, Inter + Fraunces + Noto Sans Devanagari
  bundled locally
- Browser Web Speech API (feature-detected) for recognition
- `localStorage` for products, bills, settings and the in-progress draft
- Print CSS with real `@page` sizes for 58 mm, 80 mm and A4
- Vitest + Testing Library + jsdom for the test suite

No paid AI service, no backend, no database, no authentication, no secret keys.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

First run opens `/setup`, where you add the shop name and can opt into 18 sample products. Samples are marked
`SAMPLE`, never overwrite real products, and can be removed from Settings at any time.

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src tests --max-warnings=0
npm run test       # vitest run
npm run build      # production build
npm run verify     # all of the above, in order
```

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) and keep the detected Next.js settings.
3. Deploy. No environment variables, database or external services are required.

`npm run build` produces seven static routes. Any static host that runs Next.js works too.

## How voice billing works

1. **Recognition** — `useSpeechRecognition` wraps `SpeechRecognition` / `webkitSpeechRecognition` as one *always-on
   session*. Silence, `no-speech`, network blips and browser-side stops no longer end it: the hook reconnects
   itself (180 ms after a pause, backing off 0.7 s → 4 s for real trouble), so a shopkeeper who stops to think and
   then carries on never loses the mic. Only unrecoverable errors (microphone blocked/absent, unsupported language)
   stop the session, and those show a clear message. Only final results reach the app — interim words are used
   solely to know that someone is still talking. Duplicate finals, including the tail a restarted session re-hears
   ("…2 kilo aata" → "aata"), are dropped. Pauses are ignored rather than turned into errors.
2. **Parsing** — `src/lib/parser.ts` splits a sentence on “aur / and / ,”, extracts spoken numbers (including “dedh”,
   “dhai”, “sava”), units and Hindi/English number words, strips filler and interjections, and merges duplicate
   mentions. Hums and interjections (“huh”, “hmm”, “uh”) never become phantom products: they keep the mic open and
   nothing is added until a real product is spoken. Consecutive chunks are stitched into one running list
   (`src/lib/speechText.ts`), so “3 kilo chini” … pause … “aur 2 kilo aata” is parsed as one sentence instead of two
   guesses. A settle timer (~1 s after the last heard word) decides when the list is finished, and pressing
   “Done — save this list” commits it immediately. Saying “clear” resets only the pending words, never the bill.
3. **Matching** — `src/lib/matching.ts` scores the query against product names and aliases with normalisation
   (Devanagari, common Hinglish spellings, plurals). A match must clear a decisive margin; close calls become
   “Confirm” lines and unknown words become “No match” lines. A literal name or registered alias is always accepted
   first; a fuzzy single word needs strong similarity *and* a clear winner, so a stray word can never be guessed into
   a product. Filler words and non-word sounds (“huu”, “hmm”, “haan”, “achha”, “ji”, “no”, “okay”, plus their
   Devanagari forms — see `src/lib/noise.ts`) are dropped unless they are part of a catalogue name (a shop product
   called “No Sugar Sweetener” still matches). A measurement plus a hum (“3 kg huu”) never creates a line, and an
   utterance with nothing recognisable leaves the draft untouched and says “No recognizable grocery product found.”
4. **Resolution** — unresolved lines must be pointed at a catalogue product or given a one-off custom price before the
   bill can be reviewed. Prices always come from the catalogue or explicit input, never guessed.
5. **Billing** — `src/lib/billing.ts` validates every line, computes line amounts, subtotal, percentage/amount
   discount and a 2-decimal total, and creates the immutable bill with a shop snapshot and a unique `VB-0001` number.
6. **Persistence** — each slice (products, bills, settings, draft) is stored separately so a corrupt slice can never
   destroy the others. The draft survives refreshes and is cleared only after a bill is saved.

### Speech reliability notes

- The Web Speech API is provided by the browser; Chrome/Android Chrome give the best Hindi results. Firefox and some
  in-app webviews do not support it, and the app falls back to typing with a clear explanation.
- Hinglish recognition is genuinely unreliable at the browser level. VoiceBill mitigates it with two recognition
  languages, Hindi aliases on products, aggressive normalisation and a review step — but it does not claim perfect
  Hinglish accuracy. Nothing is saved until the shopkeeper confirms.
- Recognition runs through the browser vendor's service and may need an internet connection. Audio is not uploaded,
  stored or sent anywhere by VoiceBill itself.

## Printing

| Paper | Screen preview | Print setup |
| --- | --- | --- |
| 58 mm | 58 mm receipt | `@page { size: 58mm auto; margin: 2mm }` |
| 80 mm | 80 mm receipt | `@page { size: 80mm auto; margin: 2mm }` |
| A4 | 210 mm invoice | `@page { size: A4; margin: 12mm }` |

Print output contains only the receipt: the app shell, mobile navigation, buttons and dialog chrome are excluded with
print CSS. For thermal printers choose the printer's paper size, margins “None”/“Minimum” and scale 100%.

## Privacy and storage

- Products, bills, settings and the draft live in this browser's `localStorage` only.
- No account, analytics, API keys or backend calls.
- Clearing browser data deletes everything, and private windows do not persist. `localStorage` is usually capped
  around 5 MB (thousands of bills); Settings shows an estimate and offers JSON export/import for backups or moving
  devices.
- Receipts reprint with the shop details saved at billing time, even if settings change later.

## Project layout

```
src/app/            routes: dashboard, new-bill, products, history, settings, setup
src/components/     app shell, receipt, bill and product components, UI primitives
src/hooks/          speech recognition wrapper
src/lib/            parser, matching, resolution, billing, storage, backup, formatting, sample data
src/store/          AppProvider (state, validation, persistence, backups)
tests/              88 unit and component tests
```

## Testing

The suite covers product CRUD and validation, alias/Hindi/Hinglish/English parsing, multi-product sentences, unit
conversion, decimals, unknown products, missing prices, totals, discounts, unique bill numbers, persistence and
corrupt storage, receipt content, 58 mm/A4 layouts, `@page` rules, print isolation and title handling, Save-as-PDF
messaging, mic denial, unsupported speech, duplicate recognition events, draft restore and backup round-trips.

```bash
npm run verify   # typecheck + lint + 88 tests + production build
```

## Known limitations

- Voice accuracy is bounded by the browser's speech engine, especially for mixed Hindi/English sentences.
- Everything is single-device: no staff accounts, multi-device sync, GST invoices or inventory counts.
- A4 printing renders the invoice at the top of the sheet rather than stretching it over the full page.
- The browser print dialog controls the final paper size; PDF output is produced by the browser, not the app.
- Amounts use Indian digit grouping and the configured currency symbol; there is no multi-currency conversion.
