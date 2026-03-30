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

module.exports = {
  TEST_MANUSCRIPT_ID,
  TEST_URL,
  API_BASE_URL,
  cleanupTestAnnotations
};
