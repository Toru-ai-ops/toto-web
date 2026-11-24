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
      .from('subscriptions')
      .select('*')
      .order('billingDay', { ascending: true })
      .order('createdAt', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  try {
    if (req.method === 'GET') {
      return res.json(await getAll());
    }

    if (req.method === 'POST') {
      const { name, amount, billingDay, cycle, billingMonth } = req.body;
      const mon = parseInt(billingMonth, 10);
      const amt = parseFloat(amount);
      const day = parseInt(billingDay, 10);
      if (!name || !name.trim() || !(amt > 0)) {
        return res.status(400).json({ error: 'name and amount are required' });
      }
      const { error } = await supabase.from('subscriptions').insert([{
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: name.trim(),
        amount: amt,
        cycle: cycle === 'year' ? 'year' : 'month',
        billingMonth: cycle === 'year' && mon >= 1 && mon <= 12 ? mon : null,
        billingDay: day >= 1 && day <= 31 ? day : 1,
        createdAt: new Date().toISOString(),
      }]);
      if (error) throw error;
      return res.json(await getAll());
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const { error } = await supabase.from('subscriptions').delete().eq('id', id);
      if (error) throw error;
      return res.json(await getAll());
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
