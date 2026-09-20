import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Challenge, ChallengeType, Prisma, SessionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { GameGateway } from './game.gateway';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { CreateChallengeDto, UpdateChallengeDto } from './dto/manage-challenge.dto';

type JsonObject = Record<string, unknown>;
type Evaluation = { score: number; criteriaHit: number; criteriaTotal: number; correct: boolean; explanation: string; timedOut: boolean };

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService, private readonly gateway: GameGateway) {}

  private createCode() { return randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); }
  private createToken() { return randomBytes(24).toString('hex'); }
  private publicSession(session: { id: string; code: string; title: string; status: SessionStatus; currentOrder: number; startedAt: Date | null; endedAt: Date | null }) {
    return { id: session.id, code: session.code, title: session.title, status: session.status, currentOrder: session.currentOrder, startedAt: session.startedAt?.toISOString() ?? null, endedAt: session.endedAt?.toISOString() ?? null };
  }
  private playerSummary(player: { id: string; nickname: string; totalScore: number; truthMeter: number; currentOrder: number; correctCount: number; criteriaHit: number; criteriaTotal: number; combo: number; bestCombo: number; totalSeconds: number; completed: boolean }) {
    return { id: player.id, nickname: player.nickname, totalScore: player.totalScore, truthMeter: player.truthMeter, currentOrder: player.currentOrder, correctCount: player.correctCount, accuracy: player.criteriaTotal ? Math.round((player.criteriaHit / player.criteriaTotal) * 100) : 0, combo: player.combo, bestCombo: player.bestCombo, totalSeconds: player.totalSeconds, completed: player.completed };
  }

  async createSession(dto: CreateSessionDto) {
    const code = (dto.code?.toUpperCase() || this.createCode()).trim();
    if (await this.prisma.gameSession.findUnique({ where: { code } })) throw new BadRequestException('Mã phòng đã tồn tại.');
    const session = await this.prisma.gameSession.create({ data: { title: dto.title.trim(), code, adminToken: this.createToken() } });
    return { session: this.publicSession(session), adminToken: session.adminToken };
  }
  async getSession(id: string) { const session = await this.prisma.gameSession.findUnique({ where: { id } }); if (!session) throw new NotFoundException('Không tìm thấy phòng chơi.'); return this.publicSession(session); }
  async getByCode(code: string) { const session = await this.prisma.gameSession.findUnique({ where: { code: code.toUpperCase() } }); if (!session) throw new NotFoundException('Mã phòng không hợp lệ.'); return this.publicSession(session); }
  private async requireAdmin(id: string, token?: string) { const session = await this.prisma.gameSession.findUnique({ where: { id } }); if (!session) throw new NotFoundException('Không tìm thấy phòng chơi.'); if (!token || token !== session.adminToken) throw new BadRequestException('Mã xác thực giáo viên không hợp lệ.'); return session; }
  async startSession(id: string, token?: string) { await this.requireAdmin(id, token); const session = await this.prisma.gameSession.update({ where: { id }, data: { status: SessionStatus.ACTIVE, startedAt: new Date(), currentOrder: 1 } }); const output = this.publicSession(session); this.gateway.broadcastSession(id, output); return output; }
  async endSession(id: string, token?: string) { await this.requireAdmin(id, token); const session = await this.prisma.gameSession.update({ where: { id }, data: { status: SessionStatus.ENDED, endedAt: new Date() } }); const output = this.publicSession(session); this.gateway.broadcastSession(id, output); return output; }

  async join(dto: JoinSessionDto) {
    const session = await this.prisma.gameSession.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (!session) throw new NotFoundException('Mã phòng không hợp lệ.');
    if (session.status === SessionStatus.ENDED) throw new BadRequestException('Phòng chơi đã kết thúc.');
    const nickname = dto.nickname.trim();
    if (await this.prisma.playerSession.findUnique({ where: { sessionId_nickname: { sessionId: session.id, nickname } } })) throw new BadRequestException('Biệt danh này đã được sử dụng trong phòng.');
    const player = await this.prisma.playerSession.create({ data: { sessionId: session.id, nickname, token: this.createToken() } });
    this.gateway.broadcastPlayers(session.id);
    return { player: this.playerSummary(player), playerToken: player.token, session: this.publicSession(session) };
  }
  async playerFromToken(token?: string) { if (!token) throw new BadRequestException('Thiếu x-player-token.'); const player = await this.prisma.playerSession.findUnique({ where: { token }, include: { session: true } }); if (!player) throw new BadRequestException('Phiên người chơi không hợp lệ.'); return player; }
  private serializeChallenge(challenge: Pick<Challenge, 'id' | 'order' | 'type' | 'title' | 'instructions' | 'payload' | 'timeLimit' | 'baseScore'>) { return { id: challenge.id, order: challenge.order, type: challenge.type, title: challenge.title, instructions: challenge.instructions, payload: challenge.payload, timeLimit: challenge.timeLimit, baseScore: challenge.baseScore }; }

  async playerState(token?: string) {
    const player = await this.playerFromToken(token);
    const attempts = await this.prisma.challengeAttempt.findMany({ where: { playerId: player.id }, select: { id: true, challengeId: true, startedAt: true, submittedAt: true, score: true, correct: true, criteriaHit: true, criteriaTotal: true, elapsedSeconds: true }, orderBy: { startedAt: 'asc' } });
    return { player: this.playerSummary(player), session: this.publicSession(player.session), leaderboard: await this.leaderboard(player.sessionId), attempts: attempts.map((attempt) => ({ ...attempt, startedAt: attempt.startedAt.toISOString(), submittedAt: attempt.submittedAt?.toISOString() ?? null })) };
  }
  async adminState(id: string, token?: string) {
    const session = await this.requireAdmin(id, token);
    const players = await this.prisma.playerSession.findMany({ where: { sessionId: id }, orderBy: { joinedAt: 'asc' } });
    return { session: this.publicSession(session), players: players.map((player) => ({ ...this.playerSummary(player), joinedAt: player.joinedAt.toISOString() })), leaderboard: await this.leaderboard(id) };
  }
  private async requireQuestionEditor(id: string, token?: string) {
    const session = await this.requireAdmin(id, token);
    if (session.status === SessionStatus.ACTIVE) throw new BadRequestException('Chỉ có thể chỉnh sửa bộ câu hỏi khi phiên chơi chưa bắt đầu hoặc đã kết thúc.');
    return session;
  }
  private serializeAdminChallenge(challenge: Challenge) {
    return { ...this.serializeChallenge(challenge), solution: challenge.solution, active: challenge.active };
  }
  async adminChallenges(id: string, token?: string) {
    await this.requireQuestionEditor(id, token);
    const challenges = await this.prisma.challenge.findMany({ orderBy: { order: 'asc' } });
    return challenges.map((challenge) => this.serializeAdminChallenge(challenge));
  }
  private async assertAvailableOrder(order: number, ignoreId?: string) {
    const existing = await this.prisma.challenge.findUnique({ where: { order } });
    if (existing && existing.id !== ignoreId) throw new BadRequestException(`Thứ tự nhiệm vụ ${order} đã được sử dụng.`);
  }
  async createChallenge(id: string, token: string | undefined, dto: CreateChallengeDto) {
    await this.requireQuestionEditor(id, token);
    await this.assertAvailableOrder(dto.order);
    const challenge = await this.prisma.challenge.create({ data: { ...dto, title: dto.title.trim(), instructions: dto.instructions.trim(), payload: dto.payload as Prisma.InputJsonValue, solution: dto.solution as Prisma.InputJsonValue, active: dto.active ?? true } });
    return this.serializeAdminChallenge(challenge);
  }
  async updateChallenge(sessionId: string, token: string | undefined, challengeId: string, dto: UpdateChallengeDto) {
    await this.requireQuestionEditor(sessionId, token);
    const current = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!current) throw new NotFoundException('Không tìm thấy nhiệm vụ.');
    if (dto.order !== undefined) await this.assertAvailableOrder(dto.order, challengeId);
    const data: Prisma.ChallengeUpdateInput = {};
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.instructions !== undefined) data.instructions = dto.instructions.trim();
    if (dto.timeLimit !== undefined) data.timeLimit = dto.timeLimit;
    if (dto.baseScore !== undefined) data.baseScore = dto.baseScore;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.payload !== undefined) data.payload = dto.payload as Prisma.InputJsonValue;
    if (dto.solution !== undefined) data.solution = dto.solution as Prisma.InputJsonValue;
    const challenge = await this.prisma.challenge.update({ where: { id: challengeId }, data });
    return this.serializeAdminChallenge(challenge);
  }
  async archiveChallenge(sessionId: string, token: string | undefined, challengeId: string) {
    await this.requireQuestionEditor(sessionId, token);
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException('Không tìm thấy nhiệm vụ.');
    return this.serializeAdminChallenge(await this.prisma.challenge.update({ where: { id: challengeId }, data: { active: false } }));
  }
  async listChallenges(token?: string) { await this.playerFromToken(token); return (await this.prisma.challenge.findMany({ where: { active: true }, orderBy: { order: 'asc' } })).map((challenge) => this.serializeChallenge(challenge)); }

  async startAttempt(token: string | undefined, challengeId: string) {
    const player = await this.playerFromToken(token);
    if (player.session.status !== SessionStatus.ACTIVE) throw new BadRequestException('Trò chơi chưa bắt đầu hoặc đã kết thúc.');
    if (player.completed) throw new BadRequestException('Bạn đã hoàn thành toàn bộ hồ sơ.');
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge?.active) throw new NotFoundException('Không tìm thấy nhiệm vụ.');
    if (challenge.order !== player.currentOrder) throw new BadRequestException(`Hãy hoàn thành nhiệm vụ ${player.currentOrder} trước.`);
    const active = await this.prisma.challengeAttempt.findFirst({ where: { playerId: player.id, submittedAt: null } });
    if (active && active.challengeId !== challengeId) throw new BadRequestException('Bạn đang có một hồ sơ chưa nộp.');
    const attempt = await this.prisma.challengeAttempt.upsert({ where: { playerId_challengeId: { playerId: player.id, challengeId } }, create: { playerId: player.id, challengeId }, update: {} });
    if (attempt.submittedAt) throw new BadRequestException('Bạn đã nộp nhiệm vụ này.');
    return { attemptId: attempt.id, startedAt: attempt.startedAt.toISOString(), challenge: this.serializeChallenge(challenge) };
  }

  private evaluate(challenge: Challenge, answer: JsonObject, elapsedSeconds: number): Evaluation {
    const solution = challenge.solution as JsonObject;
    let criteriaHit = 0; let criteriaTotal = 1; let correct = false;
    if (challenge.type === ChallengeType.FIND_FAKE) { const keys = ['suspiciousSegmentId', 'verdict', 'misinformationType']; criteriaTotal = keys.length; criteriaHit = keys.filter((key) => answer[key] === solution[key]).length; correct = criteriaHit === criteriaTotal; }
    if (challenge.type === ChallengeType.EVIDENCE_HUNT) {
      const keys = ['evidenceId', 'reasoningId'];
      criteriaTotal = keys.length;
      criteriaHit = keys.filter((key) => answer[key] === solution[key]).length;
      correct = criteriaHit === criteriaTotal;
    }
    if (challenge.type === ChallengeType.CAUSE_EFFECT) {
      const expected = new Set(solution.pairIds as string[]); const selected = new Set(Array.isArray(answer.pairIds) ? answer.pairIds.filter((value): value is string => typeof value === 'string') : []); criteriaTotal = expected.size; criteriaHit = [...selected].filter((id) => expected.has(id)).length; correct = criteriaHit === criteriaTotal && selected.size === expected.size;
    }
    if (challenge.type === ChallengeType.TIMELINE) { const expected = solution.orderedIds as string[]; const ordered = Array.isArray(answer.orderedIds) ? answer.orderedIds : []; criteriaTotal = expected.length; criteriaHit = expected.filter((id, index) => ordered[index] === id).length; correct = criteriaHit === criteriaTotal; }
    if (challenge.type === ChallengeType.CONCLUSION) { criteriaHit = answer.conclusionId === solution.conclusionId ? 1 : 0; correct = criteriaHit === 1; }
    const timedOut = elapsedSeconds > challenge.timeLimit;
    const score = timedOut ? 0 : Math.round((challenge.baseScore * criteriaHit) / criteriaTotal) + (correct ? Math.round(challenge.baseScore * 0.25 * Math.max(0, 1 - elapsedSeconds / challenge.timeLimit)) : 0);
    return { score, criteriaHit: timedOut ? 0 : criteriaHit, criteriaTotal, correct: correct && !timedOut, timedOut, explanation: String(solution.explanation) };
  }

  async submitAttempt(token: string | undefined, attemptId: string, answer: JsonObject) {
    const player = await this.playerFromToken(token);
    if (player.session.status !== SessionStatus.ACTIVE) throw new BadRequestException('Phiên chơi đã kết thúc, không thể nộp hồ sơ.');
    const attempt = await this.prisma.challengeAttempt.findUnique({ where: { id: attemptId }, include: { challenge: true } });
    if (!attempt || attempt.playerId !== player.id) throw new NotFoundException('Không tìm thấy lượt chơi.');
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000));
    const evaluated = this.evaluate(attempt.challenge, answer, elapsedSeconds);
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.challengeAttempt.updateMany({ where: { id: attempt.id, submittedAt: null }, data: { submittedAt: new Date(), answer: answer as Prisma.InputJsonValue, score: evaluated.score, correct: evaluated.correct, criteriaHit: evaluated.criteriaHit, criteriaTotal: evaluated.criteriaTotal, elapsedSeconds, feedback: { ...evaluated, elapsedSeconds } as Prisma.InputJsonValue } });
      if (locked.count !== 1) throw new BadRequestException('Lượt chơi đã được nộp.');
      const combo = evaluated.correct ? player.combo + 1 : 0;
      const comboBonus = evaluated.correct ? Math.round(attempt.challenge.baseScore * Math.min(combo, 5) * 0.1) : 0;
      await tx.challengeAttempt.update({ where: { id: attempt.id }, data: { comboBonus, score: { increment: comboBonus } } });
      const totalChallenges = await tx.challenge.count({ where: { active: true } });
      const nextOrder = attempt.challenge.order + 1;
      return tx.playerSession.update({ where: { id: player.id }, data: { totalScore: { increment: evaluated.score + comboBonus }, truthMeter: { set: Math.min(100, Math.max(0, player.truthMeter + (evaluated.correct ? 7 : -7))) }, currentOrder: nextOrder, combo, bestCombo: Math.max(player.bestCombo, combo), correctCount: { increment: evaluated.correct ? 1 : 0 }, criteriaHit: { increment: evaluated.criteriaHit }, criteriaTotal: { increment: evaluated.criteriaTotal }, totalSeconds: { increment: elapsedSeconds }, completed: nextOrder > totalChallenges } });
    });
    const leaderboard = await this.leaderboard(player.sessionId);
    this.gateway.broadcastLeaderboard(player.sessionId, leaderboard);
    this.gateway.broadcastPlayers(player.sessionId);
    return { ...evaluated, comboBonus: (await this.prisma.challengeAttempt.findUnique({ where: { id: attempt.id }, select: { comboBonus: true } }))?.comboBonus ?? 0, elapsedSeconds, maxScore: Math.round(attempt.challenge.baseScore * 1.75), player: this.playerSummary(updated), leaderboard };
  }
  async leaderboard(sessionId: string) { const rows = await this.prisma.playerSession.findMany({ where: { sessionId }, orderBy: [{ totalScore: 'desc' }, { criteriaHit: 'desc' }, { totalSeconds: 'asc' }, { joinedAt: 'asc' }] }); return rows.map((player, index) => ({ rank: index + 1, ...this.playerSummary(player) })); }
  async knowledgeMap(token?: string) {
    const player = await this.playerFromToken(token);
    const attempts = await this.prisma.challengeAttempt.findMany({ where: { playerId: player.id, submittedAt: { not: null } }, include: { challenge: true }, orderBy: { challenge: { order: 'asc' } } });
    const chapters = [{ id: 'departure', title: 'Hồ sơ bị sửa', range: [1, 5], summary: 'Động cơ và bước khởi hành năm 1911.' }, { id: 'journey', title: 'Theo dấu hành trình', range: [6, 10], summary: 'Hoạt động quốc tế và vấn đề thuộc địa.' }, { id: 'turning', title: 'Bước ngoặt tư tưởng', range: [11, 15], summary: 'Lý luận, tổ chức và sự chuẩn bị.' }, { id: 'restore', title: 'Khôi phục sự thật', range: [16, 20], summary: 'Kết nối bằng chứng thành kết luận.' }];
    return { chapters: chapters.map((chapter) => { const chapterAttempts = attempts.filter((item) => item.challenge.order >= chapter.range[0] && item.challenge.order <= chapter.range[1]); return { ...chapter, unlocked: player.currentOrder > chapter.range[0], completed: chapterAttempts.length === 5, correct: chapterAttempts.filter((item) => item.correct).length, missions: chapterAttempts.map((item) => ({ order: item.challenge.order, title: item.challenge.title, correct: item.correct, explanation: (item.feedback as JsonObject | null)?.explanation ?? null })) }; }), edges: [{ from: 'departure', to: 'journey', label: 'trải nghiệm thực tiễn' }, { from: 'journey', to: 'turning', label: 'tiếp cận lý luận' }, { from: 'turning', to: 'restore', label: 'chuẩn bị tổ chức' }] };
  }
}
