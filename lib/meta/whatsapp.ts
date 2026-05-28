export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<<{
    id: string;
    changes: Array<<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<<{
          wa_id: string;
          profile: { name: string };
        }>;
        messages?: Array<<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'audio' | 'document' | 'location';
          text?: { body: string };
          image?: { caption?: string };
          audio?: {};
          document?: { caption?: string };
          location?: {};
        }>;
        statuses?: Array<<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: 'messages';
    }>;
  }>;
}

export function extrairMensagemMeta(payload: MetaWebhookPayload): {
  messageId: string;
  telefone: string;
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'audio' | 'documento' | 'localizacao';
  nome?: string;
} | null {
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return null;

  const conteudo = message.text?.body || 
                   message.image?.caption || 
                   message.document?.caption ||
                   '[Áudio/Localização]';

  const tipo = message.type === 'text' ? 'texto' :
               message.type === 'image' ? 'imagem' :
               message.type === 'audio' ? 'audio' :
               message.type === 'document' ? 'documento' : 'localizacao';

  const contato = value?.contacts?.[0];

  return {
    messageId: message.id,
    telefone: message.from,
    conteudo,
    tipo,
    nome: contato?.profile?.name,
  };
}