const OPEN_MS = 20000;
const openUntil = new Map();
const lastEventAt = new Map();

function key(userId) {
  const id = Number(userId);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export function notePresence(userId, open, at) {
  const id = key(userId);
  if (!id) return;
  const when = Number(at) || Date.now();
  const previous = lastEventAt.get(id) || 0;
  if (when < previous) return;
  lastEventAt.set(id, when);
  if (open) openUntil.set(id, Date.now() + OPEN_MS);
  else openUntil.delete(id);
}

export function markChatOpen(userId) {
  notePresence(userId, true, Date.now());
}

export function markChatClosed(userId) {
  notePresence(userId, false, Date.now());
}

export function isChatOpen(userId) {
  const id = key(userId);
  const until = openUntil.get(id);
  if (!until) return false;
  if (until < Date.now()) {
    openUntil.delete(id);
    return false;
  }
  return true;
}
