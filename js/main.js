// ── Mobile Menu Toggle ──────────────────────────────────────────
(function() {
  const burger = document.getElementById('burgerBtn');
  const nav = document.getElementById('mainNav');
  const searchBtn = document.getElementById('searchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose = document.getElementById('searchClose');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  // Make nav collapsible on mobile
  if (nav) nav.classList.add('collapsed');
  if (burger) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('active');
      const ul = nav.querySelector('ul');
      if (ul) ul.classList.toggle('open');
    });
  }

  // Search overlay
  if (searchBtn && searchOverlay) {
    searchBtn.addEventListener('click', () => {
      searchOverlay.classList.add('open');
      if (searchInput) searchInput.focus();
    });
  }
  if (searchClose && searchOverlay) {
    searchClose.addEventListener('click', () => searchOverlay.classList.remove('open'));
  }
  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) searchOverlay.classList.remove('open');
    });
  }

  // Search functionality — searches loaded articles
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      performSearch();
    });
  }
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(performSearch, 250);
    });
  }

  function performSearch() {
    if (!searchResults || !searchInput) return;
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 2) { searchResults.innerHTML = ''; return; }

    const articles = window.__ARTICLES__ || [];
    const matches = articles.filter(a =>
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q))
    ).slice(0, 10);

    if (matches.length === 0) {
      searchResults.innerHTML = '<p style="color:#aaa;padding:20px;text-align:center">No results found</p>';
      return;
    }

    searchResults.innerHTML = matches.map(a =>
      '<a href="articles/' + a.slug + '.html">' + highlightText(a.title, q) + '</a>'
    ).join('');
  }

  function highlightText(text, query) {
    if (!query) return text;
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<strong style="color:#ffe57b">$1</strong>');
  }

  // Newsletter form
  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterMsg = document.getElementById('newsletterMsg');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('input[type="email"]');
      if (email && email.value) {
        if (newsletterMsg) {
          newsletterMsg.textContent = 'Thank you for subscribing! You\'ll receive our next update.';
          newsletterMsg.className = 'form-msg success';
        }
        email.value = '';
      } else {
        if (newsletterMsg) {
          newsletterMsg.textContent = 'Please enter a valid email address.';
          newsletterMsg.className = 'form-msg error';
        }
      }
    });
  }

  // Keyboard shortcut: Escape to close search
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchOverlay) {
      searchOverlay.classList.remove('open');
    }
  });

  // Close mobile menu on link click
  if (nav) {
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger && burger.classList.remove('active');
        const ul = nav.querySelector('ul');
        if (ul) ul.classList.remove('open');
      });
    });
  }
})();
