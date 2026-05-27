import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis/client';
import { logger, withSpan, mensagensProcessadasCounter, mensagensFalhasCounter } from '@/lib/telemetry';
import { processarMensagemComIA } from '@/lib/ia/groq';
import { enviarMensagemWhatsApp } from '@/lib/meta/whatsapp';
import { AppError, ErrorCodes, ok, err, type Result } from '@/types';
import type { IntencaoIA, AgenteConfig } from '@/types';
import { z } from 'zod';

const CONFIG = {
  POLL_INTERVAL_MS: 1000,
  MAX_RETRIES: 5,
  RETRY_DELAYS: [1000, 2000, 4000, 8000, 16000],
  BATCH_SIZE: 10,
};

const queueMessageSchema = z.object({
  requestId: z.string(),
  messageId: z.string(),
  telefone: z.string(),
  conteudo: z.string(),
  tipo: z.enum(['texto', 'imagem', 'audio', 'documento', 'localizacao']),
  timestamp: z.string(),
  rateLimited: z.boolean().default(false),
  retryCount: z.number().default(0),
});

async function processarMensagem(
  msg: z.infer<typeof queueMessageSchema>
): Promise<Result<void, AppError>> {
  return withSpan('worker.processar_mensagem', async (span) => {
    span.setAttribute('message.id', msg.messageId);
    span.setAttribute('message.telefone', msg.telefone);

    const supabase = await createSupabaseServerClient();

    try {
      if (msg.rateLimited) {
        await enviarMensagemWhatsApp(
          msg.telefone,
          'Estou processando muitas mensagens no momento. Por favor, aguarde um momento. ⏳'
        );
        return ok(undefined);
      }

      // Buscar ou criar cliente
      const { data: cliente } = await supabase
        .from('cliente')
        .select('id, clinica_id, nome')
        .eq('telefone', msg.telefone)
        .single();

      let clienteId = cliente?.id;
      let clinicaId = cliente?.clinica_id;

      if (!clienteId) {
        // Cria cliente novo
        const { data: novoCliente } = await supabase
          .from('cliente')
          .insert({
            nome: 'Cliente Novo',
            telefone: msg.telefone,
            whatsapp_id: msg.telefone,
          })
          .select('id, clinica_id')
          .single();

        clienteId = novoCliente?.id;
        clinicaId = novoCliente?.clinica_id;
      }

      if (!clinicaId || !clienteId) {
        throw new AppError(ErrorCodes.CLIENTE_NAO_ENCONTRADO, 'Clínica não encontrada');
      }

      // Salvar log
      await supabase.from('conversa_log').insert({
        clinica_id: clinicaId,
        cliente_id: clienteId,
        message_id: msg.messageId,
        telefone: msg.telefone,
        direcao: 'entrada',
        conteudo: msg.conteudo.substring(0, 4000),
        tipo_mensagem: msg.tipo,
        processado: false,
      });

      // Buscar config do agente
      const { data: agenteConfig } = await supabase
        .from('agente_config')
        .select('*')
        .eq('clinica_id', clinicaId)
        .single();

      if (!agenteConfig) {
        throw new AppError('CONFIG_NAO_ENCONTRADA', 'Configuração do agente não encontrada');
      }

      const config: AgenteConfig = {
        id: agenteConfig.id,
        clinicaId: agenteConfig.clinica_id,
        unidadeId: agenteConfig.unidade_id,
        nomeAgente: agenteConfig.nome_agente,
        saudacao: agenteConfig.saudacao,
        horarioAtendimento: agenteConfig.horario_atendimento as { inicio: string; fim: string; dias: string[] },
        servicosAutomaticos: agenteConfig.servicos_automaticos,
        confirmacaoAutomatica: agenteConfig.confirmacao_automatica,
        tempoLembrete: agenteConfig.tempo_lembrete,
        tomVoz: agenteConfig.tom_voz as 'profissional' | 'amigavel' | 'formal',
        instrucoesPersonalizadas: agenteConfig.instrucoes_personalizadas,
        evolutionInstance: null,
        status: agenteConfig.status as 'ativo' | 'inativo',
      };

      // Processar com Groq
      const intencao = await processarMensagemComIA(msg.conteudo, config);

      // Executar ação
      let resposta = intencao.respostaSugerida;

      switch (intencao.tipo) {
        case 'agendamento':
          resposta = await handleAgendamento(supabase, intencao, clienteId, clinicaId, config);
          break;
        case 'caixa':
          resposta = await handleCaixa(intencao, clienteId, clinicaId);
          break;
        case 'consulta':
          resposta = await handleConsulta(supabase, intencao, clienteId, clinicaId);
          break;
        case 'saudacao':
          resposta = config.saudacao;
          break;
      }

      // Enviar resposta via Meta API
      await enviarMensagemWhatsApp(msg.telefone, resposta);

      // Atualizar log
      await supabase
        .from('conversa_log')
        .update({
          processado: true,
          intencao_ia: intencao.tipo,
          confianca_ia: intencao.confianca,
        })
        .eq('message_id', msg.messageId);

      mensagensProcessadasCounter.add(1, { intencao: intencao.tipo, clinica_id: clinicaId });

      logger.info('Mensagem processada', { requestId: msg.requestId, intencao: intencao.tipo });

      return ok(undefined);

    } catch (erro) {
      mensagensFalhasCounter.add(1, { erro: (erro as Error).name });

      if (msg.retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAYS[msg.retryCount] || 16000;
        setTimeout(async () => {
          const supabaseRetry = await createSupabaseServerClient();
          await supabaseRetry.rpc('enqueue_message', {
            queue_name: 'whatsapp-messages',
            payload: { ...msg, retryCount: msg.retryCount + 1 },
          });
        }, delay);
        return ok(undefined);
      }

      const supabaseError = await createSupabaseServerClient();
      await supabaseError.from('conversa_log').update({
        processado: true,
        erro: (erro as Error).message,
      }).eq('message_id', msg.messageId);

      return err(new AppError(ErrorCodes.FALHA_PROCESSAMENTO, erro));
    }
  });
}

