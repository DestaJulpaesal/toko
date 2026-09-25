import prisma from '../src/config/db.js';

async function seed() {
  console.log('Seeding database via Prisma JS Client...');

  // 1. Categories
  const categoriesData = [
    { id: 'cat-glosir', name: 'Glosir', slug: 'glosir', description: 'Kebutuhan harian dan produk rumah tangga.' },
    { id: 'cat-bahan-pokok', name: 'Bahan Pokok', slug: 'bahan-pokok', description: 'Beras dan kebutuhan pokok keluarga.' },
    { id: 'cat-dapur', name: 'Kebutuhan Dapur', slug: 'kebutuhan-dapur', description: 'Produk dapur untuk rumah dan usaha kecil.' },
    { id: 'cat-parsel', name: 'Parsel', slug: 'parsel', description: 'Parcel untuk keluarga dan momen spesial.' },
    { id: 'cat-acara', name: 'Acara', slug: 'acara', description: 'Paket kebutuhan hajatan dan acara keluarga.' },
    { id: 'cat-minuman', name: 'Minuman', slug: 'minuman', description: 'Kopi, teh, dan minuman pilihan.' },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name, slug: cat.slug, description: cat.description },
      create: cat,
    });
  }
  console.log('Categories created.');

  // 2. Products & Variants
  const productsData = [
    {
      id: 'prod-kopi',
      sku: 'GLS-KOPI-001',
      name: 'Kopi Bubuk Premium 250g',
      slug: 'kopi-bubuk-premium-250g',
      description: 'Kopi bubuk pilihan dengan aroma kuat untuk menemani aktivitas harian.',
      categoryId: 'cat-glosir',
      status: 'ACTIVE',
      isFeatured: true,
      isParcel: false,
      stockWarning: 5,
      imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-kopi-default',
        name: 'Kemasan 250g',
        sku: 'GLS-KOPI-001-DEFAULT',
        barcode: '8901234560010',
        basePrice: 38000,
        sellPrice: 48000,
        stockQty: 25,
        unit: 'pack',
      }
    },
    {
      id: 'prod-beras',
      sku: 'GLS-BRS-005',
      name: 'Beras Super Ramos 5 Kg',
      slug: 'beras-super-ramos-5-kg',
      description: 'Beras pilihan dalam kemasan praktis untuk kebutuhan keluarga.',
      categoryId: 'cat-bahan-pokok',
      status: 'ACTIVE',
      isFeatured: true,
      isParcel: false,
      stockWarning: 5,
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-beras-default',
        name: 'Kemasan 5 Kg',
        sku: 'GLS-BRS-005-DEFAULT',
        barcode: '8901234560027',
        basePrice: 62000,
        sellPrice: 72000,
        stockQty: 18,
        unit: 'karung',
      }
    },
    {
      id: 'prod-minyak',
      sku: 'GLS-MNYK-002',
      name: 'Minyak Goreng Sawit 2L',
      slug: 'minyak-goreng-sawit-2l',
      description: 'Minyak goreng jernih untuk kebutuhan dapur harian.',
      categoryId: 'cat-dapur',
      status: 'ACTIVE',
      isFeatured: false,
      isParcel: false,
      stockWarning: 5,
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-minyak-default',
        name: 'Kemasan 2 Liter',
        sku: 'GLS-MNYK-002-DEFAULT',
        barcode: '8901234560034',
        basePrice: 30000,
        sellPrice: 35000,
        stockQty: 9,
        unit: 'botol',
      }
    },
    {
      id: 'prod-parcel',
      sku: 'GLS-PRCL-001',
      name: 'Parcel Special Hari Raya',
      slug: 'parcel-special-hari-raya',
      description: 'Parcel hangat penuh kebahagiaan untuk keluarga dan kerabat.',
      categoryId: 'cat-parsel',
      status: 'ACTIVE',
      isFeatured: true,
      isParcel: true,
      stockWarning: 3,
      imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-parcel-default',
        name: 'Paket Standar',
        sku: 'GLS-PRCL-001-DEFAULT',
        barcode: '8901234560041',
        basePrice: 95000,
        sellPrice: 120000,
        stockQty: 12,
        unit: 'paket',
      }
    },
    {
      id: 'prod-hajatan',
      sku: 'GLS-HJTN-020',
      name: 'Paket Sembako Hajatan 20 Porsi',
      slug: 'paket-sembako-hajatan-20-porsi',
      description: 'Paket kebutuhan acara yang dapat disesuaikan.',
      categoryId: 'cat-acara',
      status: 'ACTIVE',
      isFeatured: false,
      isParcel: true,
      stockWarning: 2,
      imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-hajatan-default',
        name: 'Paket 20 Porsi',
        sku: 'GLS-HJTN-020-DEFAULT',
        barcode: '8901234560058',
        basePrice: 480000,
        sellPrice: 580000,
        stockQty: 4,
        unit: 'paket',
      }
    },
    {
      id: 'prod-teh',
      sku: 'GLS-TEH-040',
      name: 'Teh Celup Melati 40 pcs',
      slug: 'teh-celup-melati-40-pcs',
      description: 'Teh celup aroma melati praktis untuk rumah dan acara.',
      categoryId: 'cat-minuman',
      status: 'ACTIVE',
      isFeatured: false,
      isParcel: false,
      stockWarning: 5,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-teh-default',
        name: 'Isi 40 pcs',
        sku: 'GLS-TEH-040-DEFAULT',
        barcode: '8901234560065',
        basePrice: 48000,
        sellPrice: 59000,
        stockQty: 20,
        unit: 'box',
      }
    },
    {
      id: 'prod-gula',
      sku: 'GLS-GULA-001',
      name: 'Gula Pasir Kristal Putih 1kg',
      slug: 'gula-pasir-kristal-putih-1kg',
      description: 'Gula pasir manis murni untuk minuman dan olahan dapur.',
      categoryId: 'cat-bahan-pokok',
      status: 'ACTIVE',
      isFeatured: true,
      isParcel: false,
      stockWarning: 10,
      imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-gula-default',
        name: 'Kemasan 1kg',
        sku: 'GLS-GULA-001-DEFAULT',
        barcode: '8901234560072',
        basePrice: 14500,
        sellPrice: 17500,
        stockQty: 50,
        unit: 'kg',
      }
    },
    {
      id: 'prod-sirup',
      sku: 'GLS-SRP-001',
      name: 'Sirup Marjan Cocopandan 460ml',
      slug: 'sirup-marjan-cocopandan-460ml',
      description: 'Sirup khas manis legit nikmat untuk es buah dan suguhan tamu.',
      categoryId: 'cat-minuman',
      status: 'ACTIVE',
      isFeatured: true,
      isParcel: false,
      stockWarning: 5,
      imageUrl: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=600&q=80',
      variant: {
        id: 'var-sirup-default',
        name: 'Botol 460ml',
        sku: 'GLS-SRP-001-DEFAULT',
        barcode: '8901234560089',
        basePrice: 19000,
        sellPrice: 23500,
        stockQty: 30,
        unit: 'botol',
      }
    }
  ];

  for (const p of productsData) {
    const { variant, ...productFields } = p;
    await prisma.product.upsert({
      where: { id: productFields.id },
      update: productFields,
      create: productFields,
    });

    await prisma.productVariant.upsert({
      where: { id: variant.id },
      update: {
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        basePrice: variant.basePrice,
        sellPrice: variant.sellPrice,
        stockQty: variant.stockQty,
        unit: variant.unit,
        isDefault: true,
        isActive: true,
      },
      create: {
        ...variant,
        productId: productFields.id,
        isDefault: true,
        isActive: true,
      },
    });
  }
  console.log('Products & Variants created.');

  // 3. Parcels
  const parcelsData = [
    {
      id: 'parcel-keluarga',
      name: 'Parcel Silaturahmi Keluarga',
      slug: 'parcel-silaturahmi-keluarga',
      description: 'Pilihan hangat untuk silaturahmi dan berbagi ke sanak saudara.',
      type: 'STANDARD',
      price: 120000,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'parcel-premium',
      name: 'Parcel Berkah Premium',
      slug: 'parcel-berkah-premium',
      description: 'Isi lebih lengkap dengan kemasan eksklusif nan elegan.',
      type: 'STANDARD',
      price: 250000,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1513885535751-8b9238bd48d7?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'parcel-hajatan',
      name: 'Paket Parcel Acara Syukuran',
      slug: 'paket-parcel-acara-syukuran',
      description: 'Paket kebutuhan acara sesuai jumlah tamu undangan.',
      type: 'CUSTOM',
      price: 580000,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    }
  ];

  for (const parcel of parcelsData) {
    await prisma.parcel.upsert({
      where: { id: parcel.id },
      update: parcel,
      create: parcel,
    });
  }
  console.log('Parcels created.');

  // 4. Event Packages
  const eventPackagesData = [
    {
      id: 'event-syukuran-1',
      name: 'Paket Syukuran Ringkas',
      slug: 'paket-syukuran-ringkas',
      description: 'Paket bahan pokok hemat untuk syukuran keluarga dan pengajian.',
      price: 350000,
      isActive: true,
      isCustom: false,
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'event-hajatan-1',
      name: 'Paket Hajatan Lengkap 50 Porsi',
      slug: 'paket-hajatan-lengkap-50-porsi',
      description: 'Solusi praktis semua bahan masak dan suguhan hajatan.',
      price: 850000,
      isActive: true,
      isCustom: true,
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    }
  ];

  for (const ep of eventPackagesData) {
    await prisma.eventPackage.upsert({
      where: { id: ep.id },
      update: ep,
      create: ep,
    });
  }
  console.log('Event Packages created.');

  const pCount = await prisma.product.count();
  const cCount = await prisma.category.count();
  const parcelCount = await prisma.parcel.count();
  const epCount = await prisma.eventPackage.count();

  console.log(`\n🎉 Seed finished! Status DB:
- Products: ${pCount}
- Categories: ${cCount}
- Parcels: ${parcelCount}
- Event Packages: ${epCount}
`);
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
