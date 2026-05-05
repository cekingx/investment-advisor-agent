import { Test, TestingModule } from '@nestjs/testing';
import { SendActivity } from './send.activity';
import { NotificationService } from '../../modules/notification/notification.service';

describe('SendActivity', () => {
  let activity: SendActivity;
  let notificationService: { sendMessage: jest.Mock; sendErrorNotification: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendActivity,
        {
          provide: NotificationService,
          useValue: {
            sendMessage: jest.fn(),
            sendErrorNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    activity = module.get(SendActivity);
    notificationService = module.get(NotificationService);
  });

  describe('sendTelegramMessage', () => {
    it('should call notificationService.sendMessage with the correct chatId and text', async () => {
      notificationService.sendMessage.mockResolvedValue(undefined);

      await activity.sendTelegramMessage(12345, 'Daily digest content');

      expect(notificationService.sendMessage).toHaveBeenCalledWith(12345, 'Daily digest content');
    });

    it('should propagate errors so Temporal can apply its retry policy', async () => {
      notificationService.sendMessage.mockRejectedValue(new Error('Telegram 429 Too Many Requests'));

      await expect(activity.sendTelegramMessage(12345, 'text')).rejects.toThrow(
        'Telegram 429 Too Many Requests',
      );
    });
  });

  describe('sendErrorNotification', () => {
    it('should call notificationService.sendErrorNotification with the chatId and error', async () => {
      notificationService.sendErrorNotification.mockResolvedValue(undefined);

      await activity.sendErrorNotification(12345, 'LLM timed out');

      expect(notificationService.sendErrorNotification).toHaveBeenCalledWith(12345, 'LLM timed out');
    });

    it('should swallow errors so secondary failure does not propagate', async () => {
      notificationService.sendErrorNotification.mockRejectedValue(new Error('secondary failure'));

      await expect(activity.sendErrorNotification(12345, 'original error')).resolves.toBeUndefined();
      expect(notificationService.sendErrorNotification).toHaveBeenCalledWith(12345, 'original error');
    });

    it('should complete without throwing even when notificationService throws', async () => {
      notificationService.sendErrorNotification.mockRejectedValue(new Error('bot blocked by user'));

      // Must not throw — workflow catch block must always exit cleanly
      await activity.sendErrorNotification(99999, 'analysis failed');

      expect(notificationService.sendErrorNotification).toHaveBeenCalledWith(99999, 'analysis failed');
    });
  });
});
