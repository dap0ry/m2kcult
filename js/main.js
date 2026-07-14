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

function handleSubmit(e) {
  e.preventDefault();
  const email = e.target.email.value;
  console.log('Email registrado:', email);
  e.target.innerHTML = `
    <p style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#111;line-height:1.5">
      ¡Gracias!<br>
      <span style="font-family:'Inter',sans-serif;font-size:12px;color:#aaa;font-weight:300;letter-spacing:0.1em">
        Revisa tu correo pronto.
      </span>
    </p>
  `;
  setTimeout(closePopup, 2500);
}
