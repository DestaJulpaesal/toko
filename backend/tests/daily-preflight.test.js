import 'dotenv/config';
import { runDailyPreflightCheck } from '../src/services/preflightService.js';

async function main() {
  console.log('===============================================================');
  console.log('       GLOSIR - DAILY PREFLIGHT AUTOMATED TEST SUITE          ');
  console.log('       Verifikasi Transaksi Kasir, Stok, & Keuangan Harian     ');
  console.log('===============================================================\n');

  try {
    const result = await runDailyPreflightCheck();

    console.log(`ID Pengujian: ${result.testRunId}`);
    console.log(`Waktu Uji   : ${new Date(result.timestamp).toLocaleString('id-ID')}`);
    console.log(`Durasi      : ${result.durationMs} ms\n`);
    console.log('------------------ HASIL PEMERIKSAAN FITUR --------------------');

    for (let i = 0; i < result.tests.length; i++) {
      const test = result.tests[i];
      const icon = test.passed ? ' [PASS] ' : ' [FAIL] ';
      const symbol = test.passed ? '✓' : '✗';
      console.log(`\n${i + 1}. ${symbol}${icon}${test.name}`);
      console.log(`   ${test.message}`);
    }

    console.log('\n===============================================================');
    console.log(`RINGKASAN: ${result.summary.passed}/${result.summary.total} Uji Berhasil (${result.summary.failed} Gagal)`);

    if (result.allPassed) {
      console.log('STATUS   : SEMUA SISTEM SIAP DIGUNAKAN UNTUK OPERASIONAL HARIAN! ');
      console.log('===============================================================\n');
      process.exit(0);
    } else {
      console.error('STATUS   : DITEMUKAN MASALAH SISTEM. PERIKSA LOG DI ATAS!       ');
      console.error('===============================================================\n');
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n[FATAL ERROR] Gagal menjalankan preflight check: ${error.message}\n`, error);
    process.exit(1);
  }
}

main();
