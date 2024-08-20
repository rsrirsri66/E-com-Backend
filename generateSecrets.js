//generatesecrets.js
const crypto = require('crypto');

const jwtSecret = crypto.randomBytes(32).toString('base64');
const sessionSecret = crypto.randomBytes(32).toString('base64');

console.log('JWT Secret:', jwtSecret);
console.log('Session Secret:', sessionSecret);
