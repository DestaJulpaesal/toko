import { useEffect, useState } from 'react';

// Foto katalog dengan fallback. Jika src kosong / gagal dimuat, `children` dirender sebagai placeholder.
// loading="lazy" + decoding="async" supaya halaman katalog ringan; width/height hanya petunjuk rasio
// (ukuran tampilan tetap diatur CSS pada wadahnya) sehingga layout tidak bergeser saat gambar tiba.
export default function CatalogImage({
  src,
  alt,
  className = '',
  style,
  children,
  width = 400,
  height = 300,
  loading = 'lazy',
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        className={`catalog-photo ${className}`}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }

  return children;
}
