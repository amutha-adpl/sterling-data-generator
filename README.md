# sterling-data-generator

Sample data generator for **IBM Sterling Order Management** APIs.

It builds realistic API payloads (currently `createOrder`) that you can preview in the browser
as **XML or JSON** and download for use in the Sterling API Tester, Postman, or your own
integration tests.

> **This tool never connects to an OMS instance.** It only generates payloads. There is no
> endpoint that submits data to Sterling, so it is safe to run against production configuration
> values.

---

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

Other scripts:

| Command            | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Start with reload on file change                    |
| `npm test`         | Run the test suite (Vitest)                         |
| `npm run typecheck`| TypeScript strict check, no emit                    |
| `npm run build`    | Compile to `dist/` (then `npm run serve`)           |

Requires Node.js 20+. The server binds to `0.0.0.0`; override with `PORT` / `HOST`.

---

## Testing

Four levels, cheapest first. You rarely need level 4 until you point the payload at a real
Sterling instance.

### 1. Automated checks (run these on every change)

```bash
npm test           # 19 Vitest tests
npm run typecheck  # strict TypeScript, no emit
```

| Suite                      | What it locks down                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `tests/createOrder.test.ts`| Option defaults and range normalisation; XML well-formedness; **determinism** (same seed = identical output, different seed = different data); sequential order numbers; line counts; optional blocks on/off; **totals arithmetic** (line, header and grand totals all reconcile); JSON structure |
| `tests/xml.test.ts`         | Renderer behaviour: self-closing tags, escaping of all five XML entities, repeated siblings, `@`-prefixed attributes in JSON, single object vs array for bundles |

If you add a generator or change the money logic, add a test next to it — the totals test is the
one that catches real regressions.

### 2. Manual check in the UI

```bash
npm start          # http://localhost:3000
```

Quick sanity pass:

- Set **Random seed** to `1`, note the output, set it to `2` → data changes. Set it back to `1` →
  output is identical again (this is the reproducibility guarantee).
- Toggle **XML / JSON** → both show the same data with the same totals.
- Untick **Include taxes** → `<LineTaxes>`/`<HeaderTaxes>` disappear and `GrandTotal` drops by the
  tax amount.
- Set **Shipping charge** to `0` → `<HeaderCharges>` disappears.
- **Download this order**, open the file in an editor, confirm `GrandTotal = SubTotal + GrandTax`.
- Set **Orders to generate** to `500` → still fast (generation is a few ms).

### 3. Test the API without the UI

```bash
curl -s localhost:3000/api/health
curl -s localhost:3000/api/generators

curl -s -X POST localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"generatorId":"createOrder","options":{"count":1,"seed":42}}'

# Validation path - must return 400 with the failing field
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"generatorId":"createOrder","options":{"orderDate":"09/04/2026"}}'
```

Pipe a payload through any XML parser to prove it is well formed:

```bash
curl -s -X POST localhost:3000/api/generate -H 'Content-Type: application/json' \
  -d '{"generatorId":"createOrder","options":{"count":1}}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['documents'][0]['xml'])" \
  | python3 -c "import sys,xml.dom.minidom; xml.dom.minidom.parseString(sys.stdin.read()); print('XML OK')"
```

### 4. Test against your own Sterling instance

The tool never posts to OMS, so this step is yours — and it is the only one that proves the
payload is *valid for your configuration*.

1. **Sterling API Tester** — usually `http://<host>:<port>/smcfs/console/apitester.jsp`, or
   Tools → API Tester in the console. Paste the downloaded XML as the input for `createOrder` and
   run it.
2. **REST invoke** (if `xapirest` is enabled):

   ```bash
   # 1. login
   curl -X POST 'http://<host>:<port>/smcfs/restapi/invoke/login' \
     -H 'Content-Type: application/json' -d '{"LoginID":"admin","Password":"<pwd>"}'

   # 2. call the API with the token from step 1
   curl -X POST 'http://<host>:<port>/smcfs/restapi/invoke/createOrder?_token=<token>' \
     -H 'Content-Type: application/xml' --data-binary @ORD0000001.xml
   ```

   Use a **dev or sandbox instance only**.

**Expect these first failures on a fresh implementation** — they are configuration, not code:

| Symptom                        | Cause / fix                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Item not found                 | `ItemID` is not in your item master — replace `catalog.ts` with your real items   |
| Invalid / unknown ship node    | `ShipNode` is not configured for your enterprise — set your real nodes in the form|
| Invalid document type          | `DocumentType` not configured — check your document-type setup                    |
| Pricing or tax errors          | Price list / tax setup missing for the enterprise or item                          |
| Mandatory attribute missing    | Your implementation requires extra attributes — extend `build.ts` and add a test   |

