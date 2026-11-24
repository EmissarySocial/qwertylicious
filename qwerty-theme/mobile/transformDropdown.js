
(() => {
  const MOBILE = () => window.innerWidth < 768;

  function backButton() {
    const button = document.querySelector('a:has(.bi-chevron-left:not(.button))');
    if (!button) return;
    button.classList.add('button', 'icon');
  }

  function transformDropdown(source, itemSelector) {
    if (!source) return;

    const parent = source.parentElement;
    const existing = parent.querySelector(':scope > .dropdown[data-auto]');

    if (!MOBILE()) {
      if (existing) existing.remove();
      source.style.display = '';
      return;
    }
    if (existing) return;

    const all = Array.from(source.querySelectorAll(itemSelector));

    const extracted = [];
    for (const el of all) {
      if (el.querySelector('.bi-chevron-left') || el.textContent.trim().startsWith('←')) {
        el.classList.add('button', 'icon');
        el.innerHTML = '<i class="bi bi-chevron-left"></i>';
        parent.insertBefore(el, source);
        extracted.push(el);
      }
    }

    const items = all.filter(el => !extracted.includes(el));

    const active = items.find(el =>
      el.getAttribute('aria-selected') === 'true' ||
      el.classList.contains('selected') ||
      el.classList.contains('bold')
    );
    if (!active) {
      for (const el of extracted) source.appendChild(el);
      return;
    }

    const side = parent.firstElementChild === source ? 'left'
              : parent.lastElementChild === source ? 'right'
              : 'center';

    const btn = document.createElement('a');
    btn.className = 'button';
    btn.innerHTML = active.textContent.trim() + ' <i class="bi bi-chevron-down text-sm"></i>';
    
    const content = document.createElement('div');
    content.className = 'dropdown-content ' + side;
    for (const item of items) {
      const clone = item.cloneNode(true);
      clone.removeAttribute('id');
      clone.classList.remove('tab');
      clone.classList.add('dropdown-item');
      if (item === active) clone.classList.add('selected');
      content.append(clone);
    }

    const dd = document.createElement('div');
    dd.className = 'dropdown ' + side;
    dd.dataset.auto = '';
    dd.append(btn, content);

    source.style.display = 'none';
    parent.insertBefore(dd, source);
  }

  function apply() {
    backButton();
    transformDropdown(document.querySelector('#menu-bar .left'), 'a');
    transformDropdown(document.querySelector('.tabs'), 'a');
    transformDropdown(document.querySelector('[role="tablist"]'), 'a');
  }

  document.addEventListener('DOMContentLoaded', apply);
  document.body.addEventListener('htmx:afterSwap', apply);
})();