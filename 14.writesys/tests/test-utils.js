/**
 * Test utilities for WriteSys integration tests
 */

const TEST_MANUSCRIPT_ID = 2; // test.manuscript (updated after full reset)
const TEST_URL = `http://localhost:5003?manuscript_id=${TEST_MANUSCRIPT_ID}`;
const API_BASE_URL = 'http://localhost:5003/api';

/**
 * Clean up all annotations for the test manuscript
 * Should be called before and after each test run
 *
 * Uses direct database cleanup for simplicity
 */
async function cleanupTestAnnotations() {
  try {
    const { execSync } = require('child_process');

    // Delete all annotations for sentences in manuscript_id=2
    const result = execSync(`docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -A -c "WITH deleted AS (DELETE FROM annotation WHERE sentence_id IN (SELECT sentence_id FROM sentence WHERE migration_id IN (SELECT migration_id FROM migration WHERE manuscript_id = ${TEST_MANUSCRIPT_ID})) RETURNING *) SELECT COUNT(*) FROM deleted;"`,
      { encoding: 'utf-8' });

    const count = parseInt(result.trim()) || 0;
    if (count > 0) {
      console.log(`[CLEANUP] Deleted ${count} test annotations`);
    }
  } catch (error) {
    // Cleanup errors are not fatal, just warn
    console.warn('[CLEANUP] Warning:', error.message);
  }
}

module.exports = {
  TEST_MANUSCRIPT_ID,
  TEST_URL,
  API_BASE_URL,
  cleanupTestAnnotations
};