async function handleAgendamento(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  intencao: IntencaoIA,
  clienteId: string,
  clinicaId: string,
  config: AgenteConfig
): Promise<string> {
  const { data, hora, servico } = intencao.entidades;

  if (!data || !hora) {
    return 'Para agendar, preciso que informe a data e o horário desejados. Por exemplo: "Quero agendar para terça-feira às 14h".';
  }

  const { data: servicos } = await supabase
    .from('servico')
    .select('id, nome, duracao_minutos, preco')
    .eq('clinica_id', clinicaId)
    .ilike('nome', `%${servico}%`)
    .limit(1);

  if (!servicos || servicos.length === 0) {
    return 'Não encontrei esse serviço. Temos: limpeza de pele, peeling, botox, preenchimento, entre outros. Qual você gostaria?';
  }

  const servicoEncontrado = servicos[0];
  const dataHora = new Date(`${data}T${hora}:00`);

  const { data: agendamento, error } = await supabase
    .from('agendamento')
    .insert({
      clinica_id: clinicaId,
      cliente_id: clienteId,
      servico_id: servicoEncontrado.id,
      data_hora: dataHora.toISOString(),
      duracao_minutos: servicoEncontrado.duracao_minutos,
      status: 'pendente',
      origem: 'whatsapp',
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('conflito')) {
      return 'Desculpe, esse horário já está ocupado. Posso sugerir outro horário?';
    }
    throw error;
  }

  if (!config.confirmacaoAutomatica) {
    return `Agendamento pré-reservado para ${data} às ${hora} - ${servicoEncontrado.nome}.\n\nPara confirmar, responda **CONFIRMO**.\n\nValor: R$ ${servicoEncontrado.preco.toFixed(2).replace('.', ',')}\n⏰ Válido por 10 minutos.`;
  }

  await supabase
    .from('agendamento')
    .update({ status: 'confirmado', confirmacao_whatsapp: true })
    .eq('id', agendamento.id);

  return `✅ Agendamento confirmado!\n\n📅 ${data} às ${hora}\n💆 ${servicoEncontrado.nome}\n💰 R$ ${servicoEncontrado.preco.toFixed(2).replace('.', ',')}\n\nTe enviarei um lembrete ${config.tempoLembrete} minutos antes. Até lá! 💜`;
}

async function handleCaixa(
  _intencao: IntencaoIA,
  _clienteId: string,
  _clinicaId: string
): Promise<string> {
  return 'Para operações de caixa, acesse o painel administrativo ou fale com a recepcionista. Posso ajudar com agendamentos ou informações sobre nossos serviços.';
}

async function handleConsulta(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  _intencao: IntencaoIA,
  clienteId: string,
  _clinicaId: string
): Promise<string> {
  const { data: agendamentos } = await supabase
    .from('agendamento')
    .select('data_hora, status, servico: servico_id (nome)')
    .eq('cliente_id', clienteId)
    .gte('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: true })
    .limit(3);

  if (!agendamentos || agendamentos.length === 0) {
    return 'Você não tem agendamentos futuros. Gostaria de agendar?';
  }

  let resposta = 'Seus próximos agendamentos:\n\n';
  agendamentos.forEach((ag, i) => {
    const data = new Date(ag.data_hora);
    resposta += `${i + 1}. ${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${(ag.servico as unknown as { nome: string }).nome} (${ag.status})\n`;
  });

  return resposta;
}

async function pollQueue(): Promise<void> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data: messages, error } = await supabase.rpc('dequeue_messages', {
      queue_name: 'whatsapp-messages',
      batch_size: CONFIG.BATCH_SIZE,
      visibility_timeout: 300,
    });

    if (error) {
      logger.error('Erro ao buscar fila', error);
      return;
    }

    if (!messages || messages.length === 0) return;

    logger.info(`Processando ${messages.length} mensagens`);

    await Promise.all(
      messages.map(async (msg: unknown) => {
        const parsed = queueMessageSchema.safeParse(msg);
        if (parsed.success) {
          await processarMensagem(parsed.data);
        } else {
          logger.error('Mensagem da fila inválida', parsed.error);
        }
      })
    );

  } catch (erro) {
    logger.error('Erro no poll da fila', erro as Error);
  }
}

async function main(): Promise<void> {
  logger.info('Worker iniciado', { pollInterval: CONFIG.POLL_INTERVAL_MS });

  while (true) {
    await pollQueue();
    await new Promise((resolve) => setTimeout(resolve, CONFIG.POLL_INTERVAL_MS));
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido, encerrando...');
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recebido, encerrando...');
  await redis.quit();
  process.exit(0);
});

main().catch((erro) => {
  logger.error('Worker crashed', erro);
  process.exit(1);
});