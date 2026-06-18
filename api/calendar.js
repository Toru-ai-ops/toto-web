'use strict';
const { getAccessToken } = require('./_auth');

const BASE = 'https://www.googleapis.com/calendar/v3';

async function gcal(token, path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  if (method === 'DELETE') return null;
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Google Calendar API error');
  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAccessToken();
    if (!token) return res.status(401).json({ error: 'not_authorized' });

    if (req.method === 'GET') {
      const calList = await gcal(token, '/users/me/calendarList');
      const now = encodeURIComponent(new Date().toISOString());
      const allEvents = [];

      await Promise.all((calList.items || []).map(async (cal) => {
        try {
          const r = await gcal(token,
            `/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${now}&maxResults=20&singleEvents=true&orderBy=startTime`
          );
          for (const ev of r.items || []) allEvents.push({ ...ev, calendarId: cal.id });
        } catch {}
      }));

      allEvents.sort((a, b) =>
        (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || '')
      );
      return res.json(allEvents.slice(0, 30));
    }

    if (req.method === 'POST') {
      const { calendarId = 'primary', ...eventData } = req.body;
      const ev = await gcal(token, `/calendars/${encodeURIComponent(calendarId)}/events`, 'POST', eventData);
      return res.json(ev);
    }

    if (req.method === 'PATCH') {
      const { id, calendarId = 'primary' } = req.query;
      const ev = await gcal(token, `/calendars/${encodeURIComponent(calendarId)}/events/${id}`, 'PUT', req.body);
      return res.json(ev);
    }

    if (req.method === 'DELETE') {
      const { id, calendarId = 'primary' } = req.query;
      await gcal(token, `/calendars/${encodeURIComponent(calendarId)}/events/${id}`, 'DELETE');
      return res.status(204).end();
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
