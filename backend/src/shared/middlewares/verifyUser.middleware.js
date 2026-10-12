// Zero Trust boundary for the backend: it must never validate JWTs itself.
// It only trusts that the Gateway has already done so and injected this header.
function verifyUser(req, res, next) {
  const verifiedUser = req.header('X-Verified-User');
  if (!verifiedUser) {
    return res.status(403).json({ error: 'Forbidden: missing verified identity' });
  }
  req.verifiedUser = verifiedUser;
  next();
}

export default verifyUser;
