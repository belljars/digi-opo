(async function phpTerveysTarkistus() {
  const statusEl = document.getElementById("php-status");
  if (!statusEl) {
    return;
  }

  try {
    const response = await fetch("../api/terveys.php", {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      statusEl.textContent = `PHP-yhteys: virhe (${response.status})`;
      return;
    }

    const data = await response.json();
    statusEl.textContent = `PHP-yhteys: ${data.tila} (${data.kieli})`;
  } catch (_error) {
    statusEl.textContent = "PHP-yhteys: ei saatavilla kehitystilassa";
  }
})();
