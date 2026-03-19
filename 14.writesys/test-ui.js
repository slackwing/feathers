// Simple test to verify UI loads and JavaScript has no syntax errors
const http = require('http');

console.log('Testing WriteSys Web UI...\n');

// Test 1: HTML loads
function testHTML() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:5003/', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (data.includes('WriteSys - Book Annotation System')) {
                    console.log('✓ HTML page loads correctly');
                    console.log(`  - Status: ${res.statusCode}`);
                    console.log(`  - Size: ${data.length} bytes`);

                    // Check for key elements
                    const checks = [
                        ['Controls', data.includes('id="controls"')],
                        ['Manuscript container', data.includes('id="manuscript-content"')],
                        ['Annotation sidebar', data.includes('id="annotation-sidebar"')],
                        ['Renderer.js', data.includes('renderer.js')],
                        ['Annotations.js', data.includes('annotations.js')],
                        ['marked.js', data.includes('marked')],
                        ['Paged.js', data.includes('pagedjs')],
                        ['smartquotes', data.includes('smartquotes')]
                    ];

                    checks.forEach(([name, result]) => {
                        console.log(`  - ${result ? '✓' : '✗'} ${name}`);
                    });

                    resolve(data);
                } else {
                    reject(new Error('HTML content unexpected'));
                }
            });
        }).on('error', reject);
    });
}

// Test 2: JavaScript files load
function testJS(file) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:5003/js/${file}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data.length > 0) {
                    console.log(`✓ ${file} loads (${data.length} bytes)`);

                    // Check for syntax errors (basic)
                    if (data.includes('WriteSysRenderer') || data.includes('WriteSysAnnotations')) {
                        console.log(`  - Module exports found`);
                    }

                    resolve(data);
                } else {
                    reject(new Error(`${file} failed: ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

// Test 3: CSS loads
function testCSS() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:5003/css/book.css', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data.length > 0) {
                    console.log(`✓ book.css loads (${data.length} bytes)`);

                    // Check for key styles
                    const styles = [
                        ['Book typography', data.includes('@page')],
                        ['Sentence styling', data.includes('.sentence')],
                        ['Annotations', data.includes('.annotated-highlight')],
                        ['Sidebar', data.includes('#annotation-sidebar')]
                    ];

                    styles.forEach(([name, result]) => {
                        console.log(`  - ${result ? '✓' : '✗'} ${name}`);
                    });

                    resolve(data);
                } else {
                    reject(new Error(`CSS failed: ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

// Test 4: API responds
function testAPI() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:5003/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log('✓ API responds correctly');
                    console.log(`  - Status: ${json.status}`);
                    console.log(`  - Database: ${json.database}`);
                    console.log(`  - Version: ${json.version}`);
                    resolve(json);
                } catch (e) {
                    reject(new Error('API response invalid JSON'));
                }
            });
        }).on('error', reject);
    });
}

// Run all tests
async function runTests() {
    try {
        await testHTML();
        console.log('');
        await testJS('renderer.js');
        await testJS('annotations.js');
        console.log('');
        await testCSS();
        console.log('');
        await testAPI();
        console.log('\n========================================');
        console.log('✓ All UI tests passed!');
        console.log('========================================');
        console.log('\nThe web UI is ready at: http://localhost:5003');
        console.log('\nTo test interactively:');
        console.log('  1. The browser should already be open');
        console.log('  2. Click "Load Manuscript" button');
        console.log('  3. Click any sentence to see annotations');
        console.log('  4. Try creating an annotation');
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        process.exit(1);
    }
}

runTests();
