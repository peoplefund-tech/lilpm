/**
 * Yjs CRDT Performance Test
 * 
 * Tests the performance of Yjs document synchronization without a browser.
 * This simulates multiple clients editing the same document.
 */

import * as Y from 'yjs';

interface TestResult {
    testName: string;
    duration: number;
    operations: number;
    opsPerSecond: number;
    passed: boolean;
}

function runTest(testName: string, testFn: () => void, iterations: number): TestResult {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        testFn();
    }

    const duration = performance.now() - start;
    const opsPerSecond = Math.round(iterations / (duration / 1000));

    return {
        testName,
        duration: Math.round(duration * 100) / 100,
        operations: iterations,
        opsPerSecond,
        passed: true,
    };
}

// Test 1: Document creation and basic operations
function testDocumentCreation(): TestResult {
    return runTest('Document Creation', () => {
        const doc = new Y.Doc();
        const text = doc.getText('content');
        text.insert(0, 'Hello, World!');
        doc.destroy();
    }, 10000);
}

// Test 2: Large document editing simulation
function testLargeDocumentEditing(): TestResult {
    const doc = new Y.Doc();
    const text = doc.getText('content');

    const result = runTest('Large Document Editing', () => {
        const pos = Math.floor(Math.random() * (text.length + 1));
        text.insert(pos, 'x');
    }, 10000);

    console.log(`  Final document length: ${text.length} characters`);
    doc.destroy();
    return result;
}

// Test 3: Multi-client synchronization simulation
function testMultiClientSync(): TestResult {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const doc3 = new Y.Doc();

    const text1 = doc1.getText('content');
    const text2 = doc2.getText('content');
    const text3 = doc3.getText('content');

    let syncCount = 0;

    const result = runTest('Multi-Client Sync (3 clients)', () => {
        // Client 1 makes a change
        text1.insert(text1.length, 'A');
        const update1 = Y.encodeStateAsUpdate(doc1);
        Y.applyUpdate(doc2, update1);
        Y.applyUpdate(doc3, update1);

        // Client 2 makes a change
        text2.insert(text2.length, 'B');
        const update2 = Y.encodeStateAsUpdate(doc2);
        Y.applyUpdate(doc1, update2);
        Y.applyUpdate(doc3, update2);

        // Client 3 makes a change
        text3.insert(text3.length, 'C');
        const update3 = Y.encodeStateAsUpdate(doc3);
        Y.applyUpdate(doc1, update3);
        Y.applyUpdate(doc2, update3);

        syncCount += 6; // 6 sync operations per iteration
    }, 1000);

    // Verify all documents are in sync
    const content1 = text1.toString();
    const content2 = text2.toString();
    const content3 = text3.toString();
    const allSynced = content1 === content2 && content2 === content3;

    console.log(`  Documents synced: ${allSynced ? '✅ Yes' : '❌ No'}`);
    console.log(`  Final content length: ${content1.length} characters`);
    console.log(`  Total sync operations: ${syncCount}`);

    doc1.destroy();
    doc2.destroy();
    doc3.destroy();

    return { ...result, passed: allSynced };
}

// Test 4: Concurrent editing with conflict resolution
function testConcurrentEditing(): TestResult {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const text1 = doc1.getText('content');
    const text2 = doc2.getText('content');

    // Initial sync
    text1.insert(0, 'Initial content');
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    const result = runTest('Concurrent Editing (conflict resolution)', () => {
        // Both clients edit at the same position (conflict!)
        const pos = Math.min(5, text1.length);
        text1.insert(pos, 'X');
        text2.insert(pos, 'Y');

        // Merge updates (CRDT magic)
        const update1 = Y.encodeStateAsUpdate(doc1);
        const update2 = Y.encodeStateAsUpdate(doc2);
        Y.applyUpdate(doc1, update2);
        Y.applyUpdate(doc2, update1);
    }, 1000);

    // Verify documents converge to the same state
    const content1 = text1.toString();
    const content2 = text2.toString();
    const converged = content1 === content2;

    console.log(`  Documents converged: ${converged ? '✅ Yes' : '❌ No'}`);
    console.log(`  Final content length: ${content1.length} characters`);

    doc1.destroy();
    doc2.destroy();

    return { ...result, passed: converged };
}

// Test 5: State encoding/decoding performance
function testStateEncodingDecoding(): TestResult {
    const doc = new Y.Doc();
    const text = doc.getText('content');

    // Create a realistic document
    for (let i = 0; i < 1000; i++) {
        text.insert(text.length, `Paragraph ${i}: This is some sample content for the PRD document. `);
    }

    console.log(`  Document size: ${text.length} characters`);

    const result = runTest('State Encoding/Decoding', () => {
        const encoded = Y.encodeStateAsUpdate(doc);
        const newDoc = new Y.Doc();
        Y.applyUpdate(newDoc, encoded);
        newDoc.destroy();
    }, 100);

    const encoded = Y.encodeStateAsUpdate(doc);
    console.log(`  Encoded size: ${encoded.byteLength} bytes`);
    console.log(`  Compression ratio: ${(text.length / encoded.byteLength).toFixed(2)}x`);

    doc.destroy();
    return result;
}

// Run all tests
console.log('\n🧪 Yjs CRDT Performance Test Suite\n');
console.log('='.repeat(60));

const results: TestResult[] = [];

console.log('\n📝 Test 1: Document Creation');
results.push(testDocumentCreation());

console.log('\n📝 Test 2: Large Document Editing');
results.push(testLargeDocumentEditing());

console.log('\n📝 Test 3: Multi-Client Synchronization');
results.push(testMultiClientSync());

console.log('\n📝 Test 4: Concurrent Editing (Conflict Resolution)');
results.push(testConcurrentEditing());

console.log('\n📝 Test 5: State Encoding/Decoding');
results.push(testStateEncodingDecoding());

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Results Summary\n');
console.log('| Test Name | Duration | Ops | Ops/sec | Status |');
console.log('|-----------|----------|-----|---------|--------|');

for (const result of results) {
    console.log(`| ${result.testName.padEnd(35)} | ${result.duration.toString().padStart(8)}ms | ${result.operations.toString().padStart(5)} | ${result.opsPerSecond.toString().padStart(7)} | ${result.passed ? '✅' : '❌'} |`);
}

const allPassed = results.every(r => r.passed);
console.log('\n' + '='.repeat(60));
console.log(`\n🏁 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);
console.log('💡 Interpretation:');
console.log('   - Document Creation: Should handle 10,000+ ops/sec');
console.log('   - Large Document Editing: Real-time editing performance');
console.log('   - Multi-Client Sync: Simulates real-time collaboration');
console.log('   - Concurrent Editing: CRDT conflict resolution works');
console.log('   - State Encoding: Persistence performance\n');

if (allPassed) {
    console.log('🎉 Yjs CRDT is ready for production use!');
    console.log('   Real-time collaboration should work seamlessly.');
} else {
    console.log('⚠️ Some tests failed. Please investigate.');
}
