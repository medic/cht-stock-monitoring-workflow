/**
 * Performance benchmarks for stock monitoring workflow
 *
 * Run with: node test/benchmarks/performance.bench.js
 *
 * These benchmarks measure the performance of key operations
 * to catch performance regressions.
 */

const path = require('path');
const fs = require('fs-extra');

// Thresholds in milliseconds
const THRESHOLDS = {
  ITEM_GENERATION_PER_ITEM: 5, // Max 5ms per item
  CONFIG_WRITE: 100,           // Max 100ms for config write
  CONFIG_READ: 50,             // Max 50ms for config read
  TRANSLATION_PARSE: 100,      // Max 100ms for translation parsing
};

/**
 * Simple benchmark runner
 * @param {string} name - Benchmark name
 * @param {Function} fn - Function to benchmark
 * @param {number} iterations - Number of iterations
 * @returns {Object} Benchmark results
 */
async function benchmark(name, fn, iterations = 10) {
  const times = [];

  // Warmup
  await fn();

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1_000_000); // Convert to ms
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(times.length * 0.95)];

  return { name, avg, min, max, p95, iterations };
}

/**
 * Generate mock items for testing
 * @param {number} count - Number of items to generate
 * @returns {Object} Items object keyed by name
 */
function generateMockItems(count) {
  const items = {};
  for (let i = 0; i < count; i++) {
    items[`item_${i}`] = {
      name: `item_${i}`,
      label: { en: `Item ${i}`, fr: `Article ${i}` },
      unit: { label: { en: 'Tablet', fr: 'Comprime' } },
      warning_total: 20,
      danger_total: 10,
      max_total: 100,
      isInSet: i % 3 === 0,
      set: i % 3 === 0 ? { label: { en: 'Box', fr: 'Boite' }, count: 10 } : undefined,
    };
  }
  return items;
}

/**
 * Generate mock config
 * @param {number} itemCount - Number of items
 * @returns {Object} Mock configuration
 */
function generateMockConfig(itemCount) {
  return {
    version: '1.0.0',
    languages: ['en', 'fr'],
    defaultLanguage: 'en',
    levels: {
      1: { contact_type: 'chw', role: 'chw', place_type: 'chw_area' },
    },
    items: generateMockItems(itemCount),
    categories: {},
    features: {
      stock_count: { form_name: 'stock_count', type: 'action' },
    },
  };
}

/**
 * Run all benchmarks
 */
async function runBenchmarks() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           Stock Monitoring Workflow - Performance Benchmarks');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];

  // Benchmark: JSON serialization with varying item counts
  console.log('Running: Config serialization benchmarks...');

  for (const itemCount of [10, 50, 100, 500]) {
    const config = generateMockConfig(itemCount);
    const result = await benchmark(
      `Serialize config (${itemCount} items)`,
      () => JSON.stringify(config, null, 4),
      20
    );
    results.push(result);
  }

  // Benchmark: JSON parsing
  console.log('Running: Config parsing benchmarks...');

  for (const itemCount of [10, 50, 100, 500]) {
    const config = generateMockConfig(itemCount);
    const jsonStr = JSON.stringify(config, null, 4);
    const result = await benchmark(
      `Parse config (${itemCount} items)`,
      () => JSON.parse(jsonStr),
      20
    );
    results.push(result);
  }

  // Benchmark: Item row generation simulation
  console.log('Running: Item processing benchmarks...');

  for (const itemCount of [10, 50, 100, 500]) {
    const items = Object.values(generateMockItems(itemCount));
    const result = await benchmark(
      `Process items (${itemCount} items)`,
      () => {
        return items.map(item => ({
          type: 'integer',
          name: item.name,
          label: item.label.en,
          calculation: item.isInSet
            ? `\${${item.name}___set} * ${item.set?.count || 1}`
            : `\${${item.name}}`,
        }));
      },
      20
    );
    results.push(result);
  }

  // Benchmark: Object spread in reduce (common pattern)
  console.log('Running: Reduce pattern benchmarks...');

  const testArray = Array.from({ length: 1000 }, (_, i) => [`key_${i}`, `value_${i}`]);

  const spreadResult = await benchmark(
    'Reduce with spread (1000 items)',
    () => testArray.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
    20
  );
  results.push(spreadResult);

  const mutateResult = await benchmark(
    'Reduce with mutation (1000 items)',
    () => testArray.reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {}),
    20
  );
  results.push(mutateResult);

  // Print results
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                          Results');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Benchmark'.padEnd(40) + 'Avg (ms)'.padEnd(12) + 'Min'.padEnd(10) + 'Max'.padEnd(10) + 'P95');
  console.log('─'.repeat(80));

  for (const r of results) {
    console.log(
      r.name.padEnd(40) +
      r.avg.toFixed(3).padEnd(12) +
      r.min.toFixed(3).padEnd(10) +
      r.max.toFixed(3).padEnd(10) +
      r.p95.toFixed(3)
    );
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    Performance Insights');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Compare spread vs mutation
  const spreadTime = results.find(r => r.name.includes('spread'))?.avg || 0;
  const mutateTime = results.find(r => r.name.includes('mutation'))?.avg || 0;
  if (spreadTime && mutateTime) {
    const ratio = spreadTime / mutateTime;
    console.log(`Object spread is ${ratio.toFixed(1)}x slower than mutation in reduce operations`);
  }

  // Check for potential issues
  const slowOperations = results.filter(r => r.avg > 10);
  if (slowOperations.length > 0) {
    console.log('\n⚠️  Operations exceeding 10ms:');
    slowOperations.forEach(r => console.log(`   - ${r.name}: ${r.avg.toFixed(3)}ms`));
  } else {
    console.log('\n✓ All operations completed under 10ms');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// Run benchmarks
runBenchmarks().catch(console.error);
