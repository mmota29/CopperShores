# 💰 Gold & Treasury Management System

## Overview
The enhanced Gold & Treasury Management System is a complete solution for managing party finances, loot tracking, and spending in your D&D campaign. It replaces the placeholder gold system with a fully-featured toolkit designed to be both **fun and easy to use**.

## Features

### 1. **Loot Tracking** 🎁
- **Add Loot Entries**: Record treasure found during adventures
- **Source Categories**: Quest Reward, Treasure, Vendor Sale, Bounty, Gambling, Inheritance, or Other
- **Multi-step Allocation**: Intuitive 2-step process:
  - Step 1: Enter loot amount and details
  - Step 2: Allocate coins across party/patron/character accounts
- **Quick Allocation Buttons**:
  - Even Split: Divide loot equally among all recipients
  - All to Party: Send everything to party vault
  - Clear All: Reset allocations to start over
- **Session Tracking**: Link loot to specific campaign sessions
- **Loot Log**: Complete history with filtering and deletion

### 2. **Spending Management** 💸
- **Record Expenses**: Track where money goes
- **Spending Categories**:
  - Equipment & Weapons
  - Lodging
  - Food & Drink
  - Bribes & Persuasion
  - Healing Services
  - Shipping & Travel
  - Resurrection
  - Charity & Donations
  - Property & Maintenance
  - Other
- **Account-based Spending**: Deduct from party vault, patron, or individual character accounts
- **Insufficient Funds Protection**: System prevents overspending
- **Spending Log**: Track all expenses with account and category filtering
- **Delete Spending**: Reverse mistakes and refund amounts

### 3. **Account Management** 👥
Multiple account types for flexible fund management:
- **Party Vault**: Shared party resources
- **Patron**: Special funding source (useful for patron-backed campaigns)
- **Character Accounts**: Individual player character wallets (linked to current character)

### 4. **Currency System** 🪙
- **Full Support**: Gold (gp), Silver (sp), Copper (cp)
- **Automatic Conversion**: System handles all currency conversions automatically
- **Smart Display**: Shows most relevant denomination (e.g., 150 gp instead of 15000 cp)

### 5. **Dashboard & Quick Stats** 📊
Immediate overview of campaign finances:
- Total Party Vault balance
- Total Individual Funds (all character accounts combined)
- Total Spent This Session (quick reference for financial activity)

### 6. **Wallet View** 💳
- **Party & Special Funds**: Quick view of party vault and patron balance
- **Character Accounts**: See each player's current character wallet
- **Real-time Updates**: Balances update instantly when loot is added or spending is recorded

### 7. **Comprehensive Logs**
- **Loot Log**: View what's been found, amount, category, recipients, and session
- **Spending Log**: Track expenses with filters for account and category
- **Log Management**: Delete entries to correct mistakes
- **Date Sorting**: Most recent transactions appear first

### 8. **Settings**
- **Auto-allocation to Patron**: Optional automatic percentage allocation to patron fund on new loot
- **Patron Percentage**: Customize the percentage (0-100%)

## User Guide

### Adding Loot

1. Click **"➕ Add Loot"** button
2. **Step 1: Loot Details**
   - Enter amount in GP, SP, CP fields
   - Select source category
   - Add optional description (e.g., "Dragon hoard from cave encounter")
   - Optionally link to a session number
   - Total is calculated automatically
3. **Step 2: Allocate Loot**
   - Use quick buttons for easy allocation:
     - **Split Evenly**: Divide equally among all accounts
     - **All to Party**: Send all to party vault
     - **Clear All**: Start fresh
   - Or manually enter amounts in the allocation table
   - Table shows GP/SP/CP for each recipient
   - System ensures allocations match the loot total before confirming
4. Click **"✓ Add Loot Entry"** to save

### Recording Spending

1. Click **"💸 Record Spending"** button
2. Select the **Account/Character** that's spending money
3. Choose a **Spending Category** (equipment, lodging, bribes, etc.)
4. Enter optional **Description** (why the spending occurred)
5. Enter **Amount** in GP, SP, CP
6. Click **"✓ Record Spending"** to save
7. System automatically deducts from the account balance

### Viewing Balances

1. Go to **"💳 Wallets"** tab
2. See:
   - Party Vault and Patron balances (highlighted)
   - Each player's character account balance
3. Balances update in real-time as loot is added/spending recorded

### Analyzing Spending

