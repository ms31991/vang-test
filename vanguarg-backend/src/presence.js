const OPEN_MS = 20000;
const openUntil = new Map();
const mailedWhileAway = new Set();

export function markChatOpen(userId) {
  openUntil.set(userId, Date.now() + OPEN_MS);
  mailedWhileAway.delete(userId);
}

export function markChatClosed(userId) {
  openUntil.delete(userId);
}

export function isChatOpen(userId) {
  const until = openUntil.get(userId);
  if (!until) return false;
  if (until < Date.now()) {
    openUntil.delete(userId);
    return false;
  }
  return true;
}

export function alreadyMailedWhileAway(userId) {
  return mailedWhileAway.has(userId);
}

export function markMailedWhileAway(userId) {
  mailedWhileAway.add(userId);
}

export function clearMailedWhileAway(userId) {
  mailedWhileAway.delete(userId);
}
