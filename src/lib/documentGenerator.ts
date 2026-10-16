/**
 * documentGenerator.ts
 * =====================
 * Motor de Geração de Documentos (Document Assembly)
 *
 * Usa PizZip + Docxtemplater para preencher templates .docx armazenados
 * no Supabase Storage com dados dinâmicos do cliente/caso/processo.
 *
 * Convenção de variáveis no template .docx:
 *   {nome_cliente}   → "João da Silva"
 *   {cpf}            → "123.456.789-00"
 *   {processo}       → "5001234-56.2024.4.03.6100"
 *   {area}           → "Previdenciário"
 *   ... (qualquer chave definida no objeto `data` passado para generateDocument)
 */

// Imports com asserção de tipo para módulos CommonJS sem esm-compat perfeito
import PizZipCtor from 'pizzip';
import DocxtemplaterCtor from 'docxtemplater';
import { saveAs } from 'file-saver';
import { supabase } from './supabase';

// Docxtemplater e PizZip usam export = X (CJS) — resolvemos o default corretamente
const PizZip = (PizZipCtor as unknown as { default: typeof PizZipCtor }).default ?? PizZipCtor;
const Docxtemplater =
  (DocxtemplaterCtor as unknown as { default: typeof DocxtemplaterCtor }).default ??
  DocxtemplaterCtor;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapa de variáveis a interpolar no documento.
 * As chaves devem corresponder às tags {chave} no template .docx.
 */
export type DocumentData = Record<string, string | number | boolean | null | undefined>;

/**
 * Resultado de uma tentativa de geração.
 */
export type GenerateResult =
  | { success: true }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Função Principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera e força o download de um documento Word preenchido com os dados fornecidos.
 *
 * @param storagePath  Caminho relativo do arquivo no bucket 'templates'
 *                     (ex: "tenant-uuid/1718000000_contrato.docx")
 * @param data         Objeto com as variáveis a substituir no template
 *                     (ex: { nome_cliente: "João", cpf: "123.456.789-00" })
 * @param outputName   Nome do arquivo gerado no download do usuário
 *                     (ex: "Contrato_João_da_Silva.docx")
 *
 * @returns GenerateResult — { success: true } ou { success: false, error: string }
 */
export async function generateDocument(
  storagePath: string,
  data: DocumentData,
  outputName: string
): Promise<GenerateResult> {
  try {
    // ── 1. Baixa o arquivo .docx do Supabase Storage como Blob ───────────────
    const { data: blobData, error: downloadError } = await supabase.storage
      .from('templates')
      .download(storagePath);

    if (downloadError || !blobData) {
      return {
        success: false,
        error: downloadError?.message ?? 'Arquivo de template não encontrado no repositório.',
      };
    }

    // ── 2. Converte o Blob para ArrayBuffer (PizZip aceita ambos) ─────────────
    const arrayBuffer = await blobData.arrayBuffer();

    // ── 3. Lê o .docx com PizZip ──────────────────────────────────────────────
    const zip = new PizZip(arrayBuffer);

    // ── 4. Instancia o Docxtemplater ──────────────────────────────────────────
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true, // Evita duplicação de parágrafos em loops
      linebreaks: true,    // Respeita \n como quebras de linha no Word
      // nullGetter: retorna string vazia para variáveis não encontradas no `data`
      // em vez de lançar exceção, garantindo robustez em modelos parcialmente preenchidos
      nullGetter() {
        return '';
      },
    });

    // ── 5. Interpola os dados no template ─────────────────────────────────────
    //    doc.render() substitui todos os {placeholders} pelos valores em `data`
    doc.render(data);

    // ── 6. Gera o arquivo Word preenchido como Blob ───────────────────────────
    const outputBlob = doc.toBlob({
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // ── 7. Força o download no navegador via file-saver ───────────────────────
    //    Garante extensão .docx no nome final
    const safeOutputName = outputName.endsWith('.docx')
      ? outputName
      : `${outputName}.docx`;

    saveAs(outputBlob, safeOutputName);

    return { success: true };
  } catch (err: unknown) {
    // Captura erros do Docxtemplater (tags malformadas, arquivo corrompido, etc.)
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Erro desconhecido ao processar o template.';

    console.error('[documentGenerator] Erro ao gerar documento:', err);

    return { success: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários auxiliares
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Higieniza uma string para uso seguro como nome de arquivo no download.
 * Remove caracteres especiais e substitui espaços por underscores.
 *
 * @example
 * sanitizeFileName("João da Silva (Previdenciário)") // "Joao_da_Silva_Previdenciario"
 */
export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')                         // Decompõe acentos (é → e + ´)
    .replace(/[\u0300-\u036f]/g, '')          // Remove marcas diacríticas
    .replace(/[^a-zA-Z0-9\s._-]/g, '')       // Remove caracteres especiais
    .replace(/\s+/g, '_')                     // Substitui espaços por underscore
    .replace(/_+/g, '_')                      // Colapsa múltiplos underscores
    .replace(/^_|_$/g, '');                   // Remove underscore inicial/final
}

/**
 * Monta um nome de arquivo de saída a partir de partes descritivas.
 *
 * @example
 * buildOutputName("Contrato de Honorários", "João Silva", "2024-06-01")
 * // "Contrato_de_Honorarios_Joao_Silva_2024-06-01"
 */
export function buildOutputName(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .map((p) => sanitizeFileName(p!))
    .filter(Boolean)
    .join('_');
}
