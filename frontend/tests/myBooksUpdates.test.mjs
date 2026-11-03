import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTabSnapshot, hasUnseenTabUpdates } from '../src/utils/myBooksUpdates.js';

test('unvisited tabs light up only when they contain records', () => {
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([])), false);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([{ id: 1, status: 'pending' }])), true);
});

test('viewing a snapshot keeps its indicator off after storage round trip', () => {
  const snapshot = createTabSnapshot([{ id: 1, status: 'pending' }]);
  const stored = JSON.parse(JSON.stringify(snapshot));
  assert.equal(hasUnseenTabUpdates(snapshot, stored), false);
});

test('a status change relights the tab even when its record count is unchanged', () => {
  const seen = createTabSnapshot([{ id: 1, status: 'pending' }]);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([{ id: 1, status: 'approved' }]), seen), true);
});

test('a new record or changed total relights a previously visited tab', () => {
  const seen = createTabSnapshot([{ id: 1, status: 'borrowed' }]);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([{ id: 2, status: 'borrowed' }]), seen), true);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([{ id: 1, status: 'borrowed' }], 2), seen), true);
});

test('due date and pickup changes relight the tab', () => {
  const record = { id: 1, status: 'borrowed', due_date: '2026-10-20' };
  const seen = createTabSnapshot([record]);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([{ ...record, due_date: '2026-10-27' }]), seen), true);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([{ ...record, pickup_deadline: '2026-10-25' }]), seen), true);
});

test('record order changes do not relight a tab or mutate the response', () => {
  const records = [{ id: 2, status: 'returned' }, { id: 1, status: 'returned' }];
  const seen = createTabSnapshot(records);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([...records].reverse()), seen), false);
  assert.equal(records[0].id, 2);
});

test('empty tabs never light up after their records are removed', () => {
  const seen = createTabSnapshot([{ id: 1, status: 'pending' }]);
  assert.equal(hasUnseenTabUpdates(createTabSnapshot([]), seen), false);
});
