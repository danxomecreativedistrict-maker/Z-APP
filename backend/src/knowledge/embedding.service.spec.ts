import { EMBEDDING_DIMS, EmbeddingService } from './embedding.service';
import { makeConfig } from '../../test/fakes';

describe('EmbeddingService (repli dev)', () => {
  const service = new EmbeddingService(makeConfig());

  // Vecteurs normalisés L2 → produit scalaire = similarité cosinus.
  function cosine(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
    return dot;
  }

  it('produit un vecteur de 1536 dims normalisé', async () => {
    const v = await service.embed('bonjour le monde');
    expect(v).toHaveLength(EMBEDDING_DIMS);
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1, 4);
  });

  it('rapproche les textes partageant des mots', async () => {
    const a = await service.embed('livraison gratuite à Cotonou');
    const b = await service.embed('la livraison gratuite à Cotonou pour tous');
    const c = await service.embed('réparation de moteurs diesel industriels');
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
});
