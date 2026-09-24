#!/usr/bin/env node
import prisma from '../src/config/db.js';

const isDryRun = process.argv[2] === 'dry-run';

console.log('\n════════════════════════════════════════════');
console.log('  PRODUCT UNITS MIGRATION');
console.log('════════════════════════════════════════════\n');

try {
  // Fetch all products with variants
  const products = await prisma.product.findMany({
    include: { variants: true },
  });

  console.log(`📦 Found ${products.length} products\n`);

  let totalVariants = 0;
  let unitsCreated = 0;
  const productResults = [];

  for (const product of products) {
    if (product.variants.length === 0) continue;

    console.log(`Processing: ${product.name}`);
    console.log(`  Variants: ${product.variants.length}`);

    // Calculate total base stock
    let totalBaseStock = 0;
    for (const variant of product.variants) {
      const base = Number(variant.stockQty) * Number(variant.conversionToBase || 1);
      totalBaseStock += base;
    }

    console.log(`  Base stock: ${totalBaseStock}`);

    if (!isDryRun) {
      // Update Product baseStockQty
      await prisma.product.update({
        where: { id: product.id },
        data: { baseStockQty: totalBaseStock },
      });

      // Create ProductUnits
      for (const variant of product.variants) {
        try {
          await prisma.productUnit.create({
            data: {
              productId: product.id,
              name: variant.name,
              sku: variant.sku || `${product.id}-${variant.id}`,
              barcode: variant.barcode || `${product.id}-${variant.id}`,
              sellPrice: variant.sellPrice,
              wholesalePrice: variant.wholesalePrice,
              conversionToBase: variant.conversionToBase || 1,
              isSellable: variant.allowRetail,
              isDefault: variant.isDefault,
              isActive: variant.isActive,
            },
          });
          unitsCreated++;
        } catch (err) {
          if (err.code === 'P2002') {
            const field = err.meta?.target?.[0];
            console.log(`  ⚠️ Duplicate ${field} - using fallback ID`);
            
            // Retry dengan generated SKU dan barcode
            try {
              await prisma.productUnit.create({
                data: {
                  productId: product.id,
                  name: variant.name,
                  sku: `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  barcode: `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  sellPrice: variant.sellPrice,
                  wholesalePrice: variant.wholesalePrice,
                  conversionToBase: variant.conversionToBase || 1,
                  isSellable: variant.allowRetail,
                  isDefault: variant.isDefault,
                  isActive: variant.isActive,
                },
              });
              unitsCreated++;
            } catch (retryErr) {
              console.log(`  ❌ Failed to create unit: ${retryErr.message}`);
            }
          } else {
            throw err;
          }
        }
      }
      console.log(`  ✅ Created ${product.variants.length} units\n`);
    } else {
      console.log(`  ℹ️ Would create ${product.variants.length} units\n`);
      unitsCreated += product.variants.length;
    }

    totalVariants += product.variants.length;
    productResults.push({
      name: product.name,
      variants: product.variants.length,
      baseStock: totalBaseStock,
    });
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`  Products processed: ${productResults.length}`);
  console.log(`  Total variants: ${totalVariants}`);
  console.log(`  Units created: ${unitsCreated}`);
  console.log('════════════════════════════════════════════\n');

  if (isDryRun) {
    console.log('✨ DRY RUN COMPLETE - Ready to execute\n');
    console.log('To apply migration, run:');
    console.log('  npm run migrate:product-units -- execute\n');
  } else {
    console.log('✅ MIGRATION COMPLETE\n');
  }

  process.exit(0);
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
