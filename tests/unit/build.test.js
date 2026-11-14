// $KYAULabs: build.test.js kyau@aura.kyaulabs 2026/11/13 -0800 Exp $
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ngen-build-'));
  copyFileSync('package.json', join(directory, 'package.json'));
  symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
  mkdirSync(join(directory, 'brand/web'), { recursive: true });
  for (const name of ['space', 'app']) writeFileSync(join(directory, `${name}.js`), `/* Production build fixture. */\nconst value = 40;\nglobalThis.result = value + 2;\n`);
  writeFileSync(join(directory, 'brand/web/ngen-theme.css'), '/* Brand tokens. */\n:root { --accent: #63ddf8; }\n');
  writeFileSync(join(directory, 'styles.scss'), '@use "brand/web/ngen-theme.css";\n$spacing: 4px;\n.fixture {\n  color: var(--accent);\n  padding: $spacing * 2;\n}\n');
  return directory;
}

it('builds minified JavaScript and a compressed Sass bundle from clean deployment inputs', () => {
  const directory = fixture();
  try {
    execFileSync('npm', ['run', 'build'], { cwd: directory, stdio: 'pipe' });
    for (const name of ['space', 'app']) {
      const output = readFileSync(join(directory, `${name}.min.js`), 'utf8');
      const context = {};
      runInNewContext(output, context);
      expect(context.result).toBe(42);
      expect(output.length).toBeLessThan(readFileSync(join(directory, `${name}.js`), 'utf8').length);
    }
    expect(existsSync(join(directory, 'styles.min.css'))).toBe(true);
    const css = readFileSync(join(directory, 'styles.min.css'), 'utf8');
    expect(css).not.toContain('/*');
    expect(css.trim().split('\n')).toHaveLength(1);
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    const [tokens, rule] = style.sheet.cssRules;
    expect(tokens.style.getPropertyValue('--accent').trim()).toBe('#63ddf8');
    expect(rule.selectorText).toBe('.fixture');
    expect(rule.style.color).toBe('var(--accent)');
    expect(rule.style.padding).toBe('8px');
    style.remove();
    expect(existsSync(join(directory, 'styles.min.css.map'))).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('fails deployment on invalid Sass without publishing an error stylesheet', () => {
  const directory = fixture();
  try {
    writeFileSync(join(directory, 'styles.scss'), '.broken { color: red;');
    const result = spawnSync('npm', ['run', 'build'], { cwd: directory, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Error');
    expect(existsSync(join(directory, 'styles.min.css'))).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
