// $KYAULabs: visual-review.mjs kyau@aura.kyaulabs 2026/11/16 -0800 Exp $
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { expandVisualReviewCases, loadVisualReviewConfig } from '../visual_review.mjs';

try {
  const { values } = parseArgs({ options: {
    case: { type: 'string', multiple: true },
    state: { type: 'string', multiple: true },
    viewport: { type: 'string', multiple: true },
    list: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Usage: npm run test:visual -- [--case ID] [--state ID] [--viewport mobile|desktop|reflow] [--list]\nRepeat filters to include multiple values. No filters runs the full configured matrix.');
  } else {
    const selection = { cases: values.case ?? [], states: values.state ?? [], viewports: values.viewport ?? [] };
    const captures = expandVisualReviewCases(loadVisualReviewConfig(), selection);
    if (values.list) {
      for (const capture of captures) console.log(`${capture.caseId} ${capture.stateId} ${capture.viewportId}`);
    } else {
      const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
      if (build.error) throw build.error;
      if (build.status !== 0) throw new Error('Visual review stopped because the application build failed.');
      const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
      const result = spawnSync(process.execPath, [cli, 'test', 'visual_review.spec.mjs', '--workers=1', '--output', 'tests/Browser/Screenshots/.playwright', '--reporter=line'], {
        stdio: 'inherit',
        env: { ...process.env, NGEN_VISUAL_SELECTION: JSON.stringify(selection) },
      });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
// vim: ft=javascript sts=4 sw=4 ts=4 et :
