const createAuditLog = require('../services/auditLog');
const logger = require('../config/logger');

const getAuditEvent = (req, responseBody) => {
  const method = req.method.toUpperCase();
  const route = `${req.baseUrl}${req.route?.path || req.path}`;
  const id = Number(req.params.id) || null;
  const responseData = responseBody?.data || {};
  const responseEntity = responseData.lending_record
    || responseData.reservation
    || responseData.book
    || responseData.copy
    || responseData.category
    || responseData.user;

  const event = {
    action: '',
    entityType: null,
    entityId: Number(responseEntity?.id) || id,
    description: ''
  };

  if (route === '/api/books' && method === 'POST') {
    Object.assign(event, { action: 'CREATE_BOOK', entityType: 'book', description: `Created book "${req.body.title || ''}"` });
  } else if (route === '/api/books/:id' && method === 'PUT') {
    Object.assign(event, { action: 'UPDATE_BOOK', entityType: 'book', description: `Updated book ${id}` });
  } else if (route === '/api/books/:id' && method === 'DELETE') {
    Object.assign(event, { action: 'DELETE_BOOK', entityType: 'book', description: `Deleted book ${id}` });
  } else if (route === '/api/books/:id/copies' && method === 'POST') {
    Object.assign(event, { action: 'ADD_BOOK_COPY', entityType: 'book_copy', description: `Added a copy to book ${id}` });
  } else if (route === '/api/books/:id/copies/:copyId/status' && method === 'PUT') {
    Object.assign(event, {
      action: 'UPDATE_COPY_STATUS',
      entityType: 'book_copy',
      entityId: Number(req.params.copyId) || null,
      description: `Updated copy ${req.params.copyId} status to ${req.body.status || ''}`
    });
  } else if (route === '/api/categories' && method === 'POST') {
    Object.assign(event, { action: 'CREATE_CATEGORY', entityType: 'category', description: `Created category "${req.body.name || ''}"` });
  } else if (route === '/api/categories/:id' && method === 'PUT') {
    Object.assign(event, { action: 'UPDATE_CATEGORY', entityType: 'category', description: `Updated category ${id}` });
  } else if (route === '/api/categories/:id' && method === 'DELETE') {
    Object.assign(event, { action: 'DELETE_CATEGORY', entityType: 'category', description: `Deleted category ${id}` });
  } else if (route === '/api/lending/borrow' && method === 'POST') {
    Object.assign(event, {
      action: 'BORROW_REQUEST',
      entityType: 'lending',
      entityId: Number(responseData.lending_record?.id) || null,
      description: `Requested to borrow book ${req.body.book_id}`
    });
  } else if (route === '/api/lending/:id/approve' && method === 'PUT') {
    Object.assign(event, { action: 'APPROVE_BORROW_REQUEST', entityType: 'lending', description: `Approved borrow request ${id}` });
  } else if (route === '/api/lending/:id/reject' && method === 'PUT') {
    Object.assign(event, { action: 'REJECT_BORROW_REQUEST', entityType: 'lending', description: `Rejected borrow request ${id}` });
  } else if (route === '/api/lending/return' && method === 'POST') {
    Object.assign(event, {
      action: 'RETURN_BOOK',
      entityType: 'lending',
      entityId: Number(req.body.lending_id) || null,
      description: `Returned lending record ${req.body.lending_id}`
    });
  } else if (route === '/api/lending/:id/renew' && method === 'POST') {
    Object.assign(event, { action: 'RENEW_LOAN', entityType: 'lending', description: `Renewed lending record ${id}` });
  } else if (route === '/api/reservations' && method === 'POST') {
    Object.assign(event, {
      action: 'CREATE_RESERVATION',
      entityType: 'reservation',
      entityId: Number(responseData.reservation?.id) || null,
      description: `Created reservation for book ${req.body.book_id}`
    });
  } else if (route === '/api/reservations/:id' && method === 'DELETE') {
    Object.assign(event, { action: 'CANCEL_RESERVATION', entityType: 'reservation', description: `Cancelled reservation ${id}` });
  } else if (route === '/api/reservations/:id/fulfill' && method === 'PUT') {
    Object.assign(event, { action: 'FULFILL_RESERVATION', entityType: 'reservation', description: `Fulfilled reservation ${id}` });
  } else if (route === '/api/users/:id/status' && method === 'PUT') {
    Object.assign(event, { action: 'UPDATE_MEMBER', entityType: 'user', description: `Updated member ${id}` });
  } else if (route === '/api/notifications/:id/read' && method === 'PUT') {
    Object.assign(event, { action: 'MARK_NOTIFICATION_READ', entityType: 'notification', description: `Marked notification ${id} as read` });
  } else {
    return null;
  }

  return event;
};

const auditActivity = (req, res, next) => {
  const sendJson = res.json.bind(res);

  res.json = (body) => {
    const event = req.user?.id && res.statusCode < 400 && body?.success
      ? getAuditEvent(req, body)
      : null;

    if (!event) {
      return sendJson(body);
    }

    createAuditLog(req.user.id, event.action, event.entityType, event.entityId, event.description)
      .then(() => sendJson(body))
      .catch((error) => {
        logger.error('Audit activity capture failed:', error);
        sendJson(body);
      });
    return res;
  };

  next();
};

module.exports = auditActivity;