Once one order posts successfully, bump **Orders to generate** and load-test your pipeline.

To create, schedule and release in a single call, wrap the generated `<Order>` in a `multiApi`
document (`<MultiApi><API Name="createOrder">…` then `scheduleOrder`, `releaseOrder`).

---

## Using the UI

1. Pick the API (today: `createOrder`).
2. Adjust the options on the left — the preview regenerates as you type.
3. Toggle **XML / JSON** above the preview.
4. **Copy**, **Download this order**, or **Download all** (bundle of every generated order).

Two things make runs repeatable and safe:

- **Seeded randomness** — the same seed and options always produce byte-identical payloads.
- **Synthetic data** — names and addresses come from Faker, email addresses use the reserved
  `example.com` domain, and card numbers are random Luhn-valid numbers that belong to no one.

### Output conventions

**XML** is the classic Sterling API input document, e.g.:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Order EnterpriseCode="DEFAULT" DocumentType="0001" OrderNo="ORD0000001" ...>
  <PriceInfo Currency="USD" />
  <OrderLines>
    <OrderLine PrimeLineNo="1" SubLineNo="1" OrderedQty="1.00" DeliveryMethod="SHP" ShipNode="DC001">
      <Item ItemID="SKU-1005" ItemDesc="Noise Cancelling Headset" ProductClass="GOOD" UnitOfMeasure="EACH" />
      <LinePriceInfo IsPriceLocked="N" ListPrice="208.48" RetailPrice="208.48" UnitPrice="208.48" />
      <LineTaxes>
        <LineTax ChargeCategory="SalesTax" ChargeName="State" Tax="17.20" TaxPercentage="8.25" TaxableFlag="Y" />
      </LineTaxes>
      <OrderLineTranQuantity OrderedQty="1.00" TransactionalUOM="EACH" />
      <LineOverallTotals ExtendedPrice="208.48" LineTotal="225.68" OrderedQty="1.00" />
    </OrderLine>
  </OrderLines>
  <PersonInfoBillTo ... />
  <PersonInfoShipTo ... />
  <HeaderCharges>...</HeaderCharges>
  <HeaderTaxes>...</HeaderTaxes>
  <OverallTotals ... />
  <PaymentMethods>...</PaymentMethods>
</Order>
```

**JSON** is the same tree with a simple, documented mapping:

- attributes are prefixed with `@`
- child elements become object keys
- repeated siblings collapse into an array

```json
{
  "Order": {
    "@EnterpriseCode": "DEFAULT",
    "@OrderNo": "ORD0000001",
    "OrderLines": {
      "OrderLine": [{ "@PrimeLineNo": "1", "Item": { "@ItemID": "SKU-1005" } }]
    }
  }
}
```

Downloading **one** order gives you the bare `<Order>` document. Downloading **all** orders
wraps them in `<Orders ApiName="createOrder" Count="5" GeneratedAt="...">` (XML) or a JSON
array — a convenience bundle, not a Sterling API input.

### Money

All amounts are computed in integer cents and rendered with two decimals, so the payload is
internally consistent:

```
ExtendedPrice = UnitPrice x OrderedQty
LineTotal     = ExtendedPrice + line tax
SubTotal      = LineSubTotal + header charges
GrandTotal    = SubTotal + GrandTax
```

---

## Project structure

```
src/
  index.ts                     Express bootstrap: static UI + /api routes
  config.ts                    PORT / HOST
  core/
    xml.ts                     XmlNode tree model + XML renderer (escaping, indentation)
    json.ts                    JSON renderer (Badgerfish-style @attributes)
    money.ts                   Integer-cent arithmetic
    rng.ts                     Seeded Faker factory + helpers
  generators/
    types.ts                   GeneratorDefinition contract + field specs
    registry.ts                Id -> generator lookup
    createOrder/               <-- one folder per API
      index.ts                 Generator definition (id, fields, defaults, generate())
      options.ts               Zod schema + UI field metadata (single source of truth)
      build.ts                 Order document builder
      catalog.ts               Sample item master (ItemID / UOM / ProductClass)
  http/api.ts                  GET /api/generators, POST /api/generate
public/                        Static UI (index.html, styles.css, app.js) - no build step
tests/                         Vitest suites
```

### How a generation run flows

```
POST /api/generate
  -> registry lookup
  -> Zod validates + normalises the options
  -> generator builds XmlNode trees with a seeded Faker
  -> renderers produce XML and JSON strings from the same tree
  -> { documents: [{ key, label, xml, json }], bundle, meta }
