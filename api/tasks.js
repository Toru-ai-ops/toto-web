'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const getAll = async () => {
    const { data, error } = await supabase
      .from('tasks').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  try {
    if (req.method === 'GET') {
      return res.json(await getAll());
    }

    if (req.method === 'POST') {
      const { text, category } = req.body;
      if (!text) return res.status(400).json({ error: 'text is required' });
      const { error } = await supabase.from('tasks').insert([{
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        text,
        category: category || '個人待辦',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      }]);
      if (error) throw error;
      return res.json(await getAll());
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { data: task, error: ferr } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (ferr) throw ferr;
      const completed = !task.completed;
      const { error } = await supabase.from('tasks').update({
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
      return res.json(await getAll());
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return res.json(await getAll());
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
