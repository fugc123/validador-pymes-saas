import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateFreeMerchantUseCase } from '../../src/core/application/use-cases/onboarding/create-free-merchant.use-case';
import { User } from '../../src/core/domain/entities/user.entity';
import {
  InMemoryMerchantRepository,
  InMemoryUserRepository,
  InMemoryMembershipRepository,
  InMemorySubscriptionRepository,
  InMemoryPasswordHasher,
} from '../../src/infrastructure/repositories/in-memory.repositories';

describe('CreateFreeMerchantUseCase', () => {
  let useCase: CreateFreeMerchantUseCase;
  let merchantRepo: InMemoryMerchantRepository;
  let userRepo: InMemoryUserRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let subscriptionRepo: InMemorySubscriptionRepository;
  let passwordHasher: InMemoryPasswordHasher;

  beforeEach(() => {
    merchantRepo = new InMemoryMerchantRepository();
    userRepo = new InMemoryUserRepository();
    membershipRepo = new InMemoryMembershipRepository();
    subscriptionRepo = new InMemorySubscriptionRepository();
    passwordHasher = new InMemoryPasswordHasher();

    useCase = new CreateFreeMerchantUseCase(
      merchantRepo,
      userRepo,
      membershipRepo,
      subscriptionRepo,
      passwordHasher,
    );
  });

  it('should provision a new merchant, owner user, active membership and lifetime free subscription', async () => {
    const output = await useCase.execute({
      businessName: 'Boutique María',
      ownerName: 'María Benítez',
      email: 'maria@boutique.com',
      password: 'mariaSecurePass123',
    });

    expect(output.merchantName).toBe('Boutique María');
    expect(output.merchantSlug).toBe('boutique-maria');
    expect(output.webhookSecret).toContain('sec_boutique_maria');
    expect(output.ownerEmail).toBe('maria@boutique.com');
    expect(output.subscriptionStatus).toBe('active');
    expect(output.isLifetime).toBe(true);
    expect(output.expiresAt.getFullYear()).toBe(2099);

    // Verify stored merchant
    const storedMerchant = await merchantRepo.findBySlug('boutique-maria');
    expect(storedMerchant).toBeDefined();
    expect(storedMerchant?.status).toBe('active');

    // Verify stored user
    const storedUser = await userRepo.findByEmail('maria@boutique.com');
    expect(storedUser).toBeDefined();
    expect(storedUser?.isSuperAdmin).toBe(false);

    // Verify membership
    const membership = await membershipRepo.findByUserAndMerchant(storedUser!.id!, storedMerchant!.id!);
    expect(membership).toBeDefined();
    expect(membership?.role).toBe('MERCHANT_OWNER');

    // Verify subscription
    const sub = await subscriptionRepo.findByTenantId(storedMerchant!.id!);
    expect(sub).toBeDefined();
    expect(sub?.status).toBe('active');
    expect(sub?.currentPeriodEnd.getFullYear()).toBe(2099);
  });

  it('rejects creating a free merchant for an already-registered email and never rewrites the password', async () => {
    const originalHash = await passwordHasher.hash('OriginalPass1');
    await userRepo.save(
      new User({
        id: 'usr-existing-owner',
        email: 'existing@shop.com',
        passwordHash: originalHash,
        fullName: 'Existing Owner',
      }),
    );

    await expect(
      useCase.execute({
        businessName: 'Another Shop',
        ownerName: 'New Owner',
        email: 'existing@shop.com',
        password: 'BrandNewPass1',
      }),
    ).rejects.toThrow(ConflictException);

    const stored = await userRepo.findByEmail('existing@shop.com');
    expect(await passwordHasher.compare('OriginalPass1', stored!.passwordHash)).toBe(true);
    expect(await passwordHasher.compare('BrandNewPass1', stored!.passwordHash)).toBe(false);

    // No merchant is provisioned and no membership is attached to the existing account.
    expect(await merchantRepo.findBySlug('another-shop')).toBeNull();
    expect(await membershipRepo.findByUserAndMerchant(stored!.id!, 'another-shop')).toBeNull();
  });

  it.each([undefined, '', '   '])(
    'rejects password %p instead of falling back to a default',
    async (password) => {
      await expect(
        useCase.execute({
          businessName: 'No Pass Shop',
          ownerName: 'Owner',
          email: 'nopass@shop.com',
          password,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(await userRepo.findByEmail('nopass@shop.com')).toBeNull();
      expect(await merchantRepo.findBySlug('no-pass-shop')).toBeNull();
    },
  );
});
