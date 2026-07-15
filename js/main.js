// ── Popup ──
const overlay = document.getElementById('popupOverlay');

function closePopup() {
  overlay.classList.remove('open');
}

// Show popup after 5 seconds
setTimeout(() => overlay.classList.add('open'), 5000);

document.getElementById('popupClose').addEventListener('click', closePopup);
document.getElementById('popupSkip').addEventListener('click', closePopup);

// Close on backdrop click
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closePopup();
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePopup();
});
