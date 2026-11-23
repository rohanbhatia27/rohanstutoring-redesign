function supabaseHeaders(key) {
  return key.startsWith('sb_secret_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}
module.exports = supabaseHeaders;
