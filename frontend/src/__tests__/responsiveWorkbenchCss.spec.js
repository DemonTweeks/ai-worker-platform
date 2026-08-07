import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../responsive-workbench.css', import.meta.url)),
  'utf8'
);

const ruleBody = (selector) => {
  const marker = `${selector} {`;
  const start = css.indexOf(marker);
  if (start === -1) {
    return '';
  }

  const bodyStart = start + marker.length;
  const end = css.indexOf('}', bodyStart);
  return end === -1 ? '' : css.slice(bodyStart, end);
};

describe('responsive Active Jobs layout', () => {
  it('fits the desktop table inside the result card without horizontal scrolling', () => {
    const container = ruleBody('.workbench-result-card > .download-compact');
    const table = ruleBody('.workbench-result-card .active-jobs-table');

    expect(container).toMatch(/overflow-x:\s*hidden/);
    expect(container).not.toMatch(/overflow-x:\s*auto/);
    expect(table).toMatch(/min-width:\s*0/);
    expect(table).toMatch(/table-layout:\s*fixed/);
    expect(table).toMatch(/width:\s*100%/);
  });

  it('uses compact readable typography for headers, cells and actions', () => {
    expect(ruleBody('.workbench-result-card .active-jobs-table th')).toMatch(/font-size:\s*12px/);
    expect(ruleBody('.workbench-result-card .active-jobs-table td')).toMatch(/font-size:\s*(?:11|12)px/);
    expect(ruleBody('.workbench-result-card .active-jobs-table .secondary-link')).toMatch(/font-size:\s*12px/);
  });

  it('provides a stacked narrow-screen row layout without restoring a table minimum width', () => {
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('.workbench-result-card .active-jobs-table thead');
    expect(css).toContain('.workbench-result-card .active-jobs-table tr');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('.workbench-result-card .active-jobs-table td::before');
    expect(css).toMatch(/content:\s*"Job ID"/);
    expect(css).toMatch(/content:\s*"Stop\/Cancel"/);
    expect(css).not.toMatch(/\.active-jobs-table\s*\{[^}]*min-width:\s*(?:640|720)px/s);
  });
});
