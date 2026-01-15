import { Test, TestingModule } from '@nestjs/testing';
import { AntService } from './ant.service';

describe('AntService', () => {
  let service: AntService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AntService],
    }).compile();

    service = module.get<AntService>(AntService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
