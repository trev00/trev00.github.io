const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

// The public pages. A page is on trevortuck.com if and only if it's listed here:
// scripts/publish.py publishes exactly these folders. Drafts go in drafts.js.
const PAGES = [
  // Home is '/' — the page itself lives in index.html, which the server serves there.
  // Every other page is a folder's index.html, served at '/folder/'.
  { href: '/',                          title: 'Home',                     model: '/shared/models/head-tube-lug.glb' },
  { href: '/lattice-structures/',       title: 'Lattice Structures',       model: '/lattice-structures/models/bcc-lattice.glb' },
  { href: '/fishing/',                  title: 'Fishing',                  model: '/fishing/taiyaki_bowl.glb' },
  { href: '/longshore-casual/',         title: 'Longshore Casual',         model: '/shared/models/head-tube-lug.glb' },
];

// drafts.js is never published, so the live site never asks for it. The catch
// covers previewing the published copy on localhost, where it doesn't exist.
const DRAFTS = LOCAL ? await import('/drafts.js').then((m) => m.default, (err) => {
  console.warn('drafts.js did not load; showing public pages only.', err);
  return [];
}) : [];
const ALL = [...PAGES, ...DRAFTS];

// A folder's '/index.html' and its '/' are the same page ('/fishing/index.html'
// is '/fishing/'), so normalize to '/' and the page stays highlighted whichever
// one you arrived by.
const path = location.pathname.replace(/\/index\.html$/, '/');
// Decode both sides so a folder name with a space still matches location.pathname,
// which comes back percent-encoded.
const decoded = decodeURIComponent(path);
const current = ALL.find((p) => decodeURIComponent(p.href) === decoded);

const sidebar = document.getElementById('sidebar');
if (sidebar) {
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <a class="fullname" href="/">Trevor Tuck</a>
    <div class="contact">
      <p><a>Mechanical Engineer</a></p>
      <p><a href="mailto:trevortuck00@gmail.com">trevortuck00@gmail.com</a></p>
      <p><a href="https://github.com/trev00" target="_blank" rel="noopener">github</a></p>
    </div>
    ${current?.model ? `<div class="highlight" data-model="${current.model}" data-lock></div>` : ''}
    <nav><ul>${ALL.map((p) => `
      <li><a href="${p.href}"${p === current ? ' aria-current="page"' : ''}>${p.title}${
        DRAFTS.includes(p) ? ' <span class="draft-tag">draft</span>' : ''}</a></li>`
    ).join('')}
    </ul></nav>`;
}

const io = new IntersectionObserver((entries) => {
  for (const { isIntersecting, target } of entries) {
    if (!isIntersecting) continue;
    io.unobserve(target);
    // Imported here, not at the top, so loading three.js doesn't hold up the
    // page's other modules (the fishing map waits on this one otherwise).
    import('/shared/viewer.js').then(({ createViewer }) => {
      // data-lock => rotate only, so the sidebar model holds a constant size
      createViewer(target, target.dataset.model, { lock: 'lock' in target.dataset });
    });
  }
}, { rootMargin: '200px' });

document.querySelectorAll('[data-model]').forEach((el) => io.observe(el));
