# PrintMaster – Full Upgrade Changelog

## 🆕 New Files Created

| File | Purpose |
|---|---|
| `App.tsx` | Fully rewritten navigation, new tabs, new screens |
| `src/screens/GstSuiteScreen.tsx` | **New tab** – Hub for all GST modules |
| `src/screens/EInvoiceScreen.tsx` | E-Invoice with IRN generation (IRP-ready) |
| `src/screens/EWayBillScreen.tsx` | E-Way Bill generate & manage |
| `src/screens/GstFilingScreen.tsx` | Auto GSTR-1 & GSTR-3B from your bills |
| `src/screens/PaymentReminderScreen.tsx` | WhatsApp/SMS reminders for unpaid bills |
| `src/screens/ChatScreen.tsx` | Real-time team chat (Supabase Realtime) |
| `src/screens/NotificationsScreen.tsx` | Notification center with read/unread |
| `supabase_schema_additions.sql` | New DB tables for chat & notifications |

---

## 🔄 App.tsx Changes

### Navigation Structure (was 5 tabs → 5 tabs, redesigned)
```
BEFORE:  Dashboard | Parties | Items | Task | More
AFTER:   Dashboard | Parties | [+FAB] | GST Suite | More
```

- **FAB (center button)** now opens a **grouped Quick-Action sheet** with 4 groups:
  - **Billing**: New Bill, E-Invoice, E-Way Bill, Record Payment  
  - **GST & Tax**: GST Filing, GST Finder  
  - **Parties & Items**: Add Party, Add Item  
  - **Work**: New Task, New Job, Set Reminder

- **GST Suite tab** replaces the old "Items" tab position – all GST/compliance tools in one place.

- Stack navigator now registers:
  `EInvoice`, `EWayBill`, `GstFiling`, `PaymentReminder`, `Chat`, `Notifications`, `Items`, `Task`

### FAB Improvements
- Smooth `translateY` sheet animation (was a snap)
- Icon toggles `add` → `close` when sheet is open
- Grouped action cards (4-column grid per group)
- Color-coded groups with colored icon backgrounds
- Drag handle pill on sheet

---

## 📱 Feature: E-Invoice (`EInvoiceScreen`)
- Lists all **GST-enabled bills** from Supabase
- **Generate IRN button** per bill (stub ready for NIC/GSP API)
- Status chip: "Generate" → loading → "✓ IRN Ready"
- Info banner explaining e-invoice requirements
- Search by party name
- Blue gradient header

---

## 🚛 Feature: E-Way Bill (`EWayBillScreen`)
- **Two tabs**: My E-Way Bills list + Generate New
- Generate form with: Invoice No, Party, Value, HSN, Vehicle, Transporter, PIN codes
- Active EWBs show validity date + Active badge
- Purple gradient header

---

## 📊 Feature: GST Filing (`GstFilingScreen`)
- **Period selector** (last 3 months with filed/pending indicators)
- **GSTR-1 / GSTR-3B toggle**
- Auto-computes from Supabase bills:
  - Taxable value, CGST, SGST, IGST, Total GST
  - ITC (placeholder 30%), Net Payable
  - B2B / B2C invoice count
- "File on GST Portal" CTA (deep-link to GST portal)
- "Download JSON / Excel" button
- Compliance checklist section in GST Suite

---

## 🔔 Feature: Payment Reminders (`PaymentReminderScreen`)
- Loads all **unpaid bills** (paid=false) from Supabase
- **Overdue badge** with days calculation (overdue / due today / N days left)
- Per-bill: **WhatsApp** + **SMS** reminder drafts
- Auto-reminder toggle per bill
- **Global auto-reminder** switch (daily 10 AM)
- Summary banner: Total unpaid count, overdue count, total amount
- Red gradient header

---

## 💬 Feature: Chat (`ChatScreen`)
- **4 chat rooms**: General, Billing Team, Production, Delivery
- **Supabase Realtime** subscription for live messages
- Bubble UI (sent right/blue, received left/card)
- Avatar initials for other senders
- Attach button (ready for file sharing)
- Keyboard-avoiding view (iOS + Android)
- Optimistic message insert (no lag on send)

**Requires** running `supabase_schema_additions.sql` to create `chat_messages` table.

---

## 🔔 Feature: Notifications (`NotificationsScreen`)
- Types: `payment`, `reminder`, `gst`, `system`, `bill`
- Color-coded icon per type
- **Unread indicator** (blue left border + colored dot)
- **"Mark all read"** button
- Filter: All / Unread tabs
- Tapping a notification marks it read

---

## 🗄️ Database Additions (`supabase_schema_additions.sql`)
```sql
-- New tables:
chat_rooms        -- Room definitions
chat_messages     -- All chat messages with realtime
notifications     -- Push/in-app notification log

-- New columns on bills:
irn          TEXT    -- Invoice Reference Number (e-invoice)
irn_status   TEXT    -- pending | generated | cancelled
ewb_no       TEXT    -- E-Way Bill number  
ewb_status   TEXT    -- none | active | expired | cancelled
```

---

## 🎨 UI Improvements Summary
| Area | Before | After |
|---|---|---|
| Quick Actions | 6 flat buttons | 4 color-coded groups, 4-column grid |
| Bottom tabs | Home/Parties/Items/Task/More | Home/Parties/FAB/GSTSuite/More |
| Sheet animation | Simple slide | Smooth cubic bezier + drag handle |
| Headers | Varied | Gradient headers per feature color |
| Cards | Basic | Shadow, border-left accent, colored icons |
| Empty states | None | Illustrated with icon + message |

---

## ⚙️ Setup Steps
1. Copy all files to your project root / `src/screens/`
2. Run `supabase_schema_additions.sql` in Supabase SQL Editor
3. In Supabase dashboard → Realtime → Enable on `chat_messages` table
4. The chat screen connects automatically via your existing Supabase config

## 🔌 Connecting Real APIs (future)
- **IRN/E-Invoice**: Replace `generateIRN()` stub with NIC IRP API or GSP (GSTN-authorised)
- **E-Way Bill**: Replace stub with NIC EWB API
- **GST Portal filing**: Use `https://api.gst.gov.in` with GSP credentials
- **WhatsApp reminders**: Use Twilio WhatsApp or Meta Cloud API with `item.phone`
- **Push notifications**: Add Expo Notifications + Firebase for scheduled reminders
