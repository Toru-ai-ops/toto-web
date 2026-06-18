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
      .from('accounting')
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
      const { type, amount, category, note, date } = req.body;
      if (!amount || !date) return res.status(400).json({ error: 'amount and date are required' });
      const { error } = await supabase.from('accounting').insert([{
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: type || 'expense',
        amount: parseFloat(amount),
        category: category || '其他',
        note: note || '',
        date,
        createdAt: new Date().toISOString(),
      }]);
      if (error) throw error;
      return res.json(await getAll());
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const { error } = await supabase.from('accounting').delete().eq('id', id);
      if (error) throw error;
      return res.json(await getAll());
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
