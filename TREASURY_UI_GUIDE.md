# 🎨 Gold & Treasury - Visual UI Guide

## 🏠 Main Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  The Copper Shores    [Home] [Treasury] [Map] [Players]  │
│                          [Notes]                          │
└─────────────────────────────────────────────────────────┘

           💰 Party Treasury
        Manage loot and track spending

┌──────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Total Party │  │   Total      │  │ Spent This   │    │
│  │    Vault     │  │  Individual  │  │   Session    │    │
│  │              │  │    Funds     │  │              │    │
│  │   450 gp     │  │   850 gp     │  │    125 gp    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────────────────────────────────────────┘

[💳 Wallets] [🎁 Loot Log] [💸 Spending] [⚙️ Settings]

```

---

## 💳 Wallets Tab

```
┌──────────────────────────────────────────────────────────┐
│ 💳 Account Balances        [➕ Add Loot] [💸 Spending]    │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  🏰 Party & Special Funds                                 │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  Party Vault     │  │  Patron Fund     │             │
│  │   450 gp         │  │    0 gp          │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                            │
│  👥 Character Accounts                                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Player A — Barbarian                      125 gp    │ │
│  │ Player B — Rogue                          175 gp    │ │
│  │ Player C — Cleric                         150 gp    │ │
│  │ Player D — Wizard                         100 gp    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## 🎁 Loot Log Tab

```
┌──────────────────────────────────────────────────────────┐
│ 🎁 Loot Log                        [➕ Add Loot]          │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Date      | Description         | Category  | Amount     │
│  ─────────────────────────────────────────────────────   │
│  2/17/26   | Dragon hoard        | Treasure  | 500 gp     │
│  2/17/26   | Quest reward        | Quest     | 200 gp     │
│  2/10/26   | Vendor goods sold   | Vendor    | 75 gp      │
│                                                            │
│  Main Recipients:        Session:  Actions:              │
│  Party: 250 | Players: 250  S12     [Delete]             │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## 💸 Spending Log Tab

```
┌──────────────────────────────────────────────────────────┐
│ 💸 Spending Log               [💸 Record Spending]        │
├──────────────────────────────────────────────────────────┤
│                                                            │
│ Filter: [All Accounts ▼] [All Categories ▼]             │
│                                                            │
│  Date      | Account            | Description | Amount    │
│  ──────────────────────────────────────────────────────  │
│  2/17/26   | Party Vault        | Tavern meal | 15 gp    │
│  2/16/26   | Player A — Barb.   | Armorer    | 50 gp    │
│  2/15/26   | Town Lodging       | Inn stay   | 50 gp    │
│                                                            │
│ [Delete] buttons on each row for easy undo              │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## ➕ Add Loot Modal

### Step 1: Loot Details
```
┌─────────────────────────────────────────────────────┐
│      Add Loot Entry               [✕ Close]         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 1 of 2: Loot Details                         │
│                                                     │
│  Gold (gp): [500  ]                                │
│  Silver(sp):[0    ]                                │
│  Copper(cp):[0    ]                                │
│                                                     │
│  Source Category: [Treasure ▼]                     │
│                                                     │
│  Description:                                       │
│  [Dragon hoard from cave encounter..]              │
│                                                     │
│  Session #: [12    ]                               │
│                                                     │
│  Total Loot: 500 gp                                │
│                                                     │
│  [Cancel]              [Next: Allocate →]          │
└─────────────────────────────────────────────────────┘
```

### Step 2: Allocate Funds
```
┌─────────────────────────────────────────────────────┐
│      Add Loot Entry               [✕ Close]         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 2 of 2: Allocate Funds                       │
│                                                     │
│  [Split Evenly] [All to Party] [Clear All]         │
│                                                     │
│  Recipient         | GP   | SP| CP | Total         │
│  ──────────────────────────────────────────        │
│  Party Vault       | 125  | 0 | 0  | 125 gp        │
│  Patron            | 0    | 0 | 0  | 0 gp          │
│  Player A - Barb.  | 125  | 0 | 0  | 125 gp        │
│  Player B - Rogue  | 125  | 0 | 0  | 125 gp        │
│  Player C - Cler.  | 125  | 0 | 0  | 125 gp        │
│                                                     │
│  Loot Total: 500 cp                                │
│  Allocated:  500 cp                                │
│  ✓ Allocations match!                              │
│                                                     │
│  [← Back] [Cancel]  [✓ Add Loot Entry]             │
└─────────────────────────────────────────────────────┘
```

---

## 💸 Record Spending Modal

