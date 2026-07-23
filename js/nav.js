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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileNav();
});
