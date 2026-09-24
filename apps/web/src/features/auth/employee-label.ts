export function employeeDisplayName(person: { name: string | null; username: string; employeeNumber: string }) {
  if (person.name) return person.name;
  return person.username.startsWith(`pending-${person.employeeNumber}-`) ? "未注册员工" : person.username;
}
