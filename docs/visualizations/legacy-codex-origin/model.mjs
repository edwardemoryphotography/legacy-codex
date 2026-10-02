export function clampIndex(index, length) {
  return Math.max(0, Math.min(Math.max(0, length - 1), Math.floor(Number(index) || 0)));
}

export function visibleDomains(milestones, index) {
  return [...new Set(milestones.slice(0, clampIndex(index, milestones.length) + 1).flatMap(m => m.domains))];
}

export function findMilestones(milestones, query = '', domain = '') {
  const text = query.trim().toLowerCase();
  return milestones.filter(m => (!domain || m.domains.includes(domain)) &&
    `${m.title} ${m.summary} ${m.meaning} ${m.era} ${m.date} ${m.domains.join(' ')}`.toLowerCase().includes(text));
}

export function nextIndex(index, length) {
  return { index: clampIndex(index + 1, length), ended: index >= length - 1 };
}

export function parseChapter(hash, milestones) {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('chapter');
  const index = milestones.findIndex(m => m.id === id);
  return index < 0 ? milestones.length - 1 : index;
}
