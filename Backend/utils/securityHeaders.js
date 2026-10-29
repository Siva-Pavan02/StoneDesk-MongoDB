const { randomBytes } = require('node:crypto');

function generateNonce() {
  return randomBytes(16).toString('base64');
}

module.exports = (req, res, next) => {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;

  const isApiRoute = req.path.startsWith('/api/');
  const isUploadsRoute = req.path.startsWith('/uploads/');

  if (isApiRoute || isUploadsRoute) {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
  } else {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
  }
  next();
};

module.exports.generateNonce = generateNonce;