```
┌─────────────────────────────────────────────────────┐
│      Record Spending              [✕ Close]         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Account/Character: [Player A — Barbarian ▼]       │
│                                                     │
│  Category: [Equipment & Weapons ▼]                 │
│                                                     │
│  Description:                                       │
│  [New longsword from blacksmith]                    │
│                                                     │
│  Gold (gp): [50   ]                                │
│  Silver(sp):[0    ]                                │
│  Copper(cp):[0    ]                                │
│                                                     │
│  Amount: 50 gp                                      │
│                                                     │
│  [Cancel]           [✓ Record Spending]             │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ Settings Tab

```
┌──────────────────────────────────────────────────────────┐
│ ⚙️ Treasury Settings                                     │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Auto-allocation Rules                                   │
│                                                            │
│  ☐ Auto-allocate percentage to Patron on new loot       │
│                                                            │
│  Patron Percentage:                                      │
│  [10] %                                                   │
│                                                            │
│                           [Save Settings]                 │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Spending Categories Reference

```
Equipment & Weapons     ⚔️  Buy armor, weapons, shields
Lodging                 🏨  Inn rooms, taverns, camps
Food & Drink            🍖  Meals, drinks, rations
Bribes & Persuasion     💰  Pay guards, seduce NPCs
Healing Services        ⚕️   Potion purchases, clerics
Shipping & Travel       ⛵  Boats, carriages, travel
Resurrection            💀  Raise Dead, True Resurrection
Charity & Donations     🙏  Temples, orphans, good deeds
Property & Maintenance  🏠  Ship upkeep, house repairs
Other                   ❓  Anything else!
```

---

## 💡 Color Coding in UI

```
✨ SUCCESS/POSITIVE (Green/Cyan)
  - "✓ Allocations match!"
  - Balance numbers (account amounts)
  - Confirmation messages

⚠️ WARNING/ATTENTION (Orange)
  - Spending amounts
  - "Total Spent This Session" stat
  - Delete buttons

❌ ERROR/NEGATIVE (Red)
  - "❌ Allocations don't match"
  - Insufficient funds messages
  - Delete confirmation dialogs
```

---

## 🎮 Quick Action Buttons

```
Location 1: Wallets Tab (Top Right)
  [➕ Add Loot]        [💸 Record Spending]

Location 2: Loot Log Tab (Top Right)
  [➕ Add Loot]

Location 3: Spending Log Tab (Top Right)
  [💸 Record Spending]

Location 4: Within Allocation Step
  [Split Evenly]       [All to Party]    [Clear All]
```

---

## 📊 Dashboard Quick Stats

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Total   │     │  Total   │     │  Total   │
│  Party   │     │Individual│     │  Spent   │
│  Vault   │     │  Funds   │     │  Today   │
│          │     │          │     │          │
│  450 gp  │     │  850 gp  │     │  125 gp  │
└──────────┘     └──────────┘     └──────────┘

  🏰 Party         👥 Players          💸 Expenses
```

---

## ⌚ Typical Usage Timeline

```
BEFORE SESSION (5 min)
├─ Open Treasury
├─ Glance at Wallets tab
└─ Note party wealth

DURING SESSION (0 min pause)
├─ Focus on gameplay
└─ Optionally note major loot

AFTER SESSION (10 min)
├─ Add loot entries
├─ Record spending
├─ Verify balances
└─ Save & continue

NEXT SESSION
└─ Repeat!
```

---

## 🎯 Tab Navigation Flow

```
First Time?
  └─> Read ⚙️ Settings tab
      └─> (Optional) Enable patron auto-allocation
          └─> Go to 💳 Wallets

Adding Loot?
  └─> Click ➕ Add Loot button anywhere
      └─> Follow 2-step wizard
          └─> Back to whatever tab you want

Recording Expense?
  └─> Click 💸 Record Spending button anywhere
      └─> Quick form submission
          └─> Back to whatever tab you want

Checking Finances?
  └─> Go to 💳 Wallets tab
      └─> See all balances instantly

Analyzing Spending?
  └─> Go to 💸 Spending Log tab
      └─> Use filters to drill down
          └─> View detailed history

Viewing History?
  └─> Go to 🎁 Loot Log tab
      └─> See all treasure found
          └─> View distributions
```

---

## 🎨 Design Philosophy

**Clean & Minimalist**
- Only essentials visible
- Advanced features in modals
- Clutter-free layouts

**Dark Theme**
- Matches Copper Shores aesthetic
- Easy on the eyes during long sessions
- Professional appearance

**Intuitive Navigation**
- Tabs clearly labeled
- Buttons self-explanatory
- Modals straightforward

**Responsive**
- Works on all screen sizes
- Touch-friendly on tablets/phones
- Desktop-optimized for home use

---

This visual guide shows the complete user interface for the Gold & Treasury system!
