import assert from 'assert';
import { MutableSortedTreeMap } from '../lib/MutableSortedTreeMap.js';

function testMutableSortedTreeMap() {
    console.log('Testing MutableSortedTreeMap...');

    const objects = [
        { id: 'a', timestamp: 100, value: 'first' },
        { id: 'b', timestamp: 50, value: 'early' },
        { id: 'c', timestamp: 300, value: 'late' },
        { id: 'd', timestamp: 200, value: 'middle' },
        { id: 'e', timestamp: 75, value: 'earlier' },
        { id: 'f', timestamp: 250, value: 'later' },
        { id: 'g', timestamp: 150, value: 'mid' },
        { id: 'h', timestamp: 225, value: 'getting-later' },
        { id: 'i', timestamp: 175, value: 'getting-later' },
        { id: 'j', timestamp: 25, value: 'earliest' }
    ];

    // Test basic operations with timestamp sorting
    const map = new MutableSortedTreeMap((a, b) => a.timestamp - b.timestamp);
    
    // Test set and get
    for (const obj of objects) {
        map.set(obj.id, obj);
    }

    // Verify all gets work
    for (const obj of objects) {
        assert.deepEqual(map.get(obj.id), obj, `get should return correct object for id ${obj.id}`);
    }
    assert(map.get('not-found') === undefined, 'get should return undefined for non-existent key');
    console.log('✓ set and get operations work');

    // Test iteration order
    const values = Array.from(map).map(([_, v]) => v.timestamp);
    const expectedOrder = [25, 50, 75, 100, 150, 175, 200, 225, 250, 300];
    assert.deepEqual(values, expectedOrder, 'iteration should be in timestamp order');
    console.log('✓ iteration order is correct');

    // Test remove multiple items
    map.remove('b'); // remove timestamp 50
    map.remove('g'); // remove timestamp 150
    map.remove('i'); // remove timestamp 175
    
    const expectedAfterRemove = [25, 75, 100, 200, 225, 250, 300];
    const valuesAfterRemove = Array.from(map).map(([_, v]) => v.timestamp);
    assert.deepEqual(valuesAfterRemove, expectedAfterRemove, 'iteration order maintained after removes');
    
    // Verify removed items
    assert(map.get('b') === undefined, 'removed item should be undefined');
    assert(map.get('g') === undefined, 'removed item should be undefined');
    assert(map.get('i') === undefined, 'removed item should be undefined');
    console.log('✓ remove operations work');

    // Test custom comparator (reverse order)
    const reverseMap = new MutableSortedTreeMap((a, b) => b.timestamp - a.timestamp);
    for (const obj of objects) {
        reverseMap.set(obj.id, obj);
    }
    const reverseValues = Array.from(reverseMap).map(([_, v]) => v.timestamp);
    const expectedReverseOrder = [300, 250, 225, 200, 175, 150, 100, 75, 50, 25];
    assert.deepEqual(reverseValues, expectedReverseOrder, 'custom comparator should work');
    console.log('✓ custom comparator works');

    // Test empty map
    const emptyMap = new MutableSortedTreeMap((a, b) => a.timestamp - b.timestamp);
    assert(Array.from(emptyMap).length === 0, 'empty map should have no entries');
    console.log('✓ empty map works');

    // Test overwrite
    const existingId = 'a';
    const newObj = { id: existingId, timestamp: 999, value: 'overwritten' };
    map.set(existingId, newObj);
    assert.deepEqual(map.get(existingId), newObj, 'overwritten object should be updated');
    const valuesAfterOverwrite = Array.from(map).map(([_, v]) => v.timestamp);
    const expectedAfterOverwrite = [25, 75, 200, 225, 250, 300, 999];
    assert.deepEqual(valuesAfterOverwrite, expectedAfterOverwrite, 'order maintained after overwrite');
    console.log('✓ overwrite works');

    console.log('All tests passed!');
}

testMutableSortedTreeMap(); 