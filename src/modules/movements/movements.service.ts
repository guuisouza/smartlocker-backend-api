import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { format } from 'date-fns';

/* 
Quando o NFC é capturado:

    🔍 Obter notebook associado à tag NFC (nfc_tag → notebook) OK

    🧭 Obter o armário onde esse notebook está alocado (notebook → cabinet_id) OK 

    🏫 Obter a sala do armário (cabinet → room_id) OK 

    📅 Obter a aula (schedule) atual na sala no momento da captura (room_id + datetime) OK

    📦 Verificar se o notebook está sendo retirado ou devolvido

    📝 Registrar a movimentação na tabela movements
*/

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async handleNfcMovement(nfc_tag: string, datetime: string) {
    // 1. Pega o notebook pela tag
    const notebook = await this.prisma.notebooks.findFirst({
      where: { nfc_tag },
    });
    if (!notebook) throw new Error('Notebook não encontrado.');

    const notebook_id = notebook.id;

    // 2. Pega o cabinet_id
    const cabinet = await this.prisma.cabinets.findFirst({
      where: { notebooks: { some: { id: notebook_id } } },
    });
    if (!cabinet) throw new Error('Cabinet não encontrado.');

    // const cabinet_id = cabinet.id;

    // 3. Pega o room_id
    const room_id = cabinet.room_id;

    // 4. Busca a schedule que está ativa naquela data/hora e sala
    // Dias da semana com acento correto, para bater com os valores do banco
    const weekdays = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ];

    const captureDate = new Date(datetime);
    const dayOfWeekIndex = captureDate.getDay();
    const formattedDay = weekdays[dayOfWeekIndex];

    const timeOnly = format(captureDate, 'HH:mm:ss'); // Ex: "21:57:35"

    // Busca a schedule com SQL puro
    const scheduleResult = await this.prisma.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM schedules
    WHERE room_id = ${room_id}
      AND day_of_week = ${formattedDay}
      AND start_time <= ${timeOnly}
      AND end_time >= ${timeOnly}
    LIMIT 1`;

    if (!scheduleResult.length) {
      throw new Error('Nenhuma aula agendada para essa sala nesse horário.');
    }

    const schedule_id = scheduleResult[0].id;

    // 5. Verifica se já houve uma retirada sem devolução
    const existingMovement = await this.prisma.movements.findFirst({
      where: {
        notebook_id,
        schedule_id,
        room_id,
        return_datetime: null,
        checkout_datetime: {
          gte: new Date('2000-01-01T00:00:00.000Z'),
        },
      },
    });

    // 6. Agora define se é retirada ou devolução
    if (!existingMovement) {
      // RETIRADA
      await this.prisma.$executeRaw`
        INSERT INTO movements (notebook_id, checkout_datetime, schedule_id, room_id)
        VALUES (${notebook_id}, ${datetime}, ${schedule_id}, ${room_id})
      `;
    } else {
      // DEVOLUÇÃO
      await this.prisma.$executeRaw`
        UPDATE movements
        SET return_datetime = ${datetime}
        WHERE id = ${existingMovement.id}
      `;
    }
  }
}
