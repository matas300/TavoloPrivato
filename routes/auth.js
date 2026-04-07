const express = require('express');
const router = express.Router();
const db = require('../data/mock');

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role === 'admin' ? 'admin' : req.session.user.role}/dashboard`);
  }
  res.render('pages/public/login', { title: 'Accedi', error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.getUserByEmail(email);
  if (!user || user.password !== password) {
    return res.render('pages/public/login', { title: 'Accedi', error: 'Credenziali non valide. Usa le credenziali demo.' });
  }
  if (user.status === 'suspended') {
    return res.render('pages/public/login', { title: 'Accedi', error: 'Account sospeso. Contatta l’amministrazione.' });
  }
  // Store safe user data in session (no password)
  const { password: _, ...safeUser } = user;
  req.session.user = safeUser;
  const dest = user.role === 'admin' ? '/admin/dashboard' : `/${user.role}/dashboard`;
  res.redirect(dest);
});

router.get('/register', (req, res) => {
  const requestedRole = req.query.role === 'ristorante' ? 'ristorante' : 'cameriere';
  const prefillScenario = req.session.prefillRegistrationScenario || null;
  const selectedRole = prefillScenario ? prefillScenario.role : requestedRole;

  res.render('pages/public/register', {
    title: 'Registrati',
    selectedRole,
    prefillScenario
  });
});

router.post('/register', (req, res) => {
  // Simulated registration — redirect to login
  res.redirect('/login?registered=1');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
