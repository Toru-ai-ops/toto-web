'use strict';
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');

async function getAccessToken() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data } = await supabase.from('tokens').select('*').eq('id', 'user').single();
  if (!data?.refresh_token) return null;

  const oauth2 = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2.setCredentials({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expiry_date:   data.expiry_date,
  });

  const { token } = await oauth2.getAccessToken();
  if (token && token !== data.access_token) {
    await supabase.from('tokens').update({
      access_token: token,
      expiry_date:  Date.now() + 3540 * 1000,
    }).eq('id', 'user');
  }
  return token;
}

module.exports = { getAccessToken };
