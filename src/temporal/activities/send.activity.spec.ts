import { Test, TestingModule } from '@nestjs/testing';
import { SendActivity } from './send.activity';
import { TelegramService } from '../../modules/telegram/telegram.service';

describe('SendActivity', () => {
  let activity: SendActivity;
  let telegramService: { sendMessage: jest.Mock; sendErrorNotification: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendActivity,
        {
          provide: TelegramService,
          useValue: {
            sendMessage: jest.fn(),
            sendErrorNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    activity = module.get(SendActivity);
    telegramService = module.get(TelegramService);
  });

  describe('sendTelegramMessage', () => {
    it('should call telegramService.sendMessage with the correct chatId and text', async () => {
      telegramService.sendMessage.mockResolvedValue(undefined);

      await activity.sendTelegramMessage(12345, 'Daily digest content');

      expect(telegramService.sendMessage).toHaveBeenCalledWith(12345, 'Daily digest content');
    });

    it('should propagate errors so Temporal can apply its retry policy', async () => {
      telegramService.sendMessage.mockRejectedValue(new Error('Telegram 429 Too Many Requests'));

      await expect(activity.sendTelegramMessage(12345, 'text')).rejects.toThrow(
        'Telegram 429 Too Many Requests',
      );
    });
  });

  describe('sendErrorNotification', () => {
    it('should call telegramService.sendErrorNotification with the chatId', async () => {
      telegramService.sendErrorNotification.mockResolvedValue(undefined);

      await activity.sendErrorNotification(12345, 'LLM timed out');

      expect(telegramService.sendErrorNotification).toHaveBeenCalledWith(12345);
    });

    it('should swallow errors so secondary failure does not propagate', async () => {
      telegramService.sendErrorNotification.mockRejectedValue(new Error('secondary failure'));

      await expect(activity.sendErrorNotification(12345, 'original error')).resolves.toBeUndefined();
    });

    it('should complete without throwing even when telegramService throws', async () => {
      telegramService.sendErrorNotification.mockRejectedValue(new Error('bot blocked by user'));

      // Must not throw — workflow catch block must always exit cleanly
      await activity.sendErrorNotification(99999, 'analysis failed');

      expect(telegramService.sendErrorNotification).toHaveBeenCalledWith(99999);
    });
  });
});
