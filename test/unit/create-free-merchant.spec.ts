import { CreateFreeMerchantUseCase } from '../../src/core/application/use-cases/onboarding/create-free-merchant.use-case';
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
});
