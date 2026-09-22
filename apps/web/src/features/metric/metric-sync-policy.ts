export function hasContinuousHistory(
  changes: { oldVersion: number; newVersion: number }[],
  fromVersion: number,
  throughVersion: number
) {
  let previousVersion = fromVersion;
  for (const change of changes) {
    if (change.oldVersion !== previousVersion || change.newVersion !== previousVersion + 1) return false;
    previousVersion = change.newVersion;
  }
  return previousVersion === throughVersion;
}
