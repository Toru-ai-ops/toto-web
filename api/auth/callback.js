'use strict';
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=missing_code');

  try {
    const oauth2 = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const { tokens } = await oauth2.getToken(code);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data: existing } = await supabase.from('tokens').select('refresh_token').eq('id', 'user').single();

    await supabase.from('tokens').upsert({
      id: 'user',
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      expiry_date:   tokens.expiry_date || null,
    });

    res.redirect('/');
  } catch (e) {
    res.redirect('/?error=auth_failed');
  }
};
