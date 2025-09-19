# Review Model Integration Guide for Frontend

## Overview

This guide explains how to integrate the Review & Sign-Off system into your frontend application. The review system provides a complete workflow for audit item management, ensuring ISQM compliance and maintaining audit trails.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Review Workflow States](#review-workflow-states)
4. [Frontend Components Integration](#frontend-components-integration)
5. [UI/UX Guidelines](#uiux-guidelines)
6. [Real-time Updates](#real-time-updates)
7. [Error Handling](#error-handling)
8. [Implementation Examples](#implementation-examples)

---

## System Architecture

### Review System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Audit Items   │    │  Review System  │    │   Audit Trail   │
│                 │    │                 │    │                 │
│ • Procedures    │◄──►│ • Workflow      │◄──►│ • History       │
│ • Documents     │    │ • States        │    │ • Logs          │
│ • Checklists    │    │ • Permissions   │    │ • Tracking      │
│ • PBC Items     │    │ • Actions       │    │                 │
│ • Classifications│   │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow

1. **Employee** creates/updates audit item
2. **Employee** submits item for review
3. **Reviewer** gets assigned and reviews item
4. **Reviewer** approves/rejects item
5. **Partner** signs off on approved items
6. **System** maintains complete audit trail

---

## User Roles & Permissions

### Role Hierarchy
```
client < employee < reviewer < partner < admin
```

### Permission Matrix

| Action | Employee | Reviewer | Partner | Admin |
|--------|----------|----------|---------|-------|
| **Create/Edit Items** | ✅ | ✅ | ✅ | ✅ |
| **Submit for Review** | ✅ | ✅ | ✅ | ✅ |
| **Assign Reviewers** | ✅ | ✅ | ✅ | ✅ |
| **Review Items** | ✅ | ✅ | ✅ | ✅ |
| **Approve/Reject** | ✅ | ✅ | ✅ | ✅ |
| **Sign Off** | ✅ | ✅ | ✅ | ✅ |
| **Reopen Items** | ✅ | ✅ | ✅ | ✅ |
| **View All Queues** | ✅ | ✅ | ✅ | ✅ |

**Note:** Currently, all authenticated users have full permissions for testing purposes. In production, you may want to restrict certain actions to specific roles.

### Frontend Permission Checks

```javascript
// Check if user can perform specific actions
const canSubmitForReview = (userRole) => {
  return ['employee', 'reviewer', 'partner', 'admin'].includes(userRole);
};

const canReview = (userRole) => {
  return ['employee', 'reviewer', 'partner', 'admin'].includes(userRole);
};

const canSignOff = (userRole) => {
  return ['employee', 'reviewer', 'partner', 'admin'].includes(userRole);
};

const canReopen = (userRole) => {
  return ['employee', 'reviewer', 'partner', 'admin'].includes(userRole);
};

// All authenticated users can perform all actions for now
const canPerformAnyAction = (userRole) => {
  return ['employee', 'reviewer', 'partner', 'admin'].includes(userRole);
};
```

---

## Review Workflow States

### State Diagram

```
┌─────────────┐    Submit     ┌─────────────────┐
│ in-progress │ ────────────► │ ready-for-review│
└─────────────┘               └─────────────────┘
       ▲                              │
       │                              │ Assign
       │                              ▼
       │                       ┌─────────────────┐
       │                       │  under-review   │
       │                       └─────────────────┘
       │                              │
       │                              │ Review
       │                              ▼
       │                       ┌─────────────────┐
       │                       │    approved     │
       │                       └─────────────────┘
       │                              │
       │                              │ Sign Off
       │                              ▼
       │                       ┌─────────────────┐
       │                       │   signed-off    │
       │                       └─────────────────┘
       │                              │
       │                              │ Reopen
       │                              ▼
       └───────────────────────┌─────────────────┐
                               │   re-opened     │
                               └─────────────────┘
```

### State Descriptions

| State | Description | UI Color | Actions Available |
|-------|-------------|----------|-------------------|
| `in-progress` | Item being worked on | 🟡 Yellow | Submit for Review |
| `ready-for-review` | Submitted for review | 🔵 Blue | Assign Reviewer |
| `under-review` | Currently being reviewed | 🟠 Orange | Approve/Reject |
| `approved` | Review completed successfully | 🟢 Green | Sign Off |
| `rejected` | Review failed, needs changes | 🔴 Red | Submit for Review |
| `signed-off` | Final approval, item locked | 🟣 Purple | Reopen (Partner only) |
| `re-opened` | Reopened for changes | 🟡 Yellow | Submit for Review |

---

## Frontend Components Integration

### 1. Audit Item Cards/Lists

Every audit item should display its review status:

```jsx
const AuditItemCard = ({ item, userRole, onAction }) => {
  const getStatusColor = (status) => {
    const colors = {
      'in-progress': 'yellow',
      'ready-for-review': 'blue',
      'under-review': 'orange',
      'approved': 'green',
      'rejected': 'red',
      'signed-off': 'purple',
      're-opened': 'yellow'
    };
    return colors[status] || 'gray';
  };

  const getAvailableActions = (status, userRole) => {
    const actions = [];
    
    if (status === 'in-progress' && canSubmitForReview(userRole)) {
      actions.push({ label: 'Submit for Review', action: 'submit' });
    }
    
    if (status === 'ready-for-review' && canReview(userRole)) {
      actions.push({ label: 'Assign Reviewer', action: 'assign' });
    }
    
    if (status === 'under-review' && canReview(userRole)) {
      actions.push({ label: 'Review', action: 'review' });
    }
    
    if (status === 'approved' && canSignOff(userRole)) {
      actions.push({ label: 'Sign Off', action: 'signoff' });
    }
    
    if (status === 'signed-off' && canReopen(userRole)) {
      actions.push({ label: 'Reopen', action: 'reopen' });
    }
    
    return actions;
  };

  return (
    <div className={`audit-item-card status-${getStatusColor(item.reviewStatus)}`}>
      <div className="item-header">
        <h3>{item.title}</h3>
        <span className={`status-badge ${item.reviewStatus}`}>
          {item.reviewStatus.replace('-', ' ').toUpperCase()}
        </span>
      </div>
      
      <div className="item-content">
        <p>{item.description}</p>
        
        {item.reviewerId && (
          <div className="reviewer-info">
            <span>Assigned to: {item.reviewerName}</span>
          </div>
        )}
        
        {item.dueDate && (
          <div className="due-date">
            <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      
      <div className="item-actions">
        {getAvailableActions(item.reviewStatus, userRole).map(action => (
          <button 
            key={action.action}
            onClick={() => onAction(action.action, item)}
            className={`btn btn-${action.action}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
```

### 2. Review Queue Dashboard

For reviewers and partners:

```jsx
const ReviewQueue = ({ userRole, userId }) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  const fetchReviewQueue = async () => {
    try {
      const response = await fetch('/api/review/queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setQueue(data.workflows);
    } catch (error) {
      console.error('Error fetching review queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (action, item) => {
    switch (action) {
      case 'assign':
        await assignReviewer(item._id);
        break;
      case 'review':
        await performReview(item._id);
        break;
      case 'signoff':
        await signOff(item._id);
        break;
      case 'reopen':
        await reopenItem(item._id);
        break;
    }
    fetchReviewQueue(); // Refresh queue
  };

  if (loading) return <div>Loading review queue...</div>;

  return (
    <div className="review-queue">
      <h2>Review Queue</h2>
      
      <div className="queue-stats">
        <div className="stat">
          <span className="count">{queue.length}</span>
          <span className="label">Items Pending</span>
        </div>
      </div>
      
      <div className="queue-items">
        {queue.map(item => (
          <AuditItemCard
            key={item._id}
            item={item}
            userRole={userRole}
            onAction={handleReviewAction}
          />
        ))}
      </div>
    </div>
  );
};
```

### 3. Review Modal/Dialog

For performing review actions:

```jsx
const ReviewModal = ({ isOpen, onClose, action, item, onComplete }) => {
  const [comments, setComments] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;
      
      switch (action) {
        case 'submit':
          response = await fetch(`/api/review/submit/${item.itemType}/${item.itemId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              engagementId: item.engagement,
              comments
            })
          });
          break;
          
        case 'assign':
          response = await fetch(`/api/review/assign/${item._id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              reviewerId,
              comments
            })
          });
          break;
          
        case 'review':
          response = await fetch(`/api/review/perform/${item._id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              approved: true, // or false based on user selection
              comments
            })
          });
          break;
          
        case 'signoff':
          response = await fetch(`/api/review/signoff/${item._id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ comments })
          });
          break;
          
        case 'reopen':
          response = await fetch(`/api/review/reopen/${item._id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: comments })
          });
          break;
      }

      const result = await response.json();
      
      if (result.success) {
        onComplete(result.workflow);
        onClose();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error performing review action:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = () => {
    const titles = {
      'submit': 'Submit for Review',
      'assign': 'Assign Reviewer',
      'review': 'Review Item',
      'signoff': 'Sign Off',
      'reopen': 'Reopen Item'
    };
    return titles[action] || 'Review Action';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="review-modal">
        <h2>{getModalTitle()}</h2>
        
        <form onSubmit={handleSubmit}>
          {action === 'assign' && (
            <div className="form-group">
              <label>Select Reviewer:</label>
              <select 
                value={reviewerId} 
                onChange={(e) => setReviewerId(e.target.value)}
                required
              >
                <option value="">Choose a reviewer...</option>
                {/* Populate with available reviewers */}
              </select>
            </div>
          )}
          
          <div className="form-group">
            <label>Comments:</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add your comments here..."
              rows={4}
              required
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
```

### 4. Review History Component

```jsx
const ReviewHistory = ({ itemId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviewHistory();
  }, [itemId]);

  const fetchReviewHistory = async () => {
    try {
      const response = await fetch(`/api/review/history/${itemId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHistory(data.history);
    } catch (error) {
      console.error('Error fetching review history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      'submitted-for-review': '📤',
      'assigned-reviewer': '👤',
      'review-approved': '✅',
      'review-rejected': '❌',
      'signed-off': '🔒',
      'reopened': '🔓'
    };
    return icons[action] || '📝';
  };

  if (loading) return <div>Loading history...</div>;

  return (
    <div className="review-history">
      <h3>Review History</h3>
      
      <div className="history-timeline">
        {history.map((entry, index) => (
          <div key={entry._id} className="history-item">
            <div className="timeline-marker">
              <span className="icon">{getActionIcon(entry.action)}</span>
            </div>
            
            <div className="timeline-content">
              <div className="action-header">
                <span className="action">{entry.action.replace('-', ' ').toUpperCase()}</span>
                <span className="timestamp">
                  {new Date(entry.performedAt).toLocaleString()}
                </span>
              </div>
              
              <div className="action-details">
                <p><strong>Performed by:</strong> {entry.performedBy}</p>
                {entry.comments && (
                  <p><strong>Comments:</strong> {entry.comments}</p>
                )}
                {entry.previousStatus && entry.newStatus && (
                  <p>
                    <strong>Status:</strong> 
                    {entry.previousStatus} → {entry.newStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 5. Review Workflows List Component

```jsx
const ReviewWorkflowsList = ({ engagementId, filters = {} }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchWorkflows();
  }, [engagementId, currentPage, filters]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      params.append('page', currentPage);
      params.append('limit', 20);

      const url = engagementId 
        ? `/api/review/workflows/engagement/${engagementId}?${params}`
        : `/api/review/workflows?${params}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      setWorkflows(data.workflows);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'in-progress': { color: 'yellow', text: 'In Progress' },
      'ready-for-review': { color: 'blue', text: 'Ready for Review' },
      'under-review': { color: 'orange', text: 'Under Review' },
      'approved': { color: 'green', text: 'Approved' },
      'rejected': { color: 'red', text: 'Rejected' },
      'signed-off': { color: 'purple', text: 'Signed Off' },
      're-opened': { color: 'yellow', text: 'Reopened' }
    };
    
    const config = statusConfig[status] || { color: 'gray', text: status };
    
    return (
      <span className={`status-badge status-${config.color}`}>
        {config.text}
      </span>
    );
  };

  if (loading) return <div>Loading workflows...</div>;

  return (
    <div className="review-workflows-list">
      <div className="workflows-header">
        <h3>Review Workflows</h3>
        <div className="workflows-count">
          {pagination.totalCount} total workflows
        </div>
      </div>

      <div className="workflows-grid">
        {workflows.map(workflow => (
          <div key={workflow._id} className="workflow-card">
            <div className="workflow-header">
              <h4>{workflow.itemType.replace('-', ' ').toUpperCase()}</h4>
              {getStatusBadge(workflow.status)}
            </div>
            
            <div className="workflow-details">
              <p><strong>Engagement:</strong> {workflow.engagement?.title}</p>
              <p><strong>Priority:</strong> {workflow.priority}</p>
              {workflow.assignedReviewer && (
                <p><strong>Reviewer:</strong> {workflow.assignedReviewer}</p>
              )}
              {workflow.dueDate && (
                <p><strong>Due Date:</strong> {new Date(workflow.dueDate).toLocaleDateString()}</p>
              )}
            </div>

            <div className="workflow-actions">
              <button 
                className="btn btn-sm btn-primary"
                onClick={() => viewWorkflowDetails(workflow._id)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={!pagination.hasPrevPage}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </button>
          
          <span className="page-info">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          
          <button 
            disabled={!pagination.hasNextPage}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

### 6. Review History List Component

```jsx
const ReviewHistoryList = ({ engagementId, filters = {} }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchReviews();
  }, [engagementId, currentPage, filters]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.performedBy) params.append('performedBy', filters.performedBy);
      params.append('page', currentPage);
      params.append('limit', 20);

      const url = engagementId 
        ? `/api/review/engagement/${engagementId}?${params}`
        : `/api/review/history?${params}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      setReviews(data.reviews);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getActionIcon = (action) => {
    const icons = {
      'submitted-for-review': '📤',
      'assigned-reviewer': '👤',
      'review-approved': '✅',
      'review-rejected': '❌',
      'signed-off': '🔒',
      'reopened': '🔓'
    };
    return icons[action] || '📝';
  };

  if (loading) return <div>Loading review history...</div>;

  return (
    <div className="review-history-list">
      <div className="history-header">
        <h3>Review History</h3>
        <div className="history-count">
          {pagination.totalCount} total entries
        </div>
      </div>

      <div className="history-timeline">
        {reviews.map(review => (
          <div key={review._id} className="history-item">
            <div className="timeline-marker">
              <span className="icon">{getActionIcon(review.action)}</span>
            </div>
            
            <div className="timeline-content">
              <div className="action-header">
                <span className="action">{review.action.replace('-', ' ').toUpperCase()}</span>
                <span className="timestamp">
                  {new Date(review.performedAt).toLocaleString()}
                </span>
              </div>
              
              <div className="action-details">
                <p><strong>Item:</strong> {review.itemType} - {review.itemId}</p>
                <p><strong>Engagement:</strong> {review.engagement?.title}</p>
                <p><strong>Performed by:</strong> {review.performedBy}</p>
                {review.comments && (
                  <p><strong>Comments:</strong> {review.comments}</p>
                )}
                {review.previousStatus && review.newStatus && (
                  <p>
                    <strong>Status Change:</strong> 
                    {review.previousStatus} → {review.newStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={!pagination.hasPrevPage}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </button>
          
          <span className="page-info">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          
          <button 
            disabled={!pagination.hasNextPage}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

### 7. Classification Section Review Component

```jsx
const ClassificationReviewCard = ({ classification, userRole, onAction }) => {
  const getStatusColor = (status) => {
    const colors = {
      'in-progress': 'yellow',
      'ready-for-review': 'blue',
      'under-review': 'orange',
      'approved': 'green',
      'rejected': 'red',
      'signed-off': 'purple',
      're-opened': 'yellow'
    };
    return colors[status] || 'gray';
  };

  const getAvailableActions = (status, userRole) => {
    const actions = [];
    
    if (status === 'in-progress' && canSubmitForReview(userRole)) {
      actions.push({ label: 'Submit for Review', action: 'submit' });
    }
    
    if (status === 'ready-for-review' && canReview(userRole)) {
      actions.push({ label: 'Assign Reviewer', action: 'assign' });
    }
    
    if (status === 'under-review' && canReview(userRole)) {
      actions.push({ label: 'Review', action: 'review' });
    }
    
    if (status === 'approved' && canSignOff(userRole)) {
      actions.push({ label: 'Sign Off', action: 'signoff' });
    }
    
    if (status === 'signed-off' && canReopen(userRole)) {
      actions.push({ label: 'Reopen', action: 'reopen' });
    }
    
    return actions;
  };

  return (
    <div className={`classification-review-card status-${getStatusColor(classification.reviewStatus)}`}>
      <div className="card-header">
        <h3>Classification: {classification.classification}</h3>
        <span className={`status-badge ${classification.reviewStatus}`}>
          {classification.reviewStatus.replace('-', ' ').toUpperCase()}
        </span>
      </div>
      
      <div className="card-content">
        <div className="classification-details">
          <p><strong>Engagement:</strong> {classification.engagement?.title}</p>
          {classification.spreadsheetUrl && (
            <p><strong>Spreadsheet:</strong> 
              <a href={classification.spreadsheetUrl} target="_blank" rel="noopener noreferrer">
                View Spreadsheet
              </a>
            </p>
          )}
          {classification.workingPapersUrl && (
            <p><strong>Working Papers:</strong> 
              <a href={classification.workingPapersUrl} target="_blank" rel="noopener noreferrer">
                View Working Papers
              </a>
            </p>
          )}
          {classification.lastSyncAt && (
            <p><strong>Last Sync:</strong> {new Date(classification.lastSyncAt).toLocaleString()}</p>
          )}
        </div>
        
        {classification.reviewerId && (
          <div className="reviewer-info">
            <span>Assigned to: {classification.reviewerName}</span>
          </div>
        )}
        
        {classification.dueDate && (
          <div className="due-date">
            <span>Due: {new Date(classification.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      
      <div className="card-actions">
        {getAvailableActions(classification.reviewStatus, userRole).map(action => (
          <button 
            key={action.action}
            onClick={() => onAction(action.action, classification)}
            className={`btn btn-${action.action}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
```

---

## UI/UX Guidelines

### 1. Status Indicators

Use consistent colors and icons for review states:

```css
.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.status-in-progress { background: #fef3cd; color: #856404; }
.status-ready-for-review { background: #d1ecf1; color: #0c5460; }
.status-under-review { background: #ffeaa7; color: #d63031; }
.status-approved { background: #d4edda; color: #155724; }
.status-rejected { background: #f8d7da; color: #721c24; }
.status-signed-off { background: #e2e3e5; color: #383d41; }
.status-re-opened { background: #fef3cd; color: #856404; }
```

### 2. Action Buttons

Style action buttons based on their purpose:

```css
.btn-submit { background: #007bff; color: white; }
.btn-assign { background: #6c757d; color: white; }
.btn-review { background: #28a745; color: white; }
.btn-signoff { background: #6f42c1; color: white; }
.btn-reopen { background: #fd7e14; color: white; }
```

### 3. Review Queue Layout

```css
.review-queue {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px;
}

.queue-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat {
  text-align: center;
}

.stat .count {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
}

.stat .label {
  font-size: 14px;
  color: #6c757d;
}
```

### 4. Review Workflows List Layout

```css
.review-workflows-list {
  padding: 20px;
}

.workflows-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.workflows-count {
  color: #6c757d;
  font-size: 14px;
}

.workflows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.workflow-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.workflow-header h4 {
  margin: 0;
  color: #495057;
}

.workflow-details p {
  margin: 8px 0;
  font-size: 14px;
  color: #6c757d;
}

.workflow-actions {
  margin-top: 16px;
  text-align: right;
}
```

### 5. Review History List Layout

```css
.review-history-list {
  padding: 20px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.history-count {
  color: #6c757d;
  font-size: 14px;
}

.history-timeline {
  position: relative;
  padding-left: 30px;
}

.history-timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #dee2e6;
}

.history-item {
  position: relative;
  margin-bottom: 24px;
}

.timeline-marker {
  position: absolute;
  left: -22px;
  top: 0;
  width: 30px;
  height: 30px;
  background: white;
  border: 2px solid #007bff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.timeline-content {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.action {
  font-weight: bold;
  color: #495057;
}

.timestamp {
  font-size: 12px;
  color: #6c757d;
}

.action-details p {
  margin: 8px 0;
  font-size: 14px;
  color: #6c757d;
}
```

### 6. Pagination Styles

```css
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  background: white;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #007bff;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #6c757d;
}
```

### 7. Classification Review Card Styles

```css
.classification-review-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.classification-review-card.status-yellow {
  border-left: 4px solid #ffc107;
}

.classification-review-card.status-blue {
  border-left: 4px solid #007bff;
}

.classification-review-card.status-orange {
  border-left: 4px solid #fd7e14;
}

.classification-review-card.status-green {
  border-left: 4px solid #28a745;
}

.classification-review-card.status-red {
  border-left: 4px solid #dc3545;
}

.classification-review-card.status-purple {
  border-left: 4px solid #6f42c1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0;
  color: #495057;
  font-size: 18px;
}

.classification-details p {
  margin: 8px 0;
  font-size: 14px;
  color: #6c757d;
}

.classification-details a {
  color: #007bff;
  text-decoration: none;
}

.classification-details a:hover {
  text-decoration: underline;
}

.card-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
```

---

## Real-time Updates

### WebSocket Integration

```javascript
// Connect to Socket.IO
const socket = io('ws://localhost:8000');

// Join engagement room
socket.emit('joinEngagement', engagementId);

// Listen for review events
socket.on('review:submitted', (data) => {
  // Update UI to show item submitted
  updateItemStatus(data.itemId, 'ready-for-review');
  showNotification(`${data.itemType} submitted for review`);
});

socket.on('review:assigned', (data) => {
  // Update UI to show reviewer assigned
  updateItemStatus(data.itemId, 'under-review');
  showNotification(`Reviewer assigned to ${data.itemType}`);
});

socket.on('review:completed', (data) => {
  // Update UI to show review completed
  updateItemStatus(data.itemId, data.status);
  showNotification(`${data.itemType} ${data.status}`);
});

socket.on('review:signedoff', (data) => {
  // Update UI to show item signed off
  updateItemStatus(data.itemId, 'signed-off');
  showNotification(`${data.itemType} signed off`);
});

socket.on('review:reopened', (data) => {
  // Update UI to show item reopened
  updateItemStatus(data.itemId, 're-opened');
  showNotification(`${data.itemType} reopened for changes`);
});
```

---

## Error Handling

### API Error Handling

```javascript
const handleApiError = (error, response) => {
  if (response.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  } else if (response.status === 403) {
    // Show permission error
    showError('You do not have permission to perform this action');
  } else if (response.status === 404) {
    // Show not found error
    showError('Item not found');
  } else if (response.status === 400) {
    // Show validation error
    showError(response.message || 'Invalid request');
  } else {
    // Show generic error
    showError('An unexpected error occurred. Please try again.');
  }
};

const showError = (message) => {
  // Implement your error display mechanism
  console.error(message);
  // Could be toast notification, modal, etc.
};
```

### Form Validation

```javascript
const validateReviewForm = (action, formData) => {
  const errors = {};
  
  if (!formData.comments.trim()) {
    errors.comments = 'Comments are required';
  }
  
  if (action === 'assign' && !formData.reviewerId) {
    errors.reviewerId = 'Please select a reviewer';
  }
  
  if (action === 'reopen' && !formData.reason.trim()) {
    errors.reason = 'Reopen reason is required';
  }
  
  return errors;
};
```

---

## Implementation Examples

### Complete Integration Example

```jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const AuditDashboard = () => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize user and socket
    initializeUser();
    initializeSocket();
    
    // Fetch initial data
    fetchItems();
    if (['reviewer', 'partner', 'admin'].includes(user?.role)) {
      fetchReviewQueue();
    }
  }, [user]);

  const initializeUser = async () => {
    // Get user info from your auth system
    const userData = await getCurrentUser();
    setUser(userData);
  };

  const initializeSocket = () => {
    const newSocket = io('ws://localhost:8000');
    setSocket(newSocket);

    // Listen for review events
    newSocket.on('review:submitted', handleReviewEvent);
    newSocket.on('review:assigned', handleReviewEvent);
    newSocket.on('review:completed', handleReviewEvent);
    newSocket.on('review:signedoff', handleReviewEvent);
    newSocket.on('review:reopened', handleReviewEvent);

    return () => newSocket.close();
  };

  const handleReviewEvent = (data) => {
    // Update items list
    setItems(prevItems => 
      prevItems.map(item => 
        item._id === data.itemId 
          ? { ...item, reviewStatus: data.status }
          : item
      )
    );

    // Update review queue if user is reviewer/partner/admin
    if (['reviewer', 'partner', 'admin'].includes(user?.role)) {
      fetchReviewQueue();
    }

    // Show notification
    showNotification(`${data.itemType} ${data.status}`);
  };

  const handleReviewAction = (action, item) => {
    setSelectedItem(item);
    setReviewAction(action);
    setShowReviewModal(true);
  };

  const handleReviewComplete = (updatedWorkflow) => {
    // Update local state
    setItems(prevItems => 
      prevItems.map(item => 
        item._id === updatedWorkflow.itemId 
          ? { ...item, ...updatedWorkflow }
          : item
      )
    );

    // Refresh review queue
    if (['reviewer', 'partner', 'admin'].includes(user?.role)) {
      fetchReviewQueue();
    }

    setShowReviewModal(false);
  };

  return (
    <div className="audit-dashboard">
      <header className="dashboard-header">
        <h1>Audit Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user?.name}</span>
          <span className="role-badge">{user?.role}</span>
        </div>
      </header>

      <main className="dashboard-content">
        {['reviewer', 'partner', 'admin'].includes(user?.role) && (
          <section className="review-queue-section">
            <ReviewQueue 
              userRole={user.role}
              userId={user.id}
              onAction={handleReviewAction}
            />
          </section>
        )}

        <section className="audit-items-section">
          <h2>Audit Items</h2>
          <div className="items-grid">
            {items.map(item => (
              <AuditItemCard
                key={item._id}
                item={item}
                userRole={user?.role}
                onAction={handleReviewAction}
              />
            ))}
          </div>
        </section>

        <section className="review-workflows-section">
          <ReviewWorkflowsList 
            engagementId={selectedEngagementId}
            filters={{ status: 'under-review' }}
          />
        </section>

        <section className="review-history-section">
          <ReviewHistoryList 
            engagementId={selectedEngagementId}
            filters={{ action: 'review-approved' }}
          />
        </section>

        <section className="classification-review-section">
          <h2>Classification Sections</h2>
          <div className="classifications-grid">
            {classifications.map(classification => (
              <ClassificationReviewCard
                key={classification._id}
                classification={classification}
                userRole={user?.role}
                onAction={handleReviewAction}
              />
            ))}
          </div>
        </section>
      </main>

      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        action={reviewAction}
        item={selectedItem}
        onComplete={handleReviewComplete}
      />
    </div>
  );
};

export default AuditDashboard;
```

---

## Best Practices

### 1. Performance Optimization

- **Cache review queue** data to avoid unnecessary API calls
- **Implement pagination** for large lists of items
- **Use React.memo** for expensive components
- **Debounce** search and filter operations

### 2. User Experience

- **Show loading states** during API calls
- **Provide clear feedback** for all actions
- **Use consistent terminology** throughout the app
- **Implement keyboard shortcuts** for common actions

### 3. Security

- **Validate permissions** on the frontend (but always verify on backend)
- **Sanitize user input** before sending to API
- **Handle token expiration** gracefully
- **Implement proper error boundaries**

### 4. Accessibility

- **Use semantic HTML** elements
- **Provide ARIA labels** for interactive elements
- **Ensure keyboard navigation** works properly
- **Use sufficient color contrast** for status indicators

---

## Testing

### Unit Tests

```javascript
// Test permission checks
describe('Review Permissions', () => {
  test('employee can submit for review', () => {
    expect(canSubmitForReview('employee')).toBe(true);
  });

  test('client cannot review items', () => {
    expect(canReview('client')).toBe(false);
  });

  test('partner can sign off', () => {
    expect(canSignOff('partner')).toBe(true);
  });
});

// Test API calls
describe('Review API', () => {
  test('submit for review', async () => {
    const mockResponse = { success: true, workflow: mockWorkflow };
    fetch.mockResolvedValueOnce({
      json: async () => mockResponse
    });

    const result = await submitForReview('procedure', 'item123', 'engagement456', 'comments');
    expect(result).toEqual(mockResponse);
  });
});
```

### Integration Tests

```javascript
// Test complete workflow
describe('Review Workflow', () => {
  test('complete review process', async () => {
    // 1. Submit for review
    await submitForReview('procedure', 'item123', 'engagement456', 'comments');
    
    // 2. Assign reviewer
    await assignReviewer('workflow123', 'reviewer456', 'comments');
    
    // 3. Perform review
    await performReview('workflow123', true, 'approved');
    
    // 4. Sign off
    await signOff('workflow123', 'final approval');
    
    // Verify final state
    const workflow = await getWorkflow('workflow123');
    expect(workflow.status).toBe('signed-off');
    expect(workflow.isLocked).toBe(true);
  });
});
```

---

## Conclusion

This integration guide provides everything needed to implement the Review & Sign-Off system in your frontend application. The system ensures ISQM compliance while providing a smooth user experience for all audit team members.

Key takeaways:
- **Implement role-based permissions** throughout the UI
- **Use consistent status indicators** and colors
- **Handle real-time updates** via WebSocket
- **Provide clear feedback** for all actions
- **Maintain audit trails** for compliance
- **Test thoroughly** to ensure reliability

For additional support or questions, refer to the API documentation or contact the development team.
