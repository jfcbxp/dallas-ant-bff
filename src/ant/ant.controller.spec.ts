import { Test, TestingModule } from '@nestjs/testing';
import { AntController } from './ant.controller';

describe('AntController', () => {
  let controller: AntController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AntController],
    }).compile();

    controller = module.get<AntController>(AntController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
