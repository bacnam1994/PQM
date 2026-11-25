/**
 * PQM ZERO-DEFECT CODEBASE INVARIANT GATE
 * =======================================
 * Bộ kiểm thử tự động quét tĩnh 100% file mã nguồn trong `src/` để ngăn chặn vĩnh viễn
 * 6 nhóm lỗi hệ thống:
 * 1. Vi phạm React Rules of Hooks (gọi Hook sau lệnh return sớm trong Component) — quét bằng TypeScript Compiler AST.
 * 2. Đường dẫn điều hướng nội bộ 404 (`navigate(...)` hoặc `<Link to="...">` không khớp `src/App.tsx`).
 * 3. Hộp thoại chặn trình duyệt (`window.alert`, `alert`, `window.confirm`, `confirm`, `window.prompt`, `prompt`).
 * 4. Nút thao tác chết (`onView={() => {}}`, `onEdit={() => {}}`, `onDelete={() => {}}`).
 * 5. Phép sắp xếp ngày tháng không an toàn (`.testDate.localeCompare`, `.mfgDate.localeCompare`, `.issueDate.localeCompare` trực tiếp không bọc `String(...)`).
 * 6. Tầng Chuẩn Hóa Biên Dữ Liệu (`normalizeEntityByCollection`) đảm bảo 100% mảng Firebase RTDB bị xóa hoặc biến thành Object được phục hồi thành Array chuẩn.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { normalizeEntityByCollection, normalizeCollectionList } from '../utils/entityNormalizer';
import { calculateBatchProgress } from '../pages/batches/BatchList/utils/batchProgress';
import { resolveDeclaredBasis } from '../utils/basisCalculation';

function walkSourceFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const SRC_DIR = path.resolve(__dirname, '..');
const ALL_SOURCE_FILES = walkSourceFiles(SRC_DIR);

describe('PQM Zero-Defect Codebase Invariant Gates (100% Source Coverage)', () => {
  it('Gate 1: 0 React Rules of Hooks violations (AST scan across all TSX components)', () => {
    const HOOK_RE = /^use[A-Z]/;
    const violations: Array<{
      file: string;
      component: string;
      earlyReturnLine: number;
      hook: string;
      hookLine: number;
    }> = [];

    for (const file of ALL_SOURCE_FILES.filter((f) => f.endsWith('.tsx'))) {
      const code = fs.readFileSync(file, 'utf8');
      const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      const checkComponentBody = (block: ts.Block, compName: string) => {
        if (!block || !block.statements) return;
        let firstEarlyReturnLine: number | null = null;

        for (const stmt of block.statements) {
          const hasReturn = (node: ts.Node): boolean => {
            if (ts.isReturnStatement(node)) return true;
            if (ts.isFunctionLike(node)) return false;
            let found = false;
            ts.forEachChild(node, (c) => {
              if (hasReturn(c)) found = true;
            });
            return found;
          };

          const findHookCall = (node: ts.Node): { name: string; line: number } | null => {
            if (ts.isFunctionLike(node)) return null;
            if (ts.isCallExpression(node)) {
              const expr = node.expression;
              let name = '';
              if (ts.isIdentifier(expr)) name = expr.text;
              else if (ts.isPropertyAccessExpression(expr)) name = expr.name.text;
              if (HOOK_RE.test(name)) {
                return {
                  name,
                  line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                };
              }
            }
            let res: { name: string; line: number } | null = null;
            ts.forEachChild(node, (c) => {
              if (!res) res = findHookCall(c);
            });
            return res;
          };

          if (firstEarlyReturnLine !== null) {
            const hook = findHookCall(stmt);
            if (hook) {
              violations.push({
                file: path.relative(SRC_DIR, file),
                component: compName,
                earlyReturnLine: firstEarlyReturnLine,
                hook: hook.name,
                hookLine: hook.line,
              });
            }
          }
          if (firstEarlyReturnLine === null && ts.isIfStatement(stmt) && hasReturn(stmt)) {
            firstEarlyReturnLine = sf.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
          }
        }
      };

      const visit = (node: ts.Node) => {
        if (
          ts.isFunctionDeclaration(node) &&
          node.name &&
          /^[A-Z]/.test(node.name.text) &&
          node.body
        ) {
          checkComponentBody(node.body, node.name.text);
        } else if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          /^[A-Z]/.test(node.name.text) &&
          node.initializer
        ) {
          let fn: ts.Expression = node.initializer;
          if (ts.isCallExpression(fn) && fn.arguments.length > 0) {
            fn = fn.arguments[0];
          }
          if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isBlock(fn.body)) {
            checkComponentBody(fn.body, node.name.text);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sf);
    }

    expect(violations).toEqual([]);
  });

  it('Gate 2: 100% internal routes in navigate() and <Link to> match App.tsx routes (0 broken 404 links)', () => {
    const appFile = path.join(SRC_DIR, 'App.tsx');
    const appCode = fs.readFileSync(appFile, 'utf8');
    const definedRoutes = [...appCode.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);

    const matchesDefinedRoute = (target: string): boolean => {
      const clean = target.split('?')[0].split('#')[0];
      if (clean === '/' || clean === '*') return true;
      const segs = clean.split('/').filter(Boolean);
      return definedRoutes.some((r) => {
        if (r === '*') return false;
        const rSegs = r.split('/').filter(Boolean);
        if (rSegs.length !== segs.length) return false;
        return rSegs.every((rs, idx) => rs.startsWith(':') || rs === segs[idx]);
      });
    };

    const brokenRoutes: Array<{ file: string; line: number; route: string }> = [];

    for (const file of ALL_SOURCE_FILES) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        const routeRegex = /(?:navigate\(\s*|to=\s*\{?\s*)(['"`])(\/[a-zA-Z0-9_\-\/:?=&${}.]+)\1/g;
        let match: RegExpExecArray | null;
        while ((match = routeRegex.exec(trimmed)) !== null) {
          const raw = match[2];
          const normalized = raw
            .replace(/\$\{[^}]+\}/g, ':param')
            .split('?')[0]
            .split('#')[0];
          if (
            normalized.startsWith('/') &&
            !normalized.startsWith('/api') &&
            !normalized.startsWith('/version.json') &&
            !normalized.startsWith('/assets') &&
            !matchesDefinedRoute(normalized)
          ) {
            brokenRoutes.push({
              file: path.relative(SRC_DIR, file),
              line: idx + 1,
              route: raw,
            });
          }
        }
      });
    }

    expect(brokenRoutes).toEqual([]);
  });

  it('Gate 3: 0 native blocking browser dialogs (alert / confirm / prompt) across entire codebase', () => {
    const dialogUsages: Array<{ file: string; line: number; text: string }> = [];

    for (const file of ALL_SOURCE_FILES) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (/\b(window\.)?(alert|confirm|prompt)\s*\(/.test(trimmed)) {
          dialogUsages.push({
            file: path.relative(SRC_DIR, file),
            line: idx + 1,
            text: trimmed,
          });
        }
      });
    }

    expect(dialogUsages).toEqual([]);
  });

  it('Gate 4: 0 dead no-op action handlers (onView / onEdit / onDelete / onClick = () => {})', () => {
    const deadHandlers: Array<{ file: string; line: number; text: string }> = [];

    for (const file of ALL_SOURCE_FILES) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (
          /on(Click|View|Edit|Delete|Change)\s*=\s*\{\s*\(\)\s*=>\s*\{\s*(\/\*.*?\*\/\s*)?\}\s*\}/.test(
            trimmed
          )
        ) {
          deadHandlers.push({
            file: path.relative(SRC_DIR, file),
            line: idx + 1,
            text: trimmed,
          });
        }
      });
    }

    expect(deadHandlers).toEqual([]);
  });

  it('Gate 5: 0 unguarded direct .localeCompare() calls on date/timestamp fields across entire codebase', () => {
    const unsafeDateSorts: Array<{ file: string; line: number; text: string }> = [];

    for (const file of ALL_SOURCE_FILES) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (
          /\.(testDate|mfgDate|expDate|issueDate|createdAt|updatedAt|timestamp)\.localeCompare\(/.test(
            trimmed
          )
        ) {
          unsafeDateSorts.push({
            file: path.relative(SRC_DIR, file),
            line: idx + 1,
            text: trimmed,
          });
        }
      });
    }

    expect(unsafeDateSorts).toEqual([]);
  });

  it('Gate 6: Boundary Entity Normalizer restores stripped RTDB arrays & object-maps into true Arrays', () => {
    const rawTccsFromRtdb: any = {
      id: 'tccs_1',
      productId: 'prod_1',
      // Firebase RTDB strips empty arrays to undefined and turns sparse arrays into objects
      mainQualityCriteria: { 0: { name: 'Độ ẩm', max: 5 } },
      safetyCriteria: undefined,
      alternateRules: null,
    };
    const normTccs = normalizeEntityByCollection('tccsList', rawTccsFromRtdb);
    expect(Array.isArray(normTccs.mainQualityCriteria)).toBe(true);
    expect(normTccs.mainQualityCriteria).toHaveLength(1);
    expect(Array.isArray(normTccs.safetyCriteria)).toBe(true);
    expect(Array.isArray(normTccs.alternateRules)).toBe(true);

    const rawFormulaFromRtdb: any = {
      id: 'form_1',
      productId: 'prod_1',
      ingredients: undefined,
      excipients: { 0: { name: 'Tinh bột', declaredContent: 100 } },
    };
    const normFormula = normalizeEntityByCollection('productFormulas', rawFormulaFromRtdb);
    expect(Array.isArray(normFormula.ingredients)).toBe(true);
    expect(Array.isArray(normFormula.excipients)).toBe(true);
    expect(normFormula.excipients).toHaveLength(1);

    const rawTestResultFromRtdb: any = {
      id: 'tr_1',
      batchId: 'batch_1',
      results: { 0: { criteriaName: 'Độ ẩm', value: '4.2', isPass: true } },
      extraCriteria: undefined,
      attachments: undefined,
      evaluationSnapshot: {
        overallStatus: 'PASS',
        criterionResults: { 0: { criteriaName: 'Độ ẩm', isPass: true } },
      },
    };
    const normTr = normalizeEntityByCollection('testResults', rawTestResultFromRtdb);
    expect(Array.isArray(normTr.results)).toBe(true);
    expect(Array.isArray(normTr.extraCriteria)).toBe(true);
    expect(Array.isArray(normTr.attachments)).toBe(true);
    expect(Array.isArray(normTr.evaluationSnapshot.criterionResults)).toBe(true);
    expect(normTr.evaluationSnapshot.criterionResults).toHaveLength(1);

    const normMaterials = normalizeCollectionList('rawMaterials', [
      { id: 'rm_1', name: 'Vitamin C', aliases: undefined } as any,
    ]);
    expect(Array.isArray(normMaterials[0].aliases)).toBe(true);

    // Also verify Firebase RTDB path names (snake_case) used by BaseFirebaseRepository
    const normFormulaFromRepo = normalizeEntityByCollection('product_formulas', rawFormulaFromRtdb);
    expect(Array.isArray(normFormulaFromRepo.ingredients)).toBe(true);
    expect(Array.isArray(normFormulaFromRepo.excipients)).toBe(true);

    const normMasterCriterion = normalizeEntityByCollection('master_criteria', {
      id: 'mc_1',
      canonicalName: 'Định tính',
      defaultUnit: undefined,
      aliases: undefined,
    } as any);
    expect(normMasterCriterion.defaultUnit).toBe('');
    expect(Array.isArray(normMasterCriterion.aliases)).toBe(true);
  });

  it('Gate 7: All primary Firebase RTDB ingestion boundaries enforce entityNormalizer', () => {
    const ingestionFiles = [
      path.join(SRC_DIR, 'hooks', 'useFirebaseSync.ts'),
      path.join(SRC_DIR, 'repositories', 'firebase', 'BaseFirebaseRepository.ts'),
      path.join(SRC_DIR, 'repositories', 'firebase', 'FirebaseMasterCriterionRepository.ts'),
      path.join(SRC_DIR, 'services', 'testResultService.ts'),
    ];

    for (const file of ingestionFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const hasNormalizer =
        content.includes('normalizeEntityByCollection') ||
        content.includes('normalizeCollectionList') ||
        content.includes('this.normalizeRecordsMap') ||
        content.includes('this.normalizeRecord');
      expect(
        hasNormalizer,
        `Ingestion boundary ${path.relative(SRC_DIR, file)} must normalize RTDB payloads`
      ).toBe(true);
    }
  });

  it('Gate 8: Cold-start F5 reload tolerance — detail helpers & progress calculators never crash on undefined entity', () => {
    // 1. calculateBatchProgress must safely handle undefined/null/partial batch on Render 1 during F5 cold start
    expect(() => calculateBatchProgress(undefined, [])).not.toThrow();
    expect(calculateBatchProgress(undefined, [])).toEqual({
      progressPercent: 0,
      missingCriteria: [],
      requiredCriteria: [],
    });

    expect(() => calculateBatchProgress(null, undefined as any)).not.toThrow();
    expect(() =>
      calculateBatchProgress(
        {
          id: 'batch_cold_start',
          tccs: {
            mainQualityCriteria: { 0: { name: 'Định lượng', type: 'NUMBER' } },
            alternateRules: { 0: { main: 'Định lượng', alt: 'Độ ẩm' } },
          },
        },
        undefined as any
      )
    ).not.toThrow();

    // 2. resolveDeclaredBasis must safely handle undefined formula or non-object formula on cold start
    expect(() =>
      resolveDeclaredBasis({ name: 'Vitamin C', min: 90, max: 110, unit: 'mg' }, undefined)
    ).not.toThrow();
  });
});
