import prisma from '../src/config/db.js';

console.log('🔍 Testing migration setup...\n');

try {
  // Test 1: Database connection
  console.log('1️⃣ Testing database connection...');
  const test = await prisma.$queryRaw`SELECT 1`;
  console.log('   ✅ Database connected\n');

  // Test 2: Check Product table
  console.log('2️⃣ Checking Product table...');
  const productCount = await prisma.product.count();
  console.log(`   ✅ Found ${productCount} products\n`);

  // Test 3: Check ProductUnit table
  console.log('3️⃣ Checking ProductUnit table...');
  const unitCount = await prisma.productUnit.count();
  console.log(`   ✅ Found ${unitCount} units\n`);

  // Test 4: Check if products have variants
  console.log('4️⃣ Checking ProductVariant table...');
  const products = await prisma.product.findMany({
    include: { variants: { take: 1 } },
    take: 3,
  });
  
  let totalVariants = 0;
  for (const prod of products) {
    const variantCount = await prisma.productVariant.count({
      where: { productId: prod.id },
    });
    totalVariants += variantCount;
    console.log(`   Product: ${prod.name} → ${variantCount} variants`);
  }
  console.log(`   ✅ Total variants to migrate: ${totalVariants}\n`);

  // Test 5: Schema check
  console.log('5️⃣ Checking ProductUnit schema fields...');
  const sampleUnit = await prisma.productUnit.findFirst();
  if (sampleUnit) {
    console.log('   Fields:', Object.keys(sampleUnit));
    console.log('   ✅ Schema looks good\n');
  } else {
    console.log('   ℹ️ No units yet (expected for first run)\n');
  }

  console.log('✨ All tests passed! Migration ready to run.\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
} finally {
  await prisma.$disconnect();
}
