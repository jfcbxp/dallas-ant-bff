import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AntService } from './ant.service';
import { AntController } from './ant.controller';

@Module({
	imports: [PrismaModule],
	providers: [AntService],
	controllers: [AntController],
	exports: [AntService],
})
export class AntModule {}
