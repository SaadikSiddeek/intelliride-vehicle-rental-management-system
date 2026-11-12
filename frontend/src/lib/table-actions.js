const paths = {
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
  view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  review: '<path d="M9 3H5v18h14V3h-4M9 3v4h6V3Z"/><path d="m8 14 3 3 5-6"/>',
  renew: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  print: '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6Z"/>',
  delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
/** Tabulator accepts HTML formatters; labels/actions must remain escaped. */
export function tableAction(kind, label, action = "") {
  return `<button type="button" class="table-action-btn" aria-label="${escape(label)}" title="${escape(label)}"${action ? ` data-action="${escape(action)}"` : ''}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[kind] || paths.view}</svg></button>`;
}
