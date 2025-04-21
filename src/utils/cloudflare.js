import fetch from 'node-fetch';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID; // zone id for ctfgui.de
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // token with DNS edit

if (!CF_ZONE_ID || !CF_API_TOKEN) {
  throw new Error('Cloudflare API token and zone ID must be set in env');
}

/**
 * Create or update a DNS record in Cloudflare
 * @param {string} subdomain - e.g. 'testdeploy-abc123'
 * @param {string} target - e.g. public hostname or tunnel CNAME
 * @param {string} type - 'CNAME' or 'A'
 * @returns {Promise<string>} The full domain name
 */
export async function createCloudflareDNS(subdomain, target, type = 'CNAME') {
  const name = `${subdomain}.ctfgui.de`;

  // Check for existing record
  let existingId = null;
  const listResp = await fetch(`${CF_API_BASE}/zones/${CF_ZONE_ID}/dns_records?name=${name}`,
    { headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` } });
  const listData = await listResp.json();
  if (listData.result && listData.result.length > 0) {
    existingId = listData.result[0].id;
  }

  const payload = {
    
    type,
    name,
    content: target,
    ttl: 120,
    proxied: true
  };

  let resp, data;
  if (existingId) {
    resp = await fetch(`${CF_API_BASE}/zones/${CF_ZONE_ID}/dns_records/${existingId}`,
      { method: 'PUT', headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    data = await resp.json();
  } else {
    resp = await fetch(`${CF_API_BASE}/zones/${CF_ZONE_ID}/dns_records`,
      { method: 'POST', headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    data = await resp.json();
  }
  if (!data.success) {
    throw new Error('Cloudflare DNS error: ' + JSON.stringify(data.errors));
  }
  return name;
}
