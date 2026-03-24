import http from 'http';

const data = JSON.stringify({
  name: "T-Test",
  zoneId: "cmmxy7lo2000213sbz1zryq3h", // Hardcoded from typical cuid length but we just need it to hit the token or fail
  x: 50,
  y: 50
});

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/venue/tables',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
