import prisma from '../src/config/db.js';

/**
 * Dry-run migration script: ProductVariant → ProductUnit
 * Jalankan ini SEBELUM migrasi actual untuk verify hasilnya
 * 
 * Usage:
 *   node backend/scripts/migrateProductUnits.mjs dry-run
 *   node backend/scripts/migrateProductUnits.mjs execute
 */

const args = process.argv.slice(2);
const isDryRun = args[0] === 'dry-run' || !args[0];

async function migrateProductUnits() {
  try {
    console.log(`\n🔄 Migration: ProductVariant → ProductUnit (${isDryRun ? 'DRY RUN' : 'EXECUTE'})\n`);

    // 1. Fetch all products dengan variants
    const products = await prisma.product.findMany({
      include: { variants: true },
    });

    console.log(`📦 Total produk: ${products.length}\n`);

    let totalVariants = 0;
    let totalUnitsCreated = 0;
    const results = [];

    // 2. Convert setiap variant menjadi ProductUnit
    for (const product of products) {
      if (product.variants.length === 0) continue;

      const productResult = {
        productId: product.id,
        productName: product.name,
        variantsBefore: product.variants.length,
        unitsAfter: 0,
        baseStockBefore: 0,
        baseStockAfter: 0,
        issues: [],
      };

      // Hitung total stok dari semua variant (konversi ke satuan dasar)
      let totalBaseStock = 0;
      for (const variant of product.variants) {
        const variantInBase = Number(variant.stockQty) * Number(variant.conversionToBase || 1);
        totalBaseStock += variantInBase;
      }

      productResult.baseStockBefore = totalBaseStock;
      productResult.baseStockAfter = totalBaseStock;

      if (!isDryRun) {
        // Update Product dengan baseStockQty
        await prisma.product.update({
          where: { id: product.id },
          data: { baseStockQty: totalBaseStock },
        });

        // Create ProductUnit untuk setiap variant
        for (const variant of product.variants) {
          try {
            await prisma.productUnit.create({
              data: {
                productId: product.id,
                name: variant.name,
                sku: variant.sku,
                barcode: variant.barcode,
                sellPrice: variant.sellPrice,
                wholesalePrice: variant.wholesalePrice,
                conversionToBase: variant.conversionToBase || 1,
                isSellable: variant.allowRetail,
                isDefault: variant.isDefault,
                isActive: variant.isActive,
              },
            });
            productResult.unitsAfter += 1;
            totalUnitsCreated += 1;
          } catch (err) {
            productResult.issues.push(`Variant ${variant.name}: ${err.message}`);
          }
        }
      } else {
        productResult.unitsAfter = product.variants.length;
        totalUnitsCreated += product.variants.length;
      }

      totalVariants += product.variants.length;
      results.push(productResult);
    }

    // 3. Display hasil
    console.log(`✅ Konversi selesai (${isDryRun ? 'DRY RUN' : 'EXECUTE'}):\n`);
    console.log(`   Total produk dengan variant: ${results.length}`);
    console.log(`   Total variant dikonversi: ${totalVariants}`);
    console.log(`   Total unit dibuat: ${totalUnitsCreated}\n`);

    // 4. Show summary per produk
    console.log(`📋 DETAIL PER PRODUK:\n`);
    for (const result of results.slice(0, 10)) {
      // Show first 10 only
      console.log(`   ${result.productName}`);
      console.log(`   ├─ Variant: ${result.variantsBefore} → Unit: ${result.unitsAfter}`);
      console.log(`   ├─ Stok dasar: ${result.baseStockBefore.toFixed(2)} → ${result.baseStockAfter.toFixed(2)}`);
      if (result.issues.length > 0) {
        console.log(`   ├─ ⚠️ Issues:`);
        result.issues.forEach((issue) => console.log(`   │  • ${issue}`));
      }
      console.log();
    }

    if (results.length > 10) {
      console.log(`   ... dan ${results.length - 10} produk lainnya\n`);
    }

    // 5. Backup data sebelum execute
    if (isDryRun) {
      console.log(`\n📌 NEXT STEPS (DRY RUN):`);
      console.log(`   1. Review hasil di atas`);
      console.log(`   2. Jika OK, jalankan: node backend/scripts/migrateProductUnits.mjs execute`);
      console.log(`   3. Backup database manual sebelum execute\n`);
    } else {
      console.log(`\n✨ MIGRATION COMPLETED SUCCESSFULLY`);
      console.log(`   ✅ ProductUnit dibuat dari ProductVariant`);
      console.log(`   ✅ Stok dipusat ke baseStockQty`);
      console.log(`   ⚠️ ProductVariant masih ada (perlu cleanup manual)\n`);
    }

    // Check for issues
    const issueCount = results.reduce((sum, r) => sum + r.issues.length, 0);
    if (issueCount > 0) {
      console.log(`\n⚠️ WARNINGS: ${issueCount} issues ditemukan`);
      for (const result of results) {
        if (result.issues.length > 0) {
          console.log(`   ${result.productName}:`);
          result.issues.forEach((issue) => console.log(`   • ${issue}`));
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateProductUnits();
