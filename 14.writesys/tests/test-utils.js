/**
 * Test utilities for WriteSys integration tests
 */

const TEST_MANUSCRIPT_ID = 2; // test.manuscript (always manuscript_id=2)
const TEST_URL = `http://localhost:5003?manuscript_id=${TEST_MANUSCRIPT_ID}`;
const API_BASE_URL = 'http://localhost:5003/api';

/**
 * Clean up all test manuscript data and re-bootstrap
 * Should be called before each test run
 *
 * Deletes all data for manuscript_id >= 2, resets sequences, and re-bootstraps test.manuscript
 */
async function cleanupTestAnnotations() {
  try {
    const { execSync } = require('child_process');

    // Delete all test manuscript data (manuscript_id >= 2) and reset sequences
    execSync(`docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c "
      DELETE FROM annotation_version WHERE annotation_id IN (
        SELECT annotation_id FROM annotation WHERE sentence_id IN (
          SELECT sentence_id FROM sentence WHERE migration_id IN (
            SELECT migration_id FROM migration WHERE manuscript_id >= ${TEST_MANUSCRIPT_ID}
          )
        )
      );
      DELETE FROM annotation WHERE sentence_id IN (
        SELECT sentence_id FROM sentence WHERE migration_id IN (
          SELECT migration_id FROM migration WHERE manuscript_id >= ${TEST_MANUSCRIPT_ID}
        )
      );
      DELETE FROM sentence WHERE migration_id IN (
        SELECT migration_id FROM migration WHERE manuscript_id >= ${TEST_MANUSCRIPT_ID}
      );
      DELETE FROM migration WHERE manuscript_id >= ${TEST_MANUSCRIPT_ID};
      DELETE FROM manuscript WHERE manuscript_id >= ${TEST_MANUSCRIPT_ID};

      -- Reset sequences so test manuscript always gets manuscript_id=2
      ALTER SEQUENCE manuscript_manuscript_id_seq RESTART WITH ${TEST_MANUSCRIPT_ID};
      ALTER SEQUENCE migration_migration_id_seq RESTART WITH ${TEST_MANUSCRIPT_ID};
    " 2>&1`, { encoding: 'utf-8', stdio: 'pipe' });

    // Re-bootstrap test manuscript
    execSync('./bin/writesys --repo manuscripts/test-repo --file test.manuscript --yes 2>&1',
      { encoding: 'utf-8', stdio: 'pipe' });

    console.log('[CLEANUP] Test manuscript cleaned and re-bootstrapped (manuscript_id=2)');
  } catch (error) {
    // Cleanup errors are not fatal, just warn
    console.warn('[CLEANUP] Warning:', error.message);
  }
}

/**
 * Login to the application with test credentials
 * @param {Page} page - Playwright page object
 */
async function loginAsTestUser(page) {
  const loginUrl = 'http://localhost:5003/login.html';

  // Navigate to login page
  await page.goto(loginUrl, { waitUntil: 'networkidle' });

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');

  // Wait a bit for users dropdown to populate via JS
  await page.waitForTimeout(1000);

  // Select testsys user
  await page.selectOption('#username', 'testsys');

  // Wait for manuscripts to populate
  await page.waitForTimeout(500);

  // Fill in password
  await page.fill('#password', 'beebo');

  // Select test.manuscript
  await page.selectOption('#manuscript', 'test.manuscript');

  // Click login
  await page.click('#login-btn');

  // Wait for redirect to main app
  await page.waitForURL('http://localhost:5003/', { timeout: 5000 });

  // Wait for app to be ready
  await page.waitForTimeout(1000);
}

module.exports = {
  TEST_MANUSCRIPT_ID,
  TEST_URL,
  API_BASE_URL,
  cleanupTestAnnotations,
  loginAsTestUser
};
