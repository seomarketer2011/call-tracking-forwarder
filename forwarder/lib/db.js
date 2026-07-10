// D1 query helpers shared across functions/*.

export async function findDestinationForCaller(db, callerNumber) {
  const mapping = await db
    .prepare('SELECT destination_id FROM caller_mappings WHERE caller_number = ?')
    .bind(callerNumber)
    .first();
  if (!mapping) return null;

  return db
    .prepare('SELECT * FROM destinations WHERE id = ? AND enabled = 1')
    .bind(mapping.destination_id)
    .first();
}

// Picks the least-recently-used enabled destination, assigns it to the
// caller (sticky), and bumps its last_used_at so the next new caller
// round-robins to a different destination.
//
// The upsert (ON CONFLICT) matters for one case: a caller who was previously
// stuck to a destination that has since been disabled. findDestinationForCaller
// returns null for them (it filters on enabled = 1), so they land here with a
// stale mapping row already present. We re-point them to an active destination
// and overwrite the mapping instead of crashing on the primary-key conflict.
export async function assignRoundRobinDestination(db, callerNumber) {
  const destination = await db
    .prepare(
      `SELECT * FROM destinations
       WHERE enabled = 1
       ORDER BY last_used_at IS NOT NULL, last_used_at ASC, id ASC
       LIMIT 1`
    )
    .first();
  if (!destination) return null;

  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare('UPDATE destinations SET last_used_at = ? WHERE id = ?')
      .bind(now, destination.id),
    db
      .prepare(
        `INSERT INTO caller_mappings (caller_number, destination_id, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(caller_number) DO UPDATE SET
           destination_id = excluded.destination_id,
           created_at = excluded.created_at`
      )
      .bind(callerNumber, destination.id, now),
  ]);

  return destination;
}

export async function getSetting(db, key) {
  const row = await db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .bind(key)
    .first();
  return row ? row.value : null;
}

export async function setSetting(db, key, value) {
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, value, new Date().toISOString())
    .run();
}

export async function logCall(db, { direction, from, to, callSid, status }) {
  await db
    .prepare(
      'INSERT INTO call_log (direction, from_number, to_number, call_sid, status) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(direction, from ?? null, to ?? null, callSid ?? null, status ?? null)
    .run();
}
