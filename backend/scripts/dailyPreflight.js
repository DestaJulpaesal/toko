import 'dotenv/config';
import { runDailyPreflightCheck } from '../src/services/preflightService.js';

async function main() {
  console.log('===============================================================');
  console.log('       GLOSIR - DAILY PREFLIGHT CHECK                         ');
  console.log('       Menulis dan menghapus fixture pada database terhubung  ');
  console.log('===============================================================\n');
  console.warn('Pastikan DATABASE_URL menunjuk ke database uji, bukan produksi.');

  try {
    const result = await runDailyPreflightCheck();
    console.log(`ID Pengujian: ${result.testRunId}`);
    console.log(`Waktu Uji   : ${new Date(result.timestamp).toLocaleString('id-ID')}`);
    console.log(`Durasi      : ${result.durationMs} ms\n`);
    for (const [index, check] of result.tests.entries()) {
      console.log(`${index + 1}. ${check.passed ? '[PASS]' : '[FAIL]'} ${check.name}`);
      console.log(`   ${check.message}`);
    }
    console.log(`\nRINGKASAN: ${result.summary.passed}/${result.summary.total} lulus, ${result.summary.failed} gagal`);
    if (!result.allPassed) process.exitCode = 1;
  } catch (error) {
    console.error(`Preflight gagal: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
