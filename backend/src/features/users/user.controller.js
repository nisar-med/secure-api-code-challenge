import * as userService from './user.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Controllers translate HTTP to service calls: validate input, pick the
// status code, shape the response. No data access happens here.
export function list(req, res) {
  res.json(userService.listUsers());
}

export function getById(req, res) {
  const user = userService.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}

export function create(req, res) {
  const { name, email } = req.body || {};
  if (!name || typeof name !== 'string' || !email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'name and a valid email are required' });
  }
  res.status(201).json(userService.createUser({ name, email }));
}

export function update(req, res) {
  if (!userService.getUser(req.params.id)) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { name, email } = req.body || {};
  if (name === undefined && email === undefined) {
    return res.status(400).json({ error: 'At least one of name or email is required' });
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }
  if (email !== undefined && (typeof email !== 'string' || !EMAIL_RE.test(email))) {
    return res.status(400).json({ error: 'email must be a valid email address' });
  }
  res.json(userService.updateUser(req.params.id, { name, email }));
}

export function remove(req, res) {
  const deleted = userService.deleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  res.json(deleted);
}
