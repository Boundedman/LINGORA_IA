// Run before the application and its styles to avoid a flash of the opposite theme.
(()=>{
  let preference='system';
  try{const saved=localStorage.getItem('lingora-theme');if(['light','dark','system'].includes(saved))preference=saved;}catch{/* Storage may be unavailable in private browsing. */}
  const dark=preference==='dark'||(preference==='system'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.dataset.themePreference=preference;
  document.documentElement.style.colorScheme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111726':'#f7f8fc');
})();
