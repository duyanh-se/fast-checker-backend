import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({ imports: [DatabaseModule], controllers: [GameController], providers: [GameService, GameGateway] })
export class GameModule {}
