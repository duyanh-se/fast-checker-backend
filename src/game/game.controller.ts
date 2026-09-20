import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { CreateChallengeDto, UpdateChallengeDto } from './dto/manage-challenge.dto';
import { GameService } from './game.service';

@ApiTags('game')
@Controller()
export class GameController {
  constructor(private readonly game: GameService) {}

  @Post('sessions') @ApiOperation({ summary: 'Tạo phòng chơi (giáo viên)' })
  createSession(@Body() dto: CreateSessionDto) { return this.game.createSession(dto); }

  @Get('sessions/code/:code') @ApiOperation({ summary: 'Tìm phòng theo mã' })
  getByCode(@Param('code') code: string) { return this.game.getByCode(code); }

  @Get('sessions/:id') @ApiOperation({ summary: 'Lấy trạng thái phòng' })
  getSession(@Param('id') id: string) { return this.game.getSession(id); }

  @Get('sessions/:id/admin') @ApiHeader({ name: 'x-admin-token', required: true }) @ApiOperation({ summary: 'Lấy thông tin bảng điều khiển giáo viên' })
  adminState(@Param('id') id: string, @Headers('x-admin-token') token: string) { return this.game.adminState(id, token); }

  @Get('sessions/:id/questions') @ApiHeader({ name: 'x-admin-token', required: true }) @ApiOperation({ summary: 'Lấy bộ câu hỏi để quản lý' })
  adminChallenges(@Param('id') id: string, @Headers('x-admin-token') token: string) { return this.game.adminChallenges(id, token); }

  @Post('sessions/:id/questions') @ApiHeader({ name: 'x-admin-token', required: true }) @ApiBody({ type: CreateChallengeDto }) @ApiOperation({ summary: 'Tạo câu hỏi mới' })
  createChallenge(@Param('id') id: string, @Headers('x-admin-token') token: string, @Body() dto: CreateChallengeDto) { return this.game.createChallenge(id, token, dto); }

  @Patch('sessions/:sessionId/questions/:challengeId') @ApiHeader({ name: 'x-admin-token', required: true }) @ApiBody({ type: UpdateChallengeDto }) @ApiOperation({ summary: 'Cập nhật câu hỏi' })
  updateChallenge(@Param('sessionId') sessionId: string, @Param('challengeId') challengeId: string, @Headers('x-admin-token') token: string, @Body() dto: UpdateChallengeDto) { return this.game.updateChallenge(sessionId, token, challengeId, dto); }

  @Delete('sessions/:sessionId/questions/:challengeId') @ApiHeader({ name: 'x-admin-token', required: true }) @ApiOperation({ summary: 'Ẩn câu hỏi khỏi bộ nhiệm vụ' })
  archiveChallenge(@Param('sessionId') sessionId: string, @Param('challengeId') challengeId: string, @Headers('x-admin-token') token: string) { return this.game.archiveChallenge(sessionId, token, challengeId); }

  @Post('sessions/:id/start') @ApiHeader({ name: 'x-admin-token', required: true }) @ApiOperation({ summary: 'Bắt đầu phòng chơi (giáo viên)' })
  start(@Param('id') id: string, @Headers('x-admin-token') token: string) { return this.game.startSession(id, token); }

  @Post('sessions/:id/end') @ApiHeader({ name: 'x-admin-token', required: true }) @ApiOperation({ summary: 'Kết thúc phòng chơi (giáo viên)' })
  end(@Param('id') id: string, @Headers('x-admin-token') token: string) { return this.game.endSession(id, token); }

  @Post('sessions/join') @ApiOperation({ summary: 'Tham gia phòng bằng mã và biệt danh' })
  join(@Body() dto: JoinSessionDto) { return this.game.join(dto); }

  @Get('players/me/state') @ApiHeader({ name: 'x-player-token', required: true })
  state(@Headers('x-player-token') token: string) { return this.game.playerState(token); }

  @Get('challenges') @ApiHeader({ name: 'x-player-token', required: true })
  challenges(@Headers('x-player-token') token: string) { return this.game.listChallenges(token); }

  @Get('players/me/knowledge-map') @ApiHeader({ name: 'x-player-token', required: true })
  @ApiOperation({ summary: 'Bản đồ kiến thức sau quá trình điều tra' })
  knowledgeMap(@Headers('x-player-token') token: string) { return this.game.knowledgeMap(token); }

  @Post('attempts') @ApiHeader({ name: 'x-player-token', required: true })
  @ApiOperation({ summary: 'Bắt đầu nhiệm vụ, máy chủ bắt đầu tính giờ' })
  startAttempt(@Headers('x-player-token') token: string, @Body() dto: StartAttemptDto) { return this.game.startAttempt(token, dto.challengeId); }

  @Post('attempts/:id/submissions') @ApiHeader({ name: 'x-player-token', required: true })
  @ApiBody({ type: SubmitAnswerDto }) @ApiResponse({ status: 201, description: 'Kết quả chấm điểm và bảng xếp hạng mới' })
  submit(@Headers('x-player-token') token: string, @Param('id') id: string, @Body() dto: SubmitAnswerDto) { return this.game.submitAttempt(token, id, dto.answer); }

  @Get('sessions/:id/leaderboard') @ApiOperation({ summary: 'Lấy nhanh bảng xếp hạng trực tiếp' })
  leaderboard(@Param('id') id: string) { return this.game.leaderboard(id); }
}
