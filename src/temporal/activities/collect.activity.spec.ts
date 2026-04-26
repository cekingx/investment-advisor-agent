import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectActivity } from './collect.activity';
import { CollectorService } from '../../modules/collector/collector.service';
import { User } from '../../database/entities/user.entity';

describe('CollectActivity', () => {
  let activity: CollectActivity;
  let collectorService: jest.Mocked<CollectorService>;
  let userRepo: { find: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectActivity,
        {
          provide: CollectorService,
          useValue: {
            collectBiRate: jest.fn(),
            collectFred: jest.fn(),
            collectIdxPrices: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    activity = module.get(CollectActivity);
    collectorService = module.get(CollectorService);
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('collectBiRate', () => {
    it('should delegate to collectorService.collectBiRate()', async () => {
      collectorService.collectBiRate.mockResolvedValue(undefined);

      await activity.collectBiRate();

      expect(collectorService.collectBiRate).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from collectorService', async () => {
      collectorService.collectBiRate.mockRejectedValue(new Error('scrape failed'));

      await expect(activity.collectBiRate()).rejects.toThrow('scrape failed');
    });
  });

  describe('collectFred', () => {
    it('should delegate to collectorService.collectFred()', async () => {
      collectorService.collectFred.mockResolvedValue(undefined);

      await activity.collectFred();

      expect(collectorService.collectFred).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from collectorService', async () => {
      collectorService.collectFred.mockRejectedValue(new Error('API error'));

      await expect(activity.collectFred()).rejects.toThrow('API error');
    });
  });

  describe('collectIdxPrices', () => {
    it('should delegate to collectorService.collectIdxPrices()', async () => {
      collectorService.collectIdxPrices.mockResolvedValue(undefined);

      await activity.collectIdxPrices();

      expect(collectorService.collectIdxPrices).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from collectorService', async () => {
      collectorService.collectIdxPrices.mockRejectedValue(new Error('price fetch failed'));

      await expect(activity.collectIdxPrices()).rejects.toThrow('price fetch failed');
    });
  });

  describe('fetchSubscribedUsers', () => {
    it('should query only subscribed users', async () => {
      userRepo.find.mockResolvedValue([]);

      await activity.fetchSubscribedUsers();

      expect(userRepo.find).toHaveBeenCalledWith({ where: { subscribed: true } });
    });

    it('should return chat IDs extracted from user records', async () => {
      userRepo.find.mockResolvedValue([
        { chatId: 111 } as User,
        { chatId: 222 } as User,
        { chatId: 333 } as User,
      ]);

      const result = await activity.fetchSubscribedUsers();

      expect(result).toEqual([111, 222, 333]);
    });

    it('should return an empty array when no users are subscribed', async () => {
      userRepo.find.mockResolvedValue([]);

      const result = await activity.fetchSubscribedUsers();

      expect(result).toEqual([]);
    });
  });
});
