const https = require('https');
const url = 'https://affiliate.nykaa.com/v2/get_product_widget?ad_id=69e396f0e9519f9470a1790d&add_resources=True&affiliate_id=Anshuvis-106980&product_id=403564&store=nykaa&text_color=000000&theme_variation=TEXT_AND_IMAGE&theme=affiliate&aff_link_type=affiliate%3Anap_dashboard%3Aproduct';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } }, res => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Data length:', data.length, 'Content preview:', data.substring(0, 200)));
});
