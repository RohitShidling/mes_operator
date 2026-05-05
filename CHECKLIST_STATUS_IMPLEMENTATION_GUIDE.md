# Checklist Status Calculation - Backend Implementation Guide

## Overview
The checklist status needs to be calculated based on the completion percentage of individual checklist items for each machine.

## Three Status Values

### 1. NOT_STARTED
- **Condition**: `completed_items === 0`
- **Meaning**: No checklist items have been checked/completed yet
- **Example**: All 9 items are PENDING → Status is NOT_STARTED

### 2. PENDING  
- **Condition**: `0 < completed_items < total_items`
- **Meaning**: Some items are checked but work is incomplete
- **Example**: 2 out of 9 items are DONE → Status is PENDING
- **Example**: 8 out of 9 items are DONE → Status is PENDING (still one incomplete)

### 3. COMPLETED
- **Condition**: `completed_items === total_items AND total_items > 0`
- **Meaning**: All checklist items for this machine are completed
- **Example**: All 9 items are DONE/COMPLETED → Status is COMPLETED

---

## Endpoint Implementation

### GET `/work-orders/{workOrderId}/checklist-overview`

**Purpose**: Get checklist status overview for all machines in a work order

**Logic Flow**:
1. Fetch all machines assigned to the work order
2. For each machine:
   - Query all checklist items for that machine
   - Count total items
   - Count items with status IN ['DONE', 'COMPLETED']
   - Calculate the machine's checklist_status based on counts
3. Return machines array with calculated checklist_status

**Response Format**:
```json
{
  "success": true,
  "data": {
    "work_order_id": "104",
    "work_order_name": "abcd",
    "machines": [
      {
        "machine_id": "MACH-89EDA4B2",
        "machine_name": "abcd",
        "ingest_path": "/abcd",
        "checklist_status": "PENDING",
        "stage_order": 1,
        "completed_items": 3,
        "total_items": 9
      },
      {
        "machine_id": "MACH-5BA6E020",
        "machine_name": "brs",
        "ingest_path": "/brs",
        "checklist_status": "COMPLETED",
        "stage_order": 2,
        "completed_items": 9,
        "total_items": 9
      }
    ]
  }
}
```

---

### PUT `/checklist/{machineId}/progress`

**Purpose**: Save machine-specific checklist progress

**Current Implementation**: Updates status/comments for each checklist line

**Enhancement Required**:
1. After updating all items
2. Recalculate the machine's checklist_status based on the new item states
3. Return the updated checklist_status in the response

**Updated Response Format**:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "statusCode": 200,
  "data": {
    "machine_id": "MACH-5BA6E020",
    "checklist_status": "PENDING",
    "completed_items": 3,
    "total_items": 9,
    "updated_items": [
      {
        "id": 46,
        "checkpoint": "Cleanliness",
        "status": "DONE",
        "comments": "Done and verified"
      },
      {
        "id": 47,
        "checkpoint": "Cleaning",
        "status": "PENDING",
        "comments": ""
      }
    ]
  }
}
```

---

## Database Query Examples

### Get Completed Item Count for a Machine
```sql
SELECT COUNT(*) as completed_count
FROM checklist_items
WHERE machine_id = ? 
AND status IN ('DONE', 'COMPLETED');
```

### Get Total Item Count for a Machine
```sql
SELECT COUNT(*) as total_count
FROM checklist_items
WHERE machine_id = ?;
```

### Calculate Status
```javascript
function calculateChecklistStatus(completedCount, totalCount) {
  if (totalCount === 0) return 'NOT_STARTED';
  if (completedCount === 0) return 'NOT_STARTED';
  if (completedCount < totalCount) return 'PENDING';
  if (completedCount === totalCount) return 'COMPLETED';
  return 'NOT_STARTED';
}
```

---

## Testing Scenarios

### Scenario 1: New Machine (No items completed)
- Total items: 9
- Completed items: 0
- Expected status: **NOT_STARTED** ✓

### Scenario 2: Partial Completion
- Total items: 9
- Completed items: 2 (Cleanliness, Safety)
- Expected status: **PENDING** ✓

### Scenario 3: Almost Complete
- Total items: 9
- Completed items: 8
- Expected status: **PENDING** ✓ (not COMPLETED)

### Scenario 4: Full Completion
- Total items: 9
- Completed items: 9
- Expected status: **COMPLETED** ✓

### Scenario 5: Updating After Completion
- Initial: All 9 items marked DONE → Status: COMPLETED
- User removes/changes 1 item to PENDING
- Updated: 8 DONE, 1 PENDING
- Expected status: **PENDING** ✓ (not COMPLETED)

---

## Frontend Integration (Already Implemented)

The frontend now:
1. Calls `/work-orders/{workOrderId}/checklist-overview` on page load
2. Displays both machine status and checklist_status badges
3. Updates on checklist save

### Files Modified:
- ✓ `src/api/checklistApi.js` - Added getChecklistOverview()
- ✓ `src/pages/work-orders/WorkOrderDetailPage.jsx` - Updated to fetch and display checklist status

---

## Key Points

1. **Item Status Values**: The API accepts 'DONE', 'PENDING', 'NOT_DONE' for individual items
2. **Status Mapping**: For summary, consider statuses containing 'DONE', 'COMPLETED', or 'OK' as completed
3. **Zero Items Case**: If a machine has zero checklist items, status should be 'NOT_STARTED'
4. **Real-time Updates**: Every PUT request should recalculate and return the new status
5. **Consistency**: Both GET endpoints should use the same status calculation logic

---

## Summary

The fix ensures that:
- ✓ Partial completion shows as PENDING (not COMPLETED)
- ✓ Status updates correctly when items are modified
- ✓ Full completion shows as COMPLETED only when all items are done
- ✓ New machines show as NOT_STARTED
- ✓ Frontend displays accurate checklist status for each machine
