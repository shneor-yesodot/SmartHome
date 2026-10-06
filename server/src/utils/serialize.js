export function serialize(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  if (obj._id) obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  delete obj.password;
  delete obj.otpHash;
  delete obj.otpExpires;
  delete obj.resetTokenHash;
  delete obj.resetExpires;
  delete obj.refreshTokens;
  if (obj.created_by_id) obj.created_by_id = String(obj.created_by_id);
  if (obj.date instanceof Date) obj.date = obj.date.toISOString().slice(0, 10);
  if (obj.start_date instanceof Date) obj.start_date = obj.start_date.toISOString().slice(0, 10);
  if (obj.next_execution instanceof Date) obj.next_execution = obj.next_execution.toISOString().slice(0, 10);
  if (obj.last_executed instanceof Date) obj.last_executed = obj.last_executed.toISOString().slice(0, 10);
  return obj;
}

export function serializeMany(docs) {
  return (docs || []).map(serialize);
}

export function parseSort(sort) {
  if (!sort) return { created_date: -1 };
  const desc = String(sort).startsWith('-');
  const field = desc ? String(sort).slice(1) : String(sort);
  const allowed = new Set([
    'date',
    'amount',
    'created_date',
    'updated_date',
    'next_execution',
    'name',
    'category',
  ]);
  if (!allowed.has(field)) return { created_date: -1 };
  return { [field]: desc ? -1 : 1 };
}
