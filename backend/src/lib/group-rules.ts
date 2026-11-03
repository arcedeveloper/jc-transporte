import { prisma } from './prisma.js';
import { businessToday } from '../config/business.js';

/** "2026-10-28" + n días → "2026-11-02" */
export function addDaysStr(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Reglas del viaje grupal a medida (se cambian en Admin → Ajustes) */
export async function groupRules() {
  const s = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { groupMinPeople: true, groupMaxPeople: true, groupMinDays: true },
  });
  const minPeople = s?.groupMinPeople ?? 12;
  const maxPeople = Math.max(minPeople, s?.groupMaxPeople ?? 17);
  const minDays = s?.groupMinDays ?? 5;
  return { minPeople, maxPeople, minDays, earliestDate: addDaysStr(businessToday(), minDays) };
}
