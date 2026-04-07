function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).render('pages/public/access-denied', {
        title: 'Accesso Negato',
        currentUser: req.session.user
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
