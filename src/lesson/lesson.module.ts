import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AntModule } from '../ant/ant.module';

@Module({
	imports: [PrismaModule, AntModule],
	controllers: [LessonController],
	providers: [LessonService],
})
export class LessonModule {}
