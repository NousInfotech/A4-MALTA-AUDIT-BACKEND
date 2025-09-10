# Employee Log API Documentation

## Overview
The Employee Log API provides comprehensive logging and monitoring capabilities for employee activities within the audit portal. It tracks user actions, system interactions, and provides analytics for audit trails and compliance.

## Base URL
```
/api/employee-logs
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header.

## Employee Log Endpoints

### 1. Create Employee Log Entry
**POST** `/api/employee-logs/`

Creates a new employee log entry for tracking activities.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "employeeId": "user-123",
  "employeeName": "John Doe",
  "employeeEmail": "john.doe@company.com",
  "action": "LOGIN",
  "details": "User logged in from Chrome browser",
  "ipAddress": "192.168.1.100",
  "location": "New York, NY",
  "deviceInfo": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "status": "SUCCESS"
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "employeeId": "user-123",
  "employeeName": "John Doe",
  "employeeEmail": "john.doe@company.com",
  "action": "LOGIN",
  "details": "User logged in from Chrome browser",
  "ipAddress": "192.168.1.100",
  "location": "New York, NY",
  "deviceInfo": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "status": "SUCCESS",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Get All Employee Logs
**GET** `/api/employee-logs/`

Retrieves all employee logs with filtering, pagination, and sorting options.

**Query Parameters:**
- `employeeId` (string): Filter by specific employee ID
- `action` (string): Filter by action type
- `status` (string): Filter by status (SUCCESS/FAIL)
- `startDate` (string): Filter logs from this date (ISO format)
- `endDate` (string): Filter logs until this date (ISO format)
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Number of logs per page (default: 50)
- `sortBy` (string): Field to sort by (default: timestamp)
- `sortOrder` (string): Sort order - asc/desc (default: desc)

**Example:**
```
GET /api/employee-logs/?employeeId=user-123&action=LOGIN&page=1&limit=20&sortBy=timestamp&sortOrder=desc
```

**Response:**
```json
{
  "logs": [
    {
      "_id": "64a1b2c3d4e5f6789012348",
      "employeeId": "user-123",
      "employeeName": "John Doe",
      "employeeEmail": "john.doe@company.com",
      "action": "LOGIN",
      "details": "User logged in from Chrome browser",
      "ipAddress": "192.168.1.100",
      "location": "New York, NY",
      "deviceInfo": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "status": "SUCCESS",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 100,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 3. Get Logs by Employee
**GET** `/api/employee-logs/employee/:employeeId`

Retrieves all logs for a specific employee.

**Path Parameters:**
- `employeeId` (string): The employee ID to filter by

**Query Parameters:** Same as Get All Logs

**Response:**
```json
{
  "employeeId": "user-123",
  "logs": [
    {
      "_id": "64a1b2c3d4e5f6789012348",
      "employeeId": "user-123",
      "employeeName": "John Doe",
      "action": "LOGIN",
      "status": "SUCCESS",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 25,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 4. Get Log Statistics
**GET** `/api/employee-logs/statistics`

Retrieves comprehensive statistics about employee logs.

**Query Parameters:**
- `startDate` (string): Start date for statistics (ISO format)
- `endDate` (string): End date for statistics (ISO format)
- `employeeId` (string): Filter statistics by employee

**Response:**
```json
{
  "summary": {
    "totalLogs": 1500,
    "successLogs": 1450,
    "failedLogs": 50,
    "successRate": "96.67"
  },
  "actionBreakdown": [
    {
      "_id": "LOGIN",
      "count": 500
    },
    {
      "_id": "UPLOAD_DOCUMENT",
      "count": 300
    },
    {
      "_id": "VIEW_CLIENT_FILE",
      "count": 250
    }
  ],
  "topEmployees": [
    {
      "_id": "user-123",
      "employeeName": "John Doe",
      "count": 150
    },
    {
      "_id": "user-456",
      "employeeName": "Jane Smith",
      "count": 120
    }
  ],
  "recentActivity": [
    {
      "_id": "64a1b2c3d4e5f6789012348",
      "employeeName": "John Doe",
      "action": "LOGIN",
      "status": "SUCCESS",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "details": "User logged in from Chrome browser"
    }
  ]
}
```

### 5. Get Log by ID
**GET** `/api/employee-logs/:id`

Retrieves a specific log entry by its ID.

**Path Parameters:**
- `id` (string): The log entry ID

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "employeeId": "user-123",
  "employeeName": "John Doe",
  "employeeEmail": "john.doe@company.com",
  "action": "LOGIN",
  "details": "User logged in from Chrome browser",
  "ipAddress": "192.168.1.100",
  "location": "New York, NY",
  "deviceInfo": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "status": "SUCCESS",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 6. Update Log Entry
**PATCH** `/api/employee-logs/:id`

Updates an existing log entry.

**Path Parameters:**
- `id` (string): The log entry ID

**Body:**
```json
{
  "details": "Updated details about the action",
  "status": "FAIL"
}
```

**Response:** Updated log entry

### 7. Delete Log Entry
**DELETE** `/api/employee-logs/:id`

Deletes a specific log entry.

**Path Parameters:**
- `id` (string): The log entry ID

**Response:**
```json
{
  "message": "Log entry deleted successfully"
}
```

### 8. Bulk Delete Logs
**DELETE** `/api/employee-logs/bulk`

Deletes multiple log entries based on criteria.

**Body:**
```json
{
  "logIds": ["64a1b2c3d4e5f6789012348", "64a1b2c3d4e5f6789012349"],
  "employeeId": "user-123",
  "action": "LOGIN",
  "status": "FAIL",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.999Z"
}
```

**Response:**
```json
{
  "message": "25 log entries deleted successfully",
  "deletedCount": 25
}
```

### 9. Export Logs
**GET** `/api/employee-logs/export/data`

Exports logs in CSV or JSON format.

**Query Parameters:**
- `employeeId` (string): Filter by employee ID
- `action` (string): Filter by action
- `status` (string): Filter by status
- `startDate` (string): Start date filter
- `endDate` (string): End date filter
- `format` (string): Export format - csv/json (default: csv)

**Response:**
- **CSV Format**: Downloads CSV file with headers
- **JSON Format**: Returns JSON array of logs

### 10. Get Available Actions
**GET** `/api/employee-logs/actions/available`

Retrieves all available action types and their descriptions.

**Response:**
```json
{
  "actions": [
    "LOGIN",
    "LOGOUT",
    "UPLOAD_DOCUMENT",
    "VIEW_CLIENT_FILE",
    "UPDATE_PROFILE",
    "DELETE_DOCUMENT"
  ],
  "actionDescriptions": {
    "LOGIN": "Employee logged into the system",
    "LOGOUT": "Employee logged out of the system",
    "UPLOAD_DOCUMENT": "Employee uploaded a document",
    "VIEW_CLIENT_FILE": "Employee viewed a client file",
    "UPDATE_PROFILE": "Employee updated their profile",
    "DELETE_DOCUMENT": "Employee deleted a document"
  }
}
```

## Available Actions

The system supports the following predefined actions:

- **LOGIN**: Employee logged into the system
- **LOGOUT**: Employee logged out of the system
- **UPLOAD_DOCUMENT**: Employee uploaded a document
- **VIEW_CLIENT_FILE**: Employee viewed a client file
- **UPDATE_PROFILE**: Employee updated their profile
- **DELETE_DOCUMENT**: Employee deleted a document

## Status Values

- **SUCCESS**: Action completed successfully
- **FAIL**: Action failed or encountered an error

## Error Responses

**400 Bad Request:**
```json
{
  "message": "Invalid action. Must be one of: LOGIN, LOGOUT, UPLOAD_DOCUMENT, VIEW_CLIENT_FILE, UPDATE_PROFILE, DELETE_DOCUMENT"
}
```

**404 Not Found:**
```json
{
  "message": "Log entry not found"
}
```

**403 Forbidden:**
```json
{
  "message": "Insufficient permissions"
}
```

## Role Permissions

- **employee**: Can create, view, update, and delete log entries
- **client**: Can only view their own logs (if implemented)
- **admin**: Full access to all log operations

## Usage Examples

### 1. Log Employee Login:
```javascript
POST /api/employee-logs/
{
  "employeeId": "user-123",
  "employeeName": "John Doe",
  "employeeEmail": "john.doe@company.com",
  "action": "LOGIN",
  "details": "User logged in from Chrome browser",
  "ipAddress": "192.168.1.100",
  "status": "SUCCESS"
}
```

### 2. Get Recent Activity:
```javascript
GET /api/employee-logs/?page=1&limit=10&sortBy=timestamp&sortOrder=desc
```

### 3. Export Logs for Audit:
```javascript
GET /api/employee-logs/export/data?startDate=2024-01-01&endDate=2024-01-31&format=csv
```

### 4. Get Employee Statistics:
```javascript
GET /api/employee-logs/statistics?employeeId=user-123&startDate=2024-01-01
```

## Integration Notes

### Helper Function Usage
The controller includes a helper function `logEmployeeActivity` that can be used in other controllers:

```javascript
const { logEmployeeActivity } = require('../controllers/employeeLogController');

// In another controller
await logEmployeeActivity(req.user.id, 'UPLOAD_DOCUMENT', 'Uploaded financial statements', req);
```

### Automatic Logging
Consider implementing middleware to automatically log common activities:

```javascript
// Example middleware for automatic login logging
app.use((req, res, next) => {
  if (req.path === '/api/auth/login' && req.method === 'POST') {
    // Log login attempt
    logEmployeeActivity(req.body.userId, 'LOGIN', 'Login attempt', req);
  }
  next();
});
```

## Security Considerations

### Data Privacy
- IP addresses and device information are logged for security purposes
- Consider data retention policies for log entries
- Ensure compliance with privacy regulations

### Access Control
- Only authenticated employees can create and view logs
- Consider implementing admin-only access for sensitive operations
- Log access itself for audit purposes

### Performance
- Implement proper indexing on frequently queried fields
- Consider archiving old logs for better performance
- Use pagination for large result sets

## Monitoring and Analytics

### Key Metrics
- Login/logout patterns
- Document upload/download activities
- Failed action attempts
- Employee activity levels

### Compliance Features
- Complete audit trail
- Export capabilities for compliance reporting
- Detailed action tracking
- IP and device logging for security

The Employee Log API provides comprehensive activity tracking and monitoring capabilities essential for audit compliance and security monitoring! 🎉
