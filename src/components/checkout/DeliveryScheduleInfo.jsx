import React from 'react';
import { Clock } from 'lucide-react';

const DAY_NAMES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const MONTHS_FR = [
  'jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'
];

function formatDate(date) {
  const d = date.getDate();
  const m = MONTHS_FR[date.getMonth()];
  return `${d} ${m}`;
}

function parseSlot(slot) {
  const parts = slot.split('-');
  if (parts.length >= 2) {
    return { start: parts[0].trim(), end: parts[1].trim() };
  }
  return null;
}

function isCurrentlyInSlot(slot) {
  const parsed = parseSlot(slot);
  if (!parsed) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = parsed.start.split(':').map(Number);
  const [endH, endM] = parsed.end.split(':').map(Number);
  return currentMinutes >= (startH * 60 + (startM || 0)) && currentMinutes < (endH * 60 + (endM || 0));
}

function slotNotPassed(slot) {
  const parsed = parseSlot(slot);
  if (!parsed) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [endH, endM] = parsed.end.split(':').map(Number);
  return currentMinutes < (endH * 60 + (endM || 0));
}

/**
 * Get the single next available delivery date respecting min_days_before_delivery.
 */
function getNextDelivery(schedule, minDays = 0) {
  const now = new Date();

  for (let offset = 0; offset <= 30; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);

    const dayName = DAY_NAMES_FR[candidate.getDay()];
    const entry = schedule.find(d => d.day === dayName);
    if (!entry) continue;

    // Respect min_days_before_delivery
    if (offset < minDays) continue;

    const slots = entry.time_slots || [];
    const isToday = offset === 0;

    // For today, filter out passed slots
    let availableSlots = slots;
    if (isToday) {
      availableSlots = slots.filter(slotNotPassed);
      if (slots.length > 0 && availableSlots.length === 0) continue;
    }

    // Build label
    let label;
    if (isToday) label = "Aujourd'hui";
    else if (offset === 1) label = 'Demain';
    else if (offset === 2) label = 'Après-demain';
    else label = dayName;

    return { label, date: candidate, dateStr: formatDate(candidate), slots: availableSlots, isToday, offset };
  }

  return null;
}

export default function DeliveryScheduleInfo({ zone }) {
  const minDays = zone.min_days_before_delivery ?? 0;
  const next = getNextDelivery(zone.delivery_schedule || [], minDays);

  if (!next) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4" />
        Prochaine livraison disponible
      </p>

      <div className={`rounded-lg px-4 py-3 flex items-center justify-between gap-2 ${
        next.isToday ? 'bg-emerald-100 border border-emerald-300' : 'bg-white border border-emerald-100'
      }`}>
        {/* Date + label */}
        <div className="flex items-center gap-2">
          {next.offset >= 2 && (
            <span className="text-base font-bold text-slate-900">{next.dateStr}</span>
          )}
          <span className={`text-base font-bold ${next.isToday ? 'text-emerald-700' : 'text-slate-800'}`}>
            {next.label}
          </span>
          {next.isToday && (
            <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
              En cours
            </span>
          )}
        </div>

        {/* Slots */}
        <div className="flex flex-wrap gap-1 justify-end">
          {next.slots.length > 0 ? (
            next.slots.map((slot, j) => {
              const active = next.isToday && isCurrentlyInSlot(slot);
              return (
                <span
                  key={j}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                    active ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {active && '🟢 '}{slot}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-emerald-600 italic">Journée entière</span>
          )}
        </div>
      </div>
    </div>
  );
}