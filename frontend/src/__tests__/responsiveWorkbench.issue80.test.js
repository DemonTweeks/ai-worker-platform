const fs = require('node:fs');
const path = require('node:path');
const { describe, expect, it } = require('vitest');

const stylesheetPath = path.resolve(__dirname, '../responsive-workbench.css');
const stylesheet = fs.readFileSync(stylesheetPath, 'utf8');

function ruleFor(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'));
  return match ? match[1] : '';
}

describe('Issue #80 Active Jobs responsive layout contract', () => {
  it('does not enable horizontal scrolling in the Active Jobs content container', () => {
    const rule = ruleFor('.workbench-result-card > .download-compact');

    expect(rule).toContain('overflow-x: hidden');
    expect(rule).not.toContain('overflow-x: auto');
  });

  it('fits the Active Jobs table to the card instead of enforcing a wide minimum', () => {
    const rule = ruleFor('.workbench-result-card .active-jobs-table');

    expect(rule).toContain('min-width: 0');
    expect(rule).toContain('table-layout: fixed');
    expect(rule).toContain('width: 100%');
    expect(rule).not.toMatch(/min-width:\s*(640|720)px/);
  });

  it('uses compact readable typography and spacing for cells and actions', () => {
    const cellRule = ruleFor('.workbench-result-card .active-jobs-table th,\n.workbench-result-card .active-jobs-table td');
    const actionRule = ruleFor('.workbench-result-card .active-jobs-table .secondary-link');

    expect(cellRule).toContain('font-size: 12px');
    expect(cellRule).toContain('padding: 6px 5px');
    expect(actionRule).toContain('font-size: 12px');
    expect(actionRule).toContain('padding: 6px 4px');
  });

  it('provides a non-scrolling stacked fallback for narrow screens', () => {
    expect(stylesheet).toContain('@media (max-width: 760px)');
    expect(stylesheet).toContain('display: block');
    expect(stylesheet).toContain('data-label');
    expect(stylesheet).not.toContain('min-width: 640px');
  });
});
