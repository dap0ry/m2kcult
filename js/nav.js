const navHamburgerBtn = document.getElementById('navHamburgerBtn');
const mobileNavOverlay = document.getElementById('mobileNavOverlay');
const mobileNavCloseBtn = document.getElementById('mobileNavCloseBtn');

function openMobileNav() {
  mobileNavOverlay.classList.add('open');
  navHamburgerBtn.setAttribute('aria-expanded', 'true');
}

function closeMobileNav() {
  mobileNavOverlay.classList.remove('open');
  navHamburgerBtn.setAttribute('aria-expanded', 'false');
}

navHamburgerBtn.addEventListener('click', openMobileNav);
mobileNavCloseBtn.addEventListener('click', closeMobileNav);

mobileNavOverlay.addEventListener('click', (e) => {
  if (e.target === mobileNavOverlay) closeMobileNav();
});

// ── Account Modal ──
const ACCOUNT_NAME_KEY = 'mk2cult_user_name';
const ACCOUNT_EMAIL_KEY = 'mk2cult_user_email';

const accountModalOverlay = document.getElementById('accountModalOverlay');
const accountModalCloseBtn = document.getElementById('accountModalCloseBtn');
const accountModalLogout = document.getElementById('accountModalLogout');
const accountModalName = document.getElementById('accountModalName');
const accountModalEmail = document.getElementById('accountModalEmail');

function openAccountModal() {
  accountModalName.textContent = localStorage.getItem(ACCOUNT_NAME_KEY) || '';
  accountModalEmail.textContent = localStorage.getItem(ACCOUNT_EMAIL_KEY) || '';
  accountModalOverlay.classList.add('open');
}

function closeAccountModal() {
  accountModalOverlay.classList.remove('open');
}

document.querySelectorAll('.account-trigger').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (localStorage.getItem(ACCOUNT_NAME_KEY)) {
      e.preventDefault();
      closeMobileNav();
      openAccountModal();
    }
  });
});

accountModalCloseBtn.addEventListener('click', closeAccountModal);

accountModalLogout.addEventListener('click', () => {
  localStorage.removeItem(ACCOUNT_NAME_KEY);
  localStorage.removeItem(ACCOUNT_EMAIL_KEY);
  closeAccountModal();
  window.location.href = 'index.html';
});

accountModalOverlay.addEventListener('click', (e) => {
  if (e.target === accountModalOverlay) closeAccountModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMobileNav();
    closeAccountModal();
  }
});
