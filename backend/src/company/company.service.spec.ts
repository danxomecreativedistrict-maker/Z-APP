import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FakeCloudinary, FakePrisma } from '../../test/fakes';
import { CompanyService } from './company.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: FakePrisma;
  const USER = 'user-1';

  function file(mimetype: string, size = 100): Express.Multer.File {
    return { mimetype, size, buffer: Buffer.from('img') } as unknown as Express.Multer.File;
  }

  beforeEach(() => {
    prisma = new FakePrisma();
    service = new CompanyService(prisma.asService(), new FakeCloudinary().asService());
  });

  it('create crée une fiche (pays par défaut BJ) puis refuse un doublon', async () => {
    const company = await service.create(USER, { name: 'Boutique Z' });
    expect(company.name).toBe('Boutique Z');
    expect(company.country).toBe('BJ');
    await expect(service.create(USER, { name: 'Autre' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('getMine échoue si aucune fiche', async () => {
    await expect(service.getMine('inconnu')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update modifie les informations', async () => {
    await service.create(USER, { name: 'Boutique Z' });
    const updated = await service.update(USER, { city: 'Cotonou', managerPhone: '+22990000000' });
    expect(updated.city).toBe('Cotonou');
    expect(updated.managerPhone).toBe('+22990000000');
  });

  it('updateNova met à jour la config NOVA et getNova la reflète', async () => {
    await service.create(USER, { name: 'Boutique Z' });
    await service.updateNova(USER, { novaName: 'ZARA', novaTone: 'casual' });
    const cfg = await service.getNova(USER);
    expect(cfg.novaName).toBe('ZARA');
    expect(cfg.novaTone).toBe('casual');
  });

  it('completeOnboarding passe onboardingDone à true', async () => {
    await service.create(USER, { name: 'Boutique Z' });
    const updated = await service.completeOnboarding(USER);
    expect(updated.onboardingDone).toBe(true);
  });

  it('uploadLogo rejette un type non autorisé', async () => {
    await service.create(USER, { name: 'Boutique Z' });
    await expect(service.uploadLogo(USER, file('application/pdf'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("uploadLogo accepte une image et stocke l'URL", async () => {
    await service.create(USER, { name: 'Boutique Z' });
    const updated = await service.uploadLogo(USER, file('image/png'));
    expect(updated.logoUrl).toContain('logos/logo');
  });

  it("isolation : un compte ne voit pas la fiche d'un autre", async () => {
    await service.create('user-A', { name: 'Entreprise A' });
    await expect(service.getMine('user-B')).rejects.toBeInstanceOf(NotFoundException);
  });
});
