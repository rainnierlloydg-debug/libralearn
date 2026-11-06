// Store record revisions only; book titles and other personal details stay out of storage.
export function createTabSnapshot(records, total = records.length) {
  return {
    total,
    revisions: records.map(record => [
      record.id, record.status, record.updated_at ?? null,
      record.due_date ?? null, record.renewal_requested_at ?? null,
      record.pickup_deadline ?? null,
    ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  };
}

export function hasUnseenTabUpdates(snapshot, seenSnapshot) {
  return snapshot.total > 0 && JSON.stringify(snapshot) !== JSON.stringify(seenSnapshot);
}
