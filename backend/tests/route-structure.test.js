import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'espree';
import analyticsRoutes from '../src/routes/analyticsRoutes.js';
import adminDashboardRoutes from '../src/routes/adminDashboardRoutes.js';
import customerRoutes from '../src/routes/customerRoutes.js';
import orderRoutes from '../src/routes/orderRoutes.js';
import productRoutes from '../src/routes/productRoutes.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function directPaths(router, method) {
  return router.stack
    .filter((layer) => layer.route?.methods?.[method])
    .map((layer) => layer.route.path);
}

test('critical endpoints exist on router import, without invoking parent handlers', () => {
  assert.ok(directPaths(orderRoutes, 'patch').includes('/:id/refund'));
  assert.ok(directPaths(customerRoutes, 'get').includes('/:id/detail'));
  assert.ok(directPaths(productRoutes, 'post').includes('/:id/variants'));
  assert.ok(directPaths(productRoutes, 'patch').includes('/:id/variants/:variantId'));
  assert.ok(directPaths(analyticsRoutes, 'get').includes('/sales-report'));
  assert.ok(directPaths(adminDashboardRoutes, 'get').includes('/summary'));
});

test('route and service source contains no route declarations inside handlers', () => {
  const nestedRoutes = [];
  const roots = ['src/routes', 'src/services'];
  for (const root of roots) {
    const directory = path.join(backendDir, root);
    for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.js'))) {
      const fullPath = path.join(directory, file);
      const source = fs.readFileSync(fullPath, 'utf8');
      const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', loc: true });
      const visit = (node, functionDepth = 0) => {
        if (!node || typeof node !== 'object') return;
        const isFunction = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type);
        const depth = functionDepth + Number(isFunction);
        if (
          node.type === 'CallExpression'
          && node.callee?.type === 'MemberExpression'
          && node.callee.object?.type === 'Identifier'
          && node.callee.object.name === 'router'
          && node.callee.property?.type === 'Identifier'
          && ['get', 'post', 'put', 'patch', 'delete'].includes(node.callee.property.name)
          && depth > 0
        ) {
          nestedRoutes.push(`${path.relative(backendDir, fullPath)}:${node.loc.start.line}`);
        }
        for (const [key, value] of Object.entries(node)) {
          if (key === 'loc' || key === 'range') continue;
          if (Array.isArray(value)) value.forEach((child) => visit(child, depth));
          else if (value && typeof value === 'object') visit(value, depth);
        }
      };
      visit(ast);
    }
  }
  assert.deepEqual(nestedRoutes, []);
});