1. Go to **"💸 Spending Log"** tab
2. Use filters to refine results:
   - Filter by **Account/Character** to see individual spending
   - Filter by **Category** to see spending by type (e.g., only "Healing Services")
3. Sort by date (most recent first)
4. Delete entries to reverse spending

### Viewing Loot History

1. Go to **"🎁 Loot Log"** tab
2. See all loot entries with:
   - Date found
   - Source category
   - Amount
   - How it was distributed
   - Session number (if linked)
3. Delete entries to correct mistakes (refunds allocations)

## Currency Conversion Reference

| Denomination | Coppers | Ratio |
|---|---|---|
| 1 Gold (gp) | 100 cp | 100:1 |
| 1 Silver (sp) | 10 cp | 10:1 |
| 1 Copper (cp) | 1 cp | 1:1 |

Examples:
- 1 gp 5 sp 3 cp = 153 cp total
- 250 cp = 2 gp 5 sp 0 cp
- 50 cp = 0 gp 5 sp 0 cp

## API Endpoints

### Loot Management
- `GET /api/treasury/loot-log` - Retrieve all loot entries
- `POST /api/treasury/loot` - Add a loot entry
- `DELETE /api/treasury/loot/:id` - Delete loot entry and reverse allocations

### Spending Management
- `GET /api/treasury/spending-log` - Retrieve all spending entries
- `POST /api/treasury/spending` - Record spending
- `DELETE /api/treasury/spending/:id` - Delete spending entry and refund

### Accounts & Wallets
- `GET /api/treasury/accounts` - List all accounts
- `GET /api/treasury/wallets` - Get current balances for all accounts

### Categories & Settings
- `GET /api/treasury/categories` - Get loot and spending categories
- `GET /api/treasury/settings` - Get treasury settings
- `PUT /api/treasury/settings` - Update treasury settings

## Data Structure

### Loot Entry
```json
{
  "id": "loot_abc123",
  "date": "2026-02-17T15:30:00Z",
  "totalCp": 5000,
  "description": "Dragon hoard from cave",
  "category": "treasure",
  "session": 12,
  "allocations": [
    {
      "accountId": "party",
      "name": "Party Vault",
      "amountCp": 2500
    },
    {
      "accountId": "character:char_xyz",
      "name": "Player Name — Character Name",
      "amountCp": 2500
    }
  ]
}
```

### Spending Entry
```json
{
  "id": "spend_def456",
  "date": "2026-02-17T16:00:00Z",
  "accountId": "party",
  "amountCp": 250,
  "description": "Tavern dinner with barkeep",
  "category": "food"
}
```

### Account
```json
{
  "id": "character:char_xyz",
  "name": "Player Name — Character Name",
  "displayName": "Player Name — Character Name",
  "playerId": "player_abc",
  "characterId": "char_xyz"
}
```

## Game Master Tips

### Best Practices
1. **End-of-Session**: Record all loot and spending at the end of each session
2. **Link to Sessions**: Use the session number field to easily find loot from specific sessions
3. **Meaningful Descriptions**: Add context to loot (where it came from) and spending (why it happened)
4. **Party Responsibility**: Use Party Vault for shared resources, character accounts for personal hoards
5. **Patron Fund**: If you have a patron backing the party, allocate a percentage automatically

### Campaign Setup
1. Go to **"⚙️ Settings"** tab
2. Enable auto-allocation to patron if your campaign has one
3. Customize the percentage based on your patron's cut

### Running Encounters
After combat encounters:
1. Have players declare what they loot
2. Quickly add the loot entry using the "All to Party" button
3. Later (end of session), have party distribute among themselves
4. Record any spending during rest/downtime

### Dispute Resolution
If players ask "how much do I have?":
1. Go to Wallets tab
2. Show them their character account balance
3. Show Party Vault for shared funds

## Future Enhancement Ideas
- Multi-session spending reports
- Wealth per player trends
- Campaign total earning statistics
- Custom spending categories per campaign
- Recurring expenses/salaries
- Item-level loot tracking (beyond just coin)
- Debt/Loan system for inter-party borrowing

## Files Modified
- `backend/db.js` - Enhanced treasury database functions
- `backend/server.js` - Added spending endpoints
- `frontend/gold.html` - Redesigned UI with new features
- `frontend/gold.js` - Complete rewrite with spending logic
- `frontend/gold.css` - New styles for all components

## Support
For issues or feature requests, check the browser console for detailed error messages. All API errors include descriptive messages to help troubleshoot.
