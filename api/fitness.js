'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const getAll = async () => {
    const { data, error } = await supabase
      .from('fitness')
      .select('*')
      .order('date', { ascending: false })
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  try {
    if (req.method === 'GET') {
      return res.json(await getAll());
    }

    if (req.method === 'POST') {
      const { date, exercise, sets, reps, weight, note } = req.body;
      if (!date || !exercise) return res.status(400).json({ error: 'date and exercise are required' });
      const { error } = await supabase.from('fitness').insert([{
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date,
        exercise,
        sets:   sets   ? parseInt(sets)      : null,
        reps:   reps   ? parseInt(reps)      : null,
        weight: weight ? parseFloat(weight)  : null,
        note: note || '',
        createdAt: new Date().toISOString(),
      }]);
      if (error) throw error;
      return res.json(await getAll());
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const { error } = await supabase.from('fitness').delete().eq('id', id);
      if (error) throw error;
      return res.json(await getAll());
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
