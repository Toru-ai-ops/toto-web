'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('notes').select('*').order('page');
      if (error) throw error;
      return res.json(data || []);
    }

    if (req.method === 'PUT') {
      const { page, content } = req.body;
      const { error } = await supabase.from('notes').upsert({
        page,
        content: content || '',
        updatedAt: new Date().toISOString(),
      });
      if (error) throw error;
      return res.status(204).end();
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
