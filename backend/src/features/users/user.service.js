import crypto from 'node:crypto';

// In-memory store. The service owns the data; nothing here knows about HTTP.
let users = [
  { id: crypto.randomUUID(), name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: crypto.randomUUID(), name: 'Alan Turing', email: 'alan@example.com' },
];

export function listUsers() {
  return users;
}

export function getUser(id) {
  return users.find((u) => u.id === id);
}

export function createUser({ name, email }) {
  const user = { id: crypto.randomUUID(), name, email };
  users.push(user);
  return user;
}

// Applies only the fields that were provided. Returns undefined if not found.
export function updateUser(id, { name, email }) {
  const user = getUser(id);
  if (!user) return undefined;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  return user;
}

// Returns the removed user, or undefined if not found.
export function deleteUser(id) {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return undefined;
  const [deleted] = users.splice(index, 1);
  return deleted;
}

// Replaces the store contents; used by tests to start from a known state.
export function resetUsers(seed = []) {
  users = seed;
}