```

Because both formats come from one tree, the XML and JSON previews can never disagree.

---

## Adding the next API

Everything is data-driven: the form, validation and preview come from the generator definition,
so a new API means **one new folder and one registration line** — no UI changes.

1. Create `src/generators/getOrderList/` (for example) with:
   - `options.ts` — a Zod schema with defaults, plus a `FIELDS` array describing the form
     (`kind: 'text' | 'number' | 'select' | 'boolean'`, `group`, `help`).
   - `build.ts` — builds `XmlNode` trees.
   - `index.ts` — a `GeneratorDefinition`:

     ```ts
     export const getOrderListGenerator: GeneratorDefinition<GetOrderListOptions> = {
       id: 'getOrderList',
       label: 'getOrderList',
       apiName: 'getOrderList',
       description: '...',
       formats: ['xml', 'json'],
       fields: FIELDS,
       defaults: DEFAULTS,
       schema: getOrderListOptionsSchema,
       generate(options) { /* ... */ },
     };
     ```

2. Register it in `src/index.ts`:

   ```ts
   registerGenerator(createOrderGenerator);
   registerGenerator(getOrderListGenerator);
   ```

3. Add tests under `tests/`.

The UI picks it up automatically: the API dropdown, the option form, the format toggle and the
download buttons are all generated from the metadata returned by `GET /api/generators`.

---

## HTTP API

| Method | Path              | Body / response                                                                 |
| ------ | ----------------- | ------------------------------------------------------------------------------- |
| GET    | `/api/health`     | `{ "status": "ok" }`                                                             |
| GET    | `/api/generators` | `{ generators: [{ id, label, apiName, description, formats, fields, defaults }] }`|
| POST   | `/api/generate`   | `{ generatorId, options }` -> `{ documents: [...], bundle, meta }`               |

Validation errors return `400` with the failing field:

```bash
curl -s localhost:3000/api/generate -X POST -H 'Content-Type: application/json' \
  -d '{"generatorId":"createOrder","options":{"orderDate":"09/04/2026"}}'
# {"error":{"message":"Invalid options.","issues":[{"path":"orderDate","message":"Use ISO format: YYYY-MM-DD"}]}}
```

---

## createOrder options

| Group             | Option                                                      | Default           |
| ----------------- | ----------------------------------------------------------- | ----------------- |
| Batch             | `count`, `seed`                                               | `5`, `42`         |
| Order header      | `enterpriseCode`, `sellerOrganizationCode`                    | `DEFAULT`         |
|                   | `documentType` (`0001` sales, `0003` return, `0005` purchase, `0006` transfer) | `0001` |
|                   | `entryType`, `orderType`, `orderNoPrefix`, `orderDate`        | `WEB`, `ORD`      |
|                   | `currency`, `paymentStatus`                                   | `USD`, `NOT_AUTHORIZED` |
| Lines & pricing   | `minLines` / `maxLines`, `minQty` / `maxQty`                  | `1`/`3`, `1`/`2`  |
|                   | `minUnitPrice` / `maxUnitPrice`, `taxRatePct`, `shippingCharge`| `25`/`250`, `8.25`, `9.99` |
|                   | `shipNodes` (comma separated)                                 | `DC001,STORE-1001`|
| Optional blocks   | `includeTaxes`, `includePaymentMethod`, `includeLineShipTo`, `includeExtn` | on / on / off / off |

Reversed ranges (`minLines` > `maxLines`) are swapped rather than rejected, so a slip in the form
still produces usable data.

---

## Notes and limitations

- **Item master**: `src/generators/createOrder/catalog.ts` ships a generic 24-item catalog.
  Replace it with items that exist in your instance — otherwise `createOrder` rejects the line
  with an item-not-found error.
- **Addresses** are US-based (Faker's `en_US` pool). Non-US address formats are not generated yet.
- **Document types** use IBM's default values; adjust if your implementation defines its own.
- **Customer IDs** (`BillToID`, `CustomerID`) are intentionally omitted: they must reference
  existing customer records. The generator supplies `PersonInfoBillTo` / `PersonInfoShipTo`
  instead, which Sterling accepts for ad-hoc customers.
- Payment status defaults to `NOT_AUTHORIZED` so generated orders do not claim an authorisation
  that never happened.

## Roadmap

- More APIs: `getOrderList`, `scheduleOrder`, `releaseOrder`, `confirmShipment`, `createReturnOrder`
- REST/JSON payload flavour (`POST /v1/orders`) alongside the classic XML API
- Custom item catalog upload (CSV) and customer pools
- Non-US address formats
- Optional CLI (`npm run generate -- --count 50 --out orders.xml`)

## License

MIT
