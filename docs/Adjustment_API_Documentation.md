# Adjustment API Documentation

## Overview

The Adjustment API provides comprehensive CRUD operations for managing audit adjustments in the trial balance system. Adjustments can be created as drafts, posted to affect the Extended Trial Balance (ETB), unposted to reverse their impact, and deleted when no longer needed.

## Table of Contents

1. [Data Model](#data-model)
2. [API Endpoints](#api-endpoints)
3. [Frontend Integration](#frontend-integration)
4. [Usage Examples](#usage-examples)
5. [Error Handling](#error-handling)

---

## Data Model

### Adjustment Schema

```javascript
{
  _id: ObjectId,
  engagementId: ObjectId (ref: Engagement),
  etbId: ObjectId (ref: ExtendedTrialBalance),
  adjustmentNo: String,          // e.g., "AA1", "AA2"
  description: String,
  status: "draft" | "posted",
  entries: [
    {
      etbRowId: String,           // References ETBRow._id
      code: String,               // Account code
      accountName: String,
      dr: Number,                 // Debit amount
      cr: Number,                 // Credit amount
      details: String
    }
  ],
  totalDr: Number,                // Auto-calculated
  totalCr: Number,                // Auto-calculated
  createdAt: Date,
  updatedAt: Date
}
```

### Validation Rules

1. **Entry Validation**: An entry cannot have both `dr > 0` AND `cr > 0`
2. **Balance Validation**: Before posting, `totalDr` must equal `totalCr`
3. **Status Validation**: 
   - Only `draft` adjustments can be edited
   - Only `draft` adjustments can be posted
   - Only `posted` adjustments can be unposted
   - Only `draft` adjustments can be deleted

---

## API Endpoints

### 1. Create Adjustment

**Endpoint:** `POST /api/adjustments`

**Description:** Create a new adjustment with `draft` status.

**Request Body:**
```json
{
  "engagementId": "507f1f77bcf86cd799439011",
  "etbId": "507f1f77bcf86cd799439012",
  "adjustmentNo": "AA1",
  "description": "Depreciation adjustment",
  "entries": [
    {
      "etbRowId": "ACC001",
      "code": "6500",
      "accountName": "Depreciation Expense",
      "dr": 5000,
      "cr": 0,
      "details": "Annual depreciation"
    },
    {
      "etbRowId": "ACC002",
      "code": "1500",
      "accountName": "Accumulated Depreciation",
      "dr": 0,
      "cr": 5000,
      "details": "Annual depreciation"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* Adjustment object */ },
  "message": "Adjustment created successfully"
}
```

---

### 2. Get Adjustments by Engagement

**Endpoint:** `GET /api/adjustments/engagement/:engagementId`

**Description:** Retrieve all adjustments for a specific engagement.

**Response:**
```json
{
  "success": true,
  "data": [ /* Array of Adjustment objects */ ],
  "message": "Adjustments retrieved successfully"
}
```

---

### 3. Get Adjustments by ETB

**Endpoint:** `GET /api/adjustments/etb/:etbId`

**Description:** Retrieve all adjustments for a specific Extended Trial Balance.

**Response:**
```json
{
  "success": true,
  "data": [ /* Array of Adjustment objects */ ],
  "message": "Adjustments retrieved successfully"
}
```

---

### 4. Get Adjustment by ID

**Endpoint:** `GET /api/adjustments/:id`

**Description:** Retrieve a single adjustment by its ID.

**Response:**
```json
{
  "success": true,
  "data": { /* Adjustment object */ },
  "message": "Adjustment retrieved successfully"
}
```

---

### 5. Update Adjustment

**Endpoint:** `PUT /api/adjustments/:id`

**Description:** Update an existing draft adjustment.

**Request Body:**
```json
{
  "description": "Updated description",
  "entries": [ /* Updated entries array */ ]
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* Updated Adjustment object */ },
  "message": "Adjustment updated successfully"
}
```

**Error Conditions:**
- Returns `400` if adjustment is not in `draft` status

---

### 6. Post Adjustment

**Endpoint:** `POST /api/adjustments/:id/post`

**Description:** Post a draft adjustment to apply it to the ETB. This operation:
- Validates that Dr = Cr
- Updates ETB row adjustments and final balances
- Changes adjustment status to `posted`
- Uses MongoDB transactions for data integrity

**Response:**
```json
{
  "success": true,
  "data": {
    "adjustment": { /* Updated Adjustment object */ },
    "etbSummary": {
      "totalRows": 150,
      "updatedRows": 2
    }
  },
  "message": "Adjustment posted successfully"
}
```

**Error Conditions:**
- Returns `400` if adjustment is not `draft`
- Returns `400` if Dr ≠ Cr
- Returns `404` if ETB or ETB rows not found

---

### 7. Unpost Adjustment

**Endpoint:** `POST /api/adjustments/:id/unpost`

**Description:** Unpost a posted adjustment to reverse its ETB impact. This operation:
- Reverses ETB row adjustments and final balances
- Changes adjustment status back to `draft`
- Uses MongoDB transactions for data integrity

**Response:**
```json
{
  "success": true,
  "data": {
    "adjustment": { /* Updated Adjustment object */ },
    "etbSummary": {
      "totalRows": 150,
      "updatedRows": 2
    }
  },
  "message": "Adjustment unposted successfully"
}
```

**Error Conditions:**
- Returns `400` if adjustment is not `posted`
- Returns `404` if ETB or ETB rows not found

---

### 8. Delete Adjustment

**Endpoint:** `DELETE /api/adjustments/:id`

**Description:** Delete a draft adjustment.

**Response:**
```json
{
  "success": true,
  "data": { "id": "507f1f77bcf86cd799439011" },
  "message": "Adjustment deleted successfully"
}
```

**Error Conditions:**
- Returns `400` if adjustment is `posted` (must unpost first)

---

## Frontend Integration

### API Client (`adjustmentApi`)

Located in: `A4-MALTA-AUDIT-PORTAL/src/services/api.ts`

```typescript
import { adjustmentApi } from '@/services/api';

// Create adjustment
const adjustment = await adjustmentApi.create({
  engagementId: '...',
  etbId: '...',
  adjustmentNo: 'AA1',
  entries: [...]
});

// Get adjustments
const adjustments = await adjustmentApi.getByEngagement(engagementId);

// Update adjustment
await adjustmentApi.update(adjustmentId, { description: 'Updated' });

// Post adjustment
await adjustmentApi.post(adjustmentId);

// Unpost adjustment
await adjustmentApi.unpost(adjustmentId);

// Delete adjustment
await adjustmentApi.delete(adjustmentId);
```

### React Hook (`useAdjustment`)

Located in: `A4-MALTA-AUDIT-PORTAL/src/hooks/useAdjustment.ts`

```typescript
import { useAdjustment } from '@/hooks/useAdjustment';

function MyComponent() {
  const {
    adjustments,           // Array of adjustments
    currentAdjustment,     // Single adjustment (when fetched by ID)
    loading,               // General loading state
    isCreating,           // Creating state
    isUpdating,           // Updating state
    isPosting,            // Posting/Unposting state
    isDeleting,           // Deleting state
    error,                // Error message
    
    // Methods
    createAdjustment,
    updateAdjustment,
    postAdjustment,
    unpostAdjustment,
    deleteAdjustment,
    fetchById,
    refetch,
    clearError,
  } = useAdjustment({
    engagementId: '...',  // Auto-fetches adjustments
    autoFetch: true       // Default: true
  });

  // Create new adjustment
  const handleCreate = async () => {
    try {
      const newAdj = await createAdjustment({
        engagementId: '...',
        etbId: '...',
        adjustmentNo: 'AA1',
        entries: [...]
      });
      console.log('Created:', newAdj);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // Post adjustment
  const handlePost = async (id) => {
    try {
      const result = await postAdjustment(id);
      console.log('Posted:', result);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {adjustments.map(adj => (
        <div key={adj._id}>{adj.adjustmentNo}</div>
      ))}
    </div>
  );
}
```

---

## Usage Examples

### Example 1: Complete Adjustment Workflow

```typescript
const {
  createAdjustment,
  postAdjustment,
  unpostAdjustment,
  deleteAdjustment
} = useAdjustment({ engagementId });

// 1. Create draft adjustment
const adjustment = await createAdjustment({
  engagementId,
  etbId,
  adjustmentNo: 'AA1',
  description: 'Year-end depreciation',
  entries: [
    { etbRowId: 'row1', code: '6500', accountName: 'Depreciation', dr: 5000, cr: 0 },
    { etbRowId: 'row2', code: '1500', accountName: 'Acc. Depreciation', dr: 0, cr: 5000 }
  ]
});

// 2. Post to ETB
await postAdjustment(adjustment._id);

// 3. If needed, unpost to make changes
await unpostAdjustment(adjustment._id);

// 4. Delete if no longer needed
await deleteAdjustment(adjustment._id);
```

### Example 2: Fetching Adjustments

```typescript
// Option 1: Auto-fetch on mount
const { adjustments } = useAdjustment({ engagementId });

// Option 2: Manual fetch
const { fetchByEngagement } = useAdjustment({ autoFetch: false });
useEffect(() => {
  fetchByEngagement(engagementId);
}, [engagementId]);

// Option 3: Fetch by ETB
const { fetchByETB } = useAdjustment({ autoFetch: false });
fetchByETB(etbId);
```

### Example 3: Error Handling

```typescript
const { error, clearError, postAdjustment } = useAdjustment({ engagementId });

const handlePost = async (id) => {
  clearError();
  try {
    await postAdjustment(id);
    toast.success('Adjustment posted!');
  } catch (err) {
    toast.error(error || 'Failed to post adjustment');
  }
};
```

---

## Error Handling

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid data, unbalanced entry, or status conflict |
| 404 | Not Found | Adjustment, ETB, or ETB row not found |
| 500 | Server Error | Database or transaction error |

### Error Response Format

```json
{
  "success": false,
  "message": "Error description here"
}
```

### Transaction Safety

Both `POST /adjustments/:id/post` and `POST /adjustments/:id/unpost` use MongoDB transactions to ensure:
- All ETB row updates succeed or none do
- Adjustment status changes are atomic
- Data integrity is maintained on errors

---

## ETB Impact Details

### When Posting an Adjustment

For each entry in the adjustment:
1. Calculate `netAdjustment = dr - cr`
2. Find the corresponding ETB row by `etbRowId`
3. Update `row.adjustments += netAdjustment`
4. Recalculate `row.finalBalance = row.currentYear + row.adjustments`
5. Add adjustment `_id` to `row.adjustmentRefs[]`

### When Unposting an Adjustment

For each entry in the adjustment:
1. Calculate `netAdjustment = dr - cr`
2. Find the corresponding ETB row by `etbRowId`
3. Update `row.adjustments -= netAdjustment`
4. Recalculate `row.finalBalance = row.currentYear + row.adjustments`
5. Remove adjustment `_id` from `row.adjustmentRefs[]`

---

## Best Practices

1. **Always validate Dr = Cr before posting**
2. **Use transactions for ETB updates** (handled automatically)
3. **Unpost before deleting** posted adjustments
4. **Use meaningful adjustment numbers** (AA1, AA2, etc.)
5. **Add detailed descriptions** for audit trail
6. **Handle errors gracefully** in UI

---

## Notes

- The adjustment number (`adjustmentNo`) is not auto-generated; it must be provided
- ETB rows are referenced by `_id` string, not by code
- Adjustments are sorted by `createdAt` (newest first)
- The hook auto-refreshes the list after create/update/delete operations
- All monetary values should be in the engagement's currency